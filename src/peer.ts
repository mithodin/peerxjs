import { PeeRXJSDataConnection, PeeRXJSMediaConnection } from './raw/index.js';
import { OrEmpty, RequireExactlyOne } from './util.js';

export type WithDataConnection = {
    dataConnection: PeeRXJSDataConnection;
};

export type WithPendingCall = {
    pendingCall: (stream: MediaStream) => void;
};

export type WithMediaConnection = {
    mediaConnection: PeeRXJSMediaConnection;
};

type WithPeerId = {
    peerId: string;
};

export type Peer = WithPeerId &
    OrEmpty<WithDataConnection> &
    OrEmpty<RequireExactlyOne<WithPendingCall & WithMediaConnection>>;
