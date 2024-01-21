import {
    beforeEach,
    describe,
    expect,
    it,
    MockedFunction,
    MockedObject,
    vi,
} from 'vitest';
import {
    type PeeRXJSCommand,
    PeeRXJSDataConnection,
    type PeeRXJSEvent,
    PeeRXJSEventType,
    PeeRXJSMediaConnection,
    type PeeRXJSRaw,
    register,
} from './raw/index.js';
import { PeeRXJS } from './highLevel.js';
import { first, firstValueFrom, Observer, Subject } from 'rxjs';
import { combineObserverAndObservable } from './util.js';
import { Peer, WithDataConnection, WithPendingCall } from './peer.js';

function expectHasPendingCall(
    peer: Peer,
): asserts peer is Peer & WithPendingCall {
    expect((peer as unknown as WithPendingCall).pendingCall).toEqual(
        expect.any(Function),
    );
}

function expectHasDataConnection(
    peer: Peer,
): asserts peer is Peer & WithDataConnection {
    expect((peer as unknown as WithDataConnection).dataConnection).toEqual(
        expect.any(Object),
    );
}

vi.mock('./raw/index.js', async () => {
    const { PeeRXJSEventType } = await vi.importActual('./raw/events.js');
    return {
        register: vi.fn(),
        PeeRXJSEventType,
    };
});

describe('PeeRXJS', () => {
    let mockPeeRXJSRawEvents: Subject<PeeRXJSEvent>;
    let mockPeeRXJSRawCommands: MockedObject<Observer<PeeRXJSCommand>>;

    beforeEach(() => {
        mockPeeRXJSRawEvents = new Subject();
        mockPeeRXJSRawCommands = {
            next: vi.fn(),
            error: vi.fn(),
            complete: vi.fn(),
        };

        const mockPeeRXJSRaw = combineObserverAndObservable(
            mockPeeRXJSRawCommands,
            mockPeeRXJSRawEvents.asObservable(),
        );

        (register as MockedFunction<() => PeeRXJSRaw>).mockReturnValue(
            mockPeeRXJSRaw,
        );
    });

    it('should construct and be in the connecting state', async () => {
        const peerxjs = new PeeRXJS({});
        expect(peerxjs).toBeDefined();

        await expect(firstValueFrom(peerxjs.state)).resolves.toEqual({
            type: 'connecting',
        });
    });

    it('should switch to the open state when the raw peer emits an open event', async () => {
        const peerxjs = new PeeRXJS({});
        const openEvent = firstValueFrom(
            peerxjs.state.pipe(first(({ type }) => type === 'open')),
        );

        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.OPEN,
            peerId: 'test-peer-id',
        });

        await expect(openEvent).resolves.toEqual({
            type: 'open',
            peerId: 'test-peer-id',
        });
    });

    it('should switch to the closed state when the raw peer completes', async () => {
        const peerxjs = new PeeRXJS({});
        const closeEvent = firstValueFrom(
            peerxjs.state.pipe(first(({ type }) => type === 'closed')),
        );

        mockPeeRXJSRawEvents.complete();

        await expect(closeEvent).resolves.toEqual({
            type: 'closed',
            reopen: expect.any(Function),
        });

        expect(mockPeeRXJSRawCommands.complete).toHaveBeenCalledTimes(1);
    });

    it('should switch to the error state when the raw peer errors', async () => {
        const peerxjs = new PeeRXJS({});
        const errorEvent = firstValueFrom(
            peerxjs.state.pipe(first(({ type }) => type === 'error')),
        );

        mockPeeRXJSRawEvents.error(new Error('test-error'));

        await expect(errorEvent).resolves.toEqual({
            type: 'error',
            error: expect.any(Error),
            reopen: expect.any(Function),
        });
    });

    it('should automatically reconnect when the raw peer emits a disconnected event', async () => {
        const peerxjs = new PeeRXJS({});
        const openEvent = firstValueFrom(
            peerxjs.state.pipe(first(({ type }) => type === 'open')),
        );

        const reconnect = vi.fn(() => {
            mockPeeRXJSRawEvents.next({
                type: PeeRXJSEventType.OPEN,
                peerId: 'test-new-peer-id',
            });
        });
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.DISCONNECTED,
            reconnect,
        });

        await expect(openEvent).resolves.toEqual({
            type: 'open',
            peerId: 'test-new-peer-id',
        });

        expect(reconnect).toHaveBeenCalledTimes(1);
    });

    it('should have a list of peers', async () => {
        const peerxjs = new PeeRXJS({});
        const peerList = await firstValueFrom(peerxjs.peers);
        expect(peerList).toEqual([]);
    });

    it('should add a peer with a data connection when the raw peer emits a connection event', async () => {
        const peerxjs = new PeeRXJS({});
        const mockConnection = { peer: 'test-peer' } as PeeRXJSDataConnection;
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.CONNECTION,
            connection: mockConnection,
            peerId: 'test-peer',
        });

        const peerList = await firstValueFrom(peerxjs.peers.pipe());

        expect(peerList).toEqual([
            expect.objectContaining({
                peerId: 'test-peer',
                dataConnection: mockConnection,
            }),
        ]);
    });

    it('should add a peer with an answerable call if the raw peer emits a call event', async () => {
        const peerxjs = new PeeRXJS({});
        const mockMediaConnection = {} as PeeRXJSMediaConnection;
        const answer = vi.fn(() => mockMediaConnection);
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.CALL,
            answer,
            peerId: 'test-peer',
        });

        const peerList = await firstValueFrom(peerxjs.peers);

        expect(peerList).toEqual([
            expect.objectContaining({
                pendingCall: expect.any(Function),
            }),
        ]);
    });

    it('should add a media connection to the peer when the pending call is called', async () => {
        const peerxjs = new PeeRXJS({});
        const mockMediaConnection = {} as PeeRXJSMediaConnection;
        const answer = vi.fn(() => mockMediaConnection);
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.CALL,
            answer,
            peerId: 'test-peer',
        });

        const [peer] = await firstValueFrom(peerxjs.peers);
        expectHasPendingCall(peer!);

        peer.pendingCall({} as MediaStream);

        const [newPeer] = await firstValueFrom(peerxjs.peers);
        expect(newPeer).toHaveProperty('mediaConnection', mockMediaConnection);
    });

    it('should add a data connection to a peer who already has a pending call', async () => {
        const peerxjs = new PeeRXJS({});
        const mockMediaConnection = {} as PeeRXJSMediaConnection;
        const answer = vi.fn(() => mockMediaConnection);
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.CALL,
            answer,
            peerId: 'test-peer',
        });

        const mockConnection = {} as PeeRXJSDataConnection;
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.CONNECTION,
            connection: mockConnection,
            peerId: 'test-peer',
        });

        const [peer] = await firstValueFrom(peerxjs.peers);
        expectHasPendingCall(peer!);
        expectHasDataConnection(peer!);
    });

    it('should add a pending call to a peer who already has a data connection', async () => {
        const peerxjs = new PeeRXJS({});
        const mockConnection = {} as PeeRXJSDataConnection;
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.CONNECTION,
            connection: mockConnection,
            peerId: 'test-peer',
        });

        const mockMediaConnection = {} as PeeRXJSMediaConnection;
        const answer = vi.fn(() => mockMediaConnection);
        mockPeeRXJSRawEvents.next({
            type: PeeRXJSEventType.CALL,
            answer,
            peerId: 'test-peer',
        });

        const [peer] = await firstValueFrom(peerxjs.peers);
        expectHasDataConnection(peer!);
        expectHasPendingCall(peer!);
    });

    it('should have a destroy function that stops the subscription of the raw peer', async () => {
        const peerxjs = new PeeRXJS({});

        expect(mockPeeRXJSRawEvents.observed).toBe(true);

        peerxjs.destroy();

        expect(mockPeeRXJSRawEvents.observed).toBe(false);
        expect(mockPeeRXJSRawCommands.complete).toHaveBeenCalledTimes(1);
    });
});
