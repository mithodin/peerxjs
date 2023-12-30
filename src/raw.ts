import { Observable, Observer, Subject } from 'rxjs';
import { MediaConnection, Peer, PeerOptions } from 'peerjs';
import { PeeRXJSEvent, PeeRXJSEventType } from './events.js';
import {
    ConnectCommand,
    PeeRXJSCommand,
    PeeRXJSCommandType,
} from './commands.js';

function getPeer(
    id: undefined | string | PeerOptions,
    config: undefined | PeerOptions
) {
    if (id) {
        if (typeof id === 'string') {
            return new Peer(id, config);
        } else {
            return new Peer(id);
        }
    }
    return new Peer();
}

export type PeeRXJSRaw = Observable<PeeRXJSEvent> & Observer<PeeRXJSCommand>;

function setUpEventHandlers(peer: Peer, subject: Subject<PeeRXJSEvent>) {
    peer.on('error', (error) => {
        subject.error(error);
        peer.destroy();
    });
    peer.on('open', (peerId) => {
        subject.next({ type: PeeRXJSEventType.OPEN, peerId });
    });
    peer.on('connection', (connection) => {
        subject.next({ type: PeeRXJSEventType.CONNECTION, connection });
    });
    peer.on('call', (call) => {
        subject.next({ type: PeeRXJSEventType.CALL, connection: call });
    });
    peer.on('disconnected', () => {
        subject.next({
            type: PeeRXJSEventType.DISCONNECTED,
            reconnect: () => peer.reconnect(),
        });
    });
    peer.on('close', () => {
        subject.complete();
        peer.destroy();
    });
}

function doWhenOpen(peer: Peer, callback: () => void) {
    if (peer.open) {
        callback();
    } else {
        peer.once('open', () => callback());
    }
}

function connectTo(
    peer: Peer,
    command: ConnectCommand,
    subject: Subject<PeeRXJSEvent>
) {
    doWhenOpen(peer, () => {
        const connection = peer.connect(command.peerId, command.options);
        subject.next({
            type: PeeRXJSEventType.CONNECTION,
            connection,
        });
    });
}

function callPeer(peer: Peer, subject: Subject<PeeRXJSEvent>) {
    doWhenOpen(peer, () => {
        const call = {} as unknown as MediaConnection;
        subject.next({
            type: PeeRXJSEventType.CALL,
            connection: call,
        });
    });
}

export function register(id?: string, config?: PeerOptions): PeeRXJSRaw;
export function register(config: PeerOptions): PeeRXJSRaw;
export function register(
    id?: string | PeerOptions,
    config?: PeerOptions
): PeeRXJSRaw {
    const subject = new Subject<PeeRXJSEvent>();
    const peer = getPeer(id, config);
    setUpEventHandlers(peer, subject);
    return {
        lift: subject.lift.bind(subject),
        operator: subject.operator,
        source: subject.source,
        forEach: subject.forEach.bind(subject),
        pipe: subject.pipe.bind(subject),
        toPromise: subject.toPromise.bind(subject),
        subscribe: subject.subscribe.bind(subject),
        next: (command) => {
            switch (command.type) {
                case PeeRXJSCommandType.CONNECT:
                    connectTo(peer, command, subject);
                    break;
                case PeeRXJSCommandType.CALL:
                    callPeer(peer, subject);
                    break;
            }
        },
        error: (error) => void error, // ignore errors
        complete: () => {
            peer.disconnect();
            peer.destroy();
        },
    };
}
