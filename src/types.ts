export enum PeerXJSEventType {
    OPEN = 'open',
}

type PeeRXJSEventBase<T extends PeerXJSEventType> = {
    type: T;
};

export type OpenEvent = PeeRXJSEventBase<PeerXJSEventType.OPEN> & {
    peerId: string;
};

export type PeeRXJSEvent = OpenEvent;
