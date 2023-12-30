import { Observable, Observer, Subject } from 'rxjs';
import { Peer, PeerOptions } from 'peerjs';
import { PeeRXJSEvent, PeeRXJSEventType } from './events.js';
import {
    CallCommand,
    ConnectCommand,
    PeeRXJSCommand,
    PeeRXJSCommandType,
} from './commands.js';
import { combineObserverAndObservable } from './util.js';
import { dataConnection } from './dataConnection.js';
import { mediaConnection } from './mediaConnection.js';

function getPeer(
    id: undefined | string | PeerOptions,
    config: undefined | PeerOptions
) {
    if (id) {
        if (typeof id === 'string') {
            return new Peer(id, config);
        } else {
            return new Peer(id);
        }
    }
    return new Peer();
}

export type PeeRXJSRaw = Observable<PeeRXJSEvent> & Observer<PeeRXJSCommand>;

function setUpEventHandlers(peer: Peer, subject: Subject<PeeRXJSEvent>) {
    peer.on('error', (error) => {
        subject.error(error);
        peer.destroy();
    });
    peer.on('open', (peerId) => {
        subject.next({ type: PeeRXJSEventType.OPEN, peerId });
    });
    peer.on('connection', (connection) => {
        subject.next({
            type: PeeRXJSEventType.CONNECTION,
            connection: dataConnection(connection),
        });
    });
    peer.on('call', (call) => {
        subject.next({
            type: PeeRXJSEventType.CALL,
            answer: (stream) => {
                const connection = mediaConnection(call);
                call.answer(stream);
                return connection;
            },
        });
    });
    peer.on('disconnected', () => {
        subject.next({
            type: PeeRXJSEventType.DISCONNECTED,
            reconnect: () => peer.reconnect(),
        });
    });
    peer.on('close', () => {
        subject.complete();
        peer.destroy();
    });
}

function doWhenOpen(peer: Peer, callback: () => void) {
    if (peer.open) {
        callback();
    } else {
        peer.once('open', () => callback());
    }
}

function connectTo(
    peer: Peer,
    command: ConnectCommand,
    subject: Subject<PeeRXJSEvent>
) {
    doWhenOpen(peer, () => {
        const connection = peer.connect(command.peerId, command.options);
        subject.next({
            type: PeeRXJSEventType.CONNECTION,
            connection: dataConnection(connection),
        });
    });
}

function callPeer(
    peer: Peer,
    command: CallCommand,
    subject: Subject<PeeRXJSEvent>
) {
    doWhenOpen(peer, () => {
        subject.next({
            type: PeeRXJSEventType.CALL,
            answer: (stream) => {
                return mediaConnection(
                    peer.call(command.peerId, stream, command.options)
                );
            },
        });
    });
}

export function register(id?: string, config?: PeerOptions): PeeRXJSRaw;
export function register(config: PeerOptions): PeeRXJSRaw;
export function register(
    id?: string | PeerOptions,
    config?: PeerOptions
): PeeRXJSRaw {
    const subject = new Subject<PeeRXJSEvent>();
    const peer = getPeer(id, config);
    setUpEventHandlers(peer, subject);
    return combineObserverAndObservable<PeeRXJSCommand, PeeRXJSEvent>(
        {
            next: (command) => {
                switch (command.type) {
                    case PeeRXJSCommandType.CONNECT:
                        connectTo(peer, command, subject);
                        break;
                    case PeeRXJSCommandType.CALL:
                        callPeer(peer, command, subject);
                        break;
                }
            },
            error: (error) => void error, // ignore errors
            complete: () => {
                peer.disconnect();
                peer.destroy();
            },
        },
        subject.asObservable()
    );
}
