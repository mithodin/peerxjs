import { DataConnection, MediaConnection } from 'peerjs';

export enum PeeRXJSEventType {
    OPEN = 'open',
    CONNECTION = 'connection',
    CALL = 'call',
    DISCONNECTED = 'disconnected',
}

type PeeRXJSEventBase<T extends PeeRXJSEventType> = {
    type: T;
};

export type OpenEvent = PeeRXJSEventBase<PeeRXJSEventType.OPEN> & {
    peerId: string;
};

export type ConnectionEvent = PeeRXJSEventBase<PeeRXJSEventType.CONNECTION> & {
    connection: DataConnection;
};

export type CallEvent = PeeRXJSEventBase<PeeRXJSEventType.CALL> & {
    connection: MediaConnection;
};

export type DisconnectedEvent =
    PeeRXJSEventBase<PeeRXJSEventType.DISCONNECTED> & {
        reconnect: () => void;
    };

export type PeeRXJSEvent =
    | OpenEvent
    | ConnectionEvent
    | CallEvent
    | DisconnectedEvent;
