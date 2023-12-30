import { describe, expect, it, vi } from 'vitest';
import EventEmitter from 'node:events';
import { mediaConnection } from './mediaConnection.js';
import { MediaConnection } from 'peerjs';

describe('media connection', () => {
    class MockMediaConnection extends EventEmitter {
        public open: boolean = false;
        public metadata: unknown = '<undefined>';
        public peer: string = '<undefined>';
        public type: string = '<undefined>';
    }

    it('should wrap a media connection in an observable', () => {
        const connection = mediaConnection(
            new MockMediaConnection() as unknown as MediaConnection
        );
        expect(connection).toHaveProperty('subscribe', expect.any(Function));
    });

    it('should complete the observable when the connection is closed', () => {
        const mockConnection = new MockMediaConnection();
        const connection = mediaConnection(
            mockConnection as unknown as MediaConnection
        );
        const completeSpy = vi.fn();
        connection.subscribe({ complete: completeSpy });
        mockConnection.emit('close');

        expect(completeSpy).toHaveBeenCalled();
    });

    it('should error if the connection emits an error event', () => {
        const mockConnection = new MockMediaConnection();
        const connection = mediaConnection(
            mockConnection as unknown as MediaConnection
        );
        const errorSpy = vi.fn();
        connection.subscribe({ error: errorSpy });
        mockConnection.emit('error', new Error('test'));
        expect(errorSpy).toHaveBeenCalledWith(new Error('test'));
    });

    it('should emit a stream event when the connection emits a stream event', () => {
        const mockConnection = new MockMediaConnection();
        const connection = mediaConnection(
            mockConnection as unknown as MediaConnection
        );
        const streamSpy = vi.fn();
        connection.subscribe({ next: streamSpy });
        const mockStream = {};
        mockConnection.emit('stream', mockStream);
        expect(streamSpy).toHaveBeenCalledWith(mockStream);
    });

    it('should pass on the properties of the underlying MediaConnection', () => {
        const mockConnection = new MockMediaConnection();
        const connection = mediaConnection(
            mockConnection as unknown as MediaConnection
        );
        mockConnection.open = true;
        mockConnection.metadata = 'test-meta';
        mockConnection.peer = 'test-peer';
        mockConnection.type = 'media';

        expect(connection).toHaveProperty('open', true);
        expect(connection).toHaveProperty('metadata', 'test-meta');
        expect(connection).toHaveProperty('peer', 'test-peer');
        expect(connection).toHaveProperty('type', 'media');
    });
});
