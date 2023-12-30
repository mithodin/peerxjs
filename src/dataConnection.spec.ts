import { describe, expect, it, vi } from 'vitest';
import { dataConnection } from './dataConnection.js';
import EventEmitter from 'node:events';
import type { DataConnection } from 'peerjs';

describe('data connection', () => {
    class MockDataConnection extends EventEmitter {
        public readonly close = vi.fn();
        public readonly send = vi.fn();

        public label: string = '<undefined>';
        public metadata: unknown = '<undefined>';
        public open: boolean = false;
        public peer: string = '<undefined>';
        public reliable: boolean = false;
        public serialization: string = '<undefined>';
        public type: string = '<undefined>';
        public dataChannel: unknown = '<undefined>';
        public peerConnection: unknown = '<undefined>';
    }

    it('should wrap a data connection in an observable', () => {
        const connection = dataConnection(
            new MockDataConnection() as unknown as DataConnection
        );
        expect(connection).toHaveProperty('subscribe', expect.any(Function));
    });

    it('should wrap a data connection in an observer', () => {
        const connection = dataConnection(
            new MockDataConnection() as unknown as DataConnection
        );
        expect(connection).toHaveProperty('next', expect.any(Function));
        expect(connection).toHaveProperty('error', expect.any(Function));
        expect(connection).toHaveProperty('complete', expect.any(Function));
    });

    it('should complete the observable when the connection is closed', () => {
        const mockConnection = new MockDataConnection();
        const connection = dataConnection(
            mockConnection as unknown as DataConnection
        );
        const completeSpy = vi.fn();
        connection.subscribe({ complete: completeSpy });

        mockConnection.emit('close');

        expect(completeSpy).toHaveBeenCalled();
    });

    it('should error if the connection emits an error event', () => {
        const mockConnection = new MockDataConnection();
        const connection = dataConnection(
            mockConnection as unknown as DataConnection
        );
        const errorSpy = vi.fn();
        connection.subscribe({ error: errorSpy });

        mockConnection.emit('error', new Error('test'));

        expect(errorSpy).toHaveBeenCalledWith(new Error('test'));
    });

    it('should emit an event when the connection emits a data event', () => {
        const mockConnection = new MockDataConnection();
        const connection = dataConnection(
            mockConnection as unknown as DataConnection
        );
        const nextSpy = vi.fn();
        connection.subscribe({ next: nextSpy });

        mockConnection.emit('data', 'test');

        expect(nextSpy).toHaveBeenCalledWith('test');
    });

    it('should call close on the connection if the observer is completed', () => {
        const mockConnection = new MockDataConnection();
        const connection = dataConnection(
            mockConnection as unknown as DataConnection
        );

        connection.complete();

        expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should send data to the connection if the observer receives and event', () => {
        const mockConnection = new MockDataConnection();
        const connection = dataConnection(
            mockConnection as unknown as DataConnection
        );

        connection.next('test');

        expect(mockConnection.send).toHaveBeenCalledWith('test');
    });

    it('should pass on the properties of the underlying data connection', () => {
        const mockConnection = new MockDataConnection();
        const connection = dataConnection(
            mockConnection as unknown as DataConnection
        );
        mockConnection.label = 'my-label';
        mockConnection.metadata = 'my-metadata';
        mockConnection.open = true;
        mockConnection.peer = 'other-peer-id';
        mockConnection.reliable = true;
        mockConnection.serialization = 'json';
        mockConnection.type = 'data';
        mockConnection.dataChannel = {};
        mockConnection.peerConnection = {};
        expect(connection).toHaveProperty('label', 'my-label');
        expect(connection).toHaveProperty('metadata', 'my-metadata');
        expect(connection).toHaveProperty('open', true);
        expect(connection).toHaveProperty('peer', 'other-peer-id');
        expect(connection).toHaveProperty('reliable', true);
        expect(connection).toHaveProperty('serialization', 'json');
        expect(connection).toHaveProperty('type', 'data');
        expect(connection).toHaveProperty(
            'dataChannel',
            expect.objectContaining({})
        );
        expect(connection).toHaveProperty(
            'peerConnection',
            expect.objectContaining({})
        );
    });
});
