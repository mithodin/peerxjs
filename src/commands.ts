import { CallOption, PeerConnectOption } from 'peerjs';

export enum PeeRXJSCommandType {
    CONNECT = 'connect',
    CALL = 'call',
}

type PeeRXJSCommandBase<T extends PeeRXJSCommandType> = {
    type: T;
};

export type ConnectCommand = PeeRXJSCommandBase<PeeRXJSCommandType.CONNECT> & {
    peerId: string;
    options?: PeerConnectOption;
};

export type CallCommand = PeeRXJSCommandBase<PeeRXJSCommandType.CALL> & {
    peerId: string;
    options?: CallOption;
};

export type PeeRXJSCommand = ConnectCommand | CallCommand;

export function connect(
    peerId: string,
    options?: PeerConnectOption
): ConnectCommand {
    return {
        type: PeeRXJSCommandType.CONNECT,
        peerId,
        options,
    };
}

export function call(peerId: string, options?: CallOption): CallCommand {
    return {
        type: PeeRXJSCommandType.CALL,
        peerId,
        options,
    };
}
