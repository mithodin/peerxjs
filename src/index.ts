import { Subject } from 'rxjs';
import { Peer } from 'peerjs';
import { PeeRXJSEvent, PeerXJSEventType } from './types.js';

export function register() {
    const subject = new Subject<PeeRXJSEvent>();
    const peer = new Peer();
    peer.on('error', (error) => {
        subject.error(error);
    });
    peer.on('open', (peerId) => {
        subject.next({ type: PeerXJSEventType.OPEN, peerId });
    });
    return subject;
}
