import { PeeRXJSDataConnection } from './dataConnection.js';
import { PeeRXJSMediaConnection } from './mediaConnection.js';

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
    connection: PeeRXJSDataConnection;
};

export type CallEvent = PeeRXJSEventBase<PeeRXJSEventType.CALL> & {
    answer: (stream: MediaStream) => PeeRXJSMediaConnection;
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
