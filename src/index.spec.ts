import EventEmitter from 'node:events';
import { beforeEach, describe, expect, it, Mocked, vi } from 'vitest';
import { register } from './index.js';
import { firstValueFrom } from 'rxjs';
import type { Peer } from 'peerjs';

vi.mock('peerjs', () => {
    class MockPeerJs extends EventEmitter {
        public static instance: MockPeerJs;

        constructor() {
            super();
            MockPeerJs.instance = this;
        }
    }
    return {
        Peer: MockPeerJs,
    };
});

async function getMockedPeerJsClass() {
    const peerjs = (await import('peerjs')) as unknown as {
        Peer: typeof Peer & { instance?: Mocked<Peer> & EventEmitter };
    };
    return peerjs.Peer;
}

describe('peerxjs', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should return an observable', () => {
        const peerxjs = register();
        expect(peerxjs).toHaveProperty('subscribe', expect.any(Function));
    });

    it('should error if the underlying peer emits an error', async () => {
        const peerxjs = register();
        const shouldError = firstValueFrom(peerxjs);
        const MockPeerJs = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('error', new Error('test'));
        await expect(shouldError).rejects.toThrow('test');
    });

    it('should emit an open event when the underlying peer emits an open event', async () => {
        const peerxjs = register();
        const shouldOpen = firstValueFrom(peerxjs);
        const MockPeerJs = await getMockedPeerJsClass();
        MockPeerJs.instance?.emit('open', 'mockPeerId');
        await expect(shouldOpen).resolves.toEqual({
            type: 'open',
            peerId: 'mockPeerId',
        });
    });
});
