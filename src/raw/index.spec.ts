import EventEmitter from 'node:events';
import { beforeEach, describe, expect, it, Mocked, vi } from 'vitest';
import { register } from './index.js';
import { filter, firstValueFrom, lastValueFrom, materialize } from 'rxjs';
import type { Peer } from 'peerjs';
import { DisconnectedEvent, PeeRXJSEventType } from './events.js';
import { call, connect } from './commands.js';

vi.mock('peerjs', () => {
    const constructorSpy = vi.fn();
    class MockPeerJs extends EventEmitter {
        public static instance: MockPeerJs;

        constructor(...args: unknown[]) {
            super();
            MockPeerJs.instance = this;
            constructorSpy(...args);
        }

        public readonly reconnect = vi.fn();
        public readonly destroy = vi.fn();
        public readonly connect = vi.fn(() => new EventEmitter());
        public readonly disconnect = vi.fn();
        public open = false;
    }
    return {
        Peer: MockPeerJs,
        constructorSpy,
    };
});

async function getMockedPeerJsClass() {
    return (await import('peerjs')) as unknown as {
        Peer: typeof Peer & { instance?: Mocked<Peer> & EventEmitter };
        constructorSpy: typeof vi.fn;
    };
}

describe('raw peerxjs', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should return an observable', () => {
        const peerxjs = register();
        expect(peerxjs).toHaveProperty('subscribe', expect.any(Function));
    });

    it('should pass on the given peer id to peerjs', async () => {
        register('my-id');
        const { constructorSpy } = await getMockedPeerJsClass();
        expect(constructorSpy).toHaveBeenCalledWith('my-id', undefined);
    });

    it('should pass on the given configuration to peerjs', async () => {
        register({ host: 'test' });
        const { constructorSpy } = await getMockedPeerJsClass();
        expect(constructorSpy).toHaveBeenCalledWith({ host: 'test' });
    });

    it('should pass the peer id and the configuration to peerjs', async () => {
        register('my-id', { host: 'test' });
        const { constructorSpy } = await getMockedPeerJsClass();
        expect(constructorSpy).toHaveBeenCalledWith('my-id', { host: 'test' });
    });

    it('should error if the underlying peer emits an error', async () => {
        const peerxjs = register();
        const shouldError = firstValueFrom(peerxjs);
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('error', new Error('test'));
        await expect(shouldError).rejects.toThrow('test');

        expect(MockPeerJs.instance?.destroy).toHaveBeenCalled();
    });

    it('should emit an open event when the underlying peer emits an open event', async () => {
        const peerxjs = register();
        const shouldOpen = firstValueFrom(peerxjs);
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('open', 'mockPeerId');
        await expect(shouldOpen).resolves.toEqual({
            type: 'open',
            peerId: 'mockPeerId',
        });
    });

    it('should emit a connection event when the underlying peer emits a connection event', async () => {
        const mockConnection = new EventEmitter();
        const peerxjs = register();
        const shouldConnect = firstValueFrom(peerxjs);
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('connection', mockConnection);
        await expect(shouldConnect).resolves.toEqual({
            type: 'connection',
            connection: expect.anything(),
        });
    });

    it('should emit a call event when the underlying peer emits a call event', async () => {
        const mockCall = new EventEmitter();
        const peerxjs = register();
        const shouldCall = firstValueFrom(peerxjs);
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('call', mockCall);
        await expect(shouldCall).resolves.toEqual({
            type: 'call',
            answer: expect.any(Function),
        });
    });

    it('should emit a disconnected event when the underlying peer emits a disconnected event', async () => {
        const peerxjs = register();
        const shouldDisconnect = firstValueFrom(peerxjs);
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('disconnected');
        const { type, reconnect } =
            (await shouldDisconnect) as DisconnectedEvent;
        expect(type).toEqual('disconnected');

        reconnect();
        expect(MockPeerJs.instance?.reconnect).toHaveBeenCalled();
    });

    it('should complete the subject when the underlying peer emits a close event', async () => {
        const peerxjs = register();
        const shouldClose = lastValueFrom(peerxjs.pipe(materialize()));
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('close');
        await expect(shouldClose).resolves.toEqual(
            expect.objectContaining({ kind: 'C' }),
        );

        expect(MockPeerJs.instance?.destroy).toHaveBeenCalled();
    });

    it('should call connect() on the underlying peer if given a connect command', async () => {
        const peerxjs = register();
        peerxjs.next(connect('mock-peer-id', { label: 'my-label' }));
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('open', new EventEmitter());
        expect(MockPeerJs.instance?.connect).toHaveBeenCalledWith(
            'mock-peer-id',
            {
                label: 'my-label',
            },
        );
    });

    it('should emit a connection event when a connection command has been given', async () => {
        const peerxjs = register();
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        (MockPeerJs.instance as any).open = true;
        const shouldConnect = firstValueFrom(
            peerxjs.pipe(
                filter(({ type }) => type === PeeRXJSEventType.CONNECTION),
            ),
        );
        peerxjs.next(connect('mock-peer-id', { label: 'my-label' }));
        await expect(shouldConnect).resolves.toEqual({
            type: 'connection',
            connection: expect.anything(),
            peerId: 'mock-peer-id',
        });
    });

    it('should emit a call event when a call command has been given', async () => {
        const peerxjs = register();
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        (MockPeerJs.instance as any).open = true;
        const shouldCall = firstValueFrom(
            peerxjs.pipe(filter(({ type }) => type === PeeRXJSEventType.CALL)),
        );
        peerxjs.next(call('mock-peer-id', { metadata: 'my-label' }));
        await expect(shouldCall).resolves.toEqual({
            type: 'call',
            answer: expect.any(Function),
            peerId: 'mock-peer-id',
        });
    });

    it('should disconnect and destroy the peer when the command input completes', async () => {
        const peerxjs = register();
        peerxjs.complete();
        const { Peer: MockPeerJs } = await getMockedPeerJsClass();
        expect(MockPeerJs.instance?.disconnect).toHaveBeenCalled();
        expect(MockPeerJs.instance?.destroy).toHaveBeenCalled();
    });
});
