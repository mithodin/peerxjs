import { PeerOptions } from 'peerjs';
import {
    CallEvent,
    ConnectionEvent,
    PeeRXJSCommand,
    PeeRXJSDataConnection,
    PeeRXJSEventType,
    PeeRXJSRaw,
    register,
} from './raw/index.js';
import {
    AsyncSubject,
    BehaviorSubject,
    filter,
    map,
    materialize,
    Observable,
    shareReplay,
    startWith,
    Subject,
    switchMap,
    takeUntil,
} from 'rxjs';
import { Peer, WithPendingCall } from './peer.js';
import { getIterate } from './util.js';

export type PeeRXJSOptions = PeerOptions & {
    peerId?: string;
};

export enum PeeRXJSStateTag {
    CONNECTING = 'connecting',
    OPEN = 'open',
    CLOSED = 'closed',
    ERROR = 'error',
}

export type PeeRXJSStateBase<
    T extends PeeRXJSStateTag,
    Props extends Record<string, unknown>,
> = { type: T } & Props;

export type PeeRXJSStateConnecting = PeeRXJSStateBase<
    PeeRXJSStateTag.CONNECTING,
    Record<never, unknown>
>;

export type PeeRXJSStateOpen = PeeRXJSStateBase<
    PeeRXJSStateTag.OPEN,
    { peerId: string }
>;

export type PeeRXJSStateClosed = PeeRXJSStateBase<
    PeeRXJSStateTag.CLOSED,
    { reopen: () => void }
>;

export type PeeRXJSStateError = PeeRXJSStateBase<
    PeeRXJSStateTag.ERROR,
    { reopen: () => void; error: unknown }
>;

export type PeeRXJSState =
    | PeeRXJSStateConnecting
    | PeeRXJSStateOpen
    | PeeRXJSStateClosed
    | PeeRXJSStateError
    | {
          type: 'debug';
          message?: string;
      };

const KEEP_PREVIOUS_STATE: unique symbol = Symbol('KEEP_PREVIOUS_STATE');
function isPeeRXJSState(
    state: PeeRXJSState | typeof KEEP_PREVIOUS_STATE,
): state is PeeRXJSState {
    return state !== KEEP_PREVIOUS_STATE;
}

export class PeeRXJS {
    private raw: BehaviorSubject<PeeRXJSRaw>;
    public readonly state: Observable<PeeRXJSState>;
    public readonly peers: Observable<Array<Peer>>;

    private readonly signal = new AsyncSubject<void>();
    private readonly commands = new Subject<PeeRXJSCommand>();

    private readonly setPeers: (
        map: (current: Array<Peer>) => Array<Peer>,
    ) => void;

    public constructor({ peerId, ...options }: PeeRXJSOptions) {
        this.raw = new BehaviorSubject(register(peerId, options));

        const peers = new BehaviorSubject<Array<Peer>>([]);
        this.setPeers = getIterate(peers);
        this.peers = peers.asObservable();
        this.state = this.raw.pipe(
            takeUntil(this.signal),
            switchMap((raw) => {
                this.commands.subscribe(raw);
                return raw.pipe(
                    materialize(),
                    map((event): PeeRXJSState | typeof KEEP_PREVIOUS_STATE => {
                        switch (event.kind) {
                            case 'N': {
                                const innerEvent = event.value;
                                switch (innerEvent.type) {
                                    case PeeRXJSEventType.OPEN: {
                                        return {
                                            type: PeeRXJSStateTag.OPEN,
                                            peerId: innerEvent.peerId,
                                        };
                                    }
                                    case PeeRXJSEventType.DISCONNECTED: {
                                        innerEvent.reconnect();
                                        return {
                                            type: PeeRXJSStateTag.CONNECTING,
                                        };
                                    }
                                    case PeeRXJSEventType.CONNECTION: {
                                        return this.handleConnectionEvent(
                                            innerEvent,
                                        );
                                    }
                                    case PeeRXJSEventType.CALL:
                                        return this.handleCallEvent(innerEvent);
                                    default:
                                        return {
                                            type: 'debug',
                                            message: `unknown inner event ${JSON.stringify(
                                                innerEvent,
                                            )}`,
                                        };
                                }
                            }
                            case 'C':
                                raw.complete();
                                return {
                                    type: PeeRXJSStateTag.CLOSED,
                                    reopen: () => void 0,
                                };
                            case 'E':
                                return {
                                    type: PeeRXJSStateTag.ERROR,
                                    error: event.error,
                                    reopen: () => void 0,
                                };
                        }
                    }),
                );
            }),
            filter(isPeeRXJSState),
            startWith({ type: PeeRXJSStateTag.CONNECTING } as const),
            takeUntil(this.signal),
            shareReplay({ bufferSize: 1, refCount: false }),
        );

        this.state.subscribe();
    }

    private handleCallEvent(
        event: CallEvent,
    ): PeeRXJSState | typeof KEEP_PREVIOUS_STATE {
        const newPeer: Peer = {
            peerId: event.peerId,
            pendingCall: (mediaConnection) => {
                const peerMediaConnection = event.answer(mediaConnection);
                this.setPeers((current) => {
                    return current.map(({ peerId, ...rest }): Peer => {
                        if (peerId === event.peerId) {
                            const { pendingCall: _, ...other } =
                                rest as WithPendingCall;
                            return {
                                peerId,
                                mediaConnection: peerMediaConnection,
                                ...other,
                            };
                        }
                        return {
                            peerId,
                            ...rest,
                        };
                    });
                });
            },
        };
        this.setPeers((current) => {
            if (this.havePeer(current, event.peerId)) {
                return current.map((peer) => {
                    if (peer.peerId === event.peerId) {
                        return {
                            ...peer,
                            ...newPeer,
                        };
                    }
                    return peer;
                });
            } else {
                return current.concat(newPeer);
            }
        });
        return KEEP_PREVIOUS_STATE;
    }

    private handleConnectionEvent(
        innerEvent: ConnectionEvent,
    ): PeeRXJSState | typeof KEEP_PREVIOUS_STATE {
        this.addDataConnection(innerEvent.peerId, innerEvent.connection);
        return KEEP_PREVIOUS_STATE;
    }

    private addDataConnection(
        peerId: string,
        dataConnection: PeeRXJSDataConnection,
    ) {
        this.setPeers((current) => {
            if (this.havePeer(current, peerId)) {
                return current.map((peer): Peer => {
                    if (peer.peerId === peerId) {
                        return {
                            ...peer,
                            dataConnection,
                        };
                    }
                    return peer;
                });
            } else {
                return current.concat({
                    peerId,
                    dataConnection,
                });
            }
        });
    }

    private havePeer(peers: Array<Peer>, peerId: string) {
        return peers.some(
            ({ peerId: currentPeerId }) => peerId === currentPeerId,
        );
    }

    public destroy() {
        this.signal.next();
        this.signal.complete();
        this.raw.complete();
        this.commands.complete();
    }
}
