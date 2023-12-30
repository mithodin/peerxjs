import { MediaConnection } from 'peerjs';
import { Observable, Subject } from 'rxjs';

const FORWARDED_PROPS = ['metadata', 'open', 'peer', 'type'] satisfies Array<
    keyof MediaConnection
>;

export type PeeRXJSMediaConnection = Observable<MediaStream> &
    Pick<MediaConnection, (typeof FORWARDED_PROPS)[number]>;

export function mediaConnection(
    connection: MediaConnection
): PeeRXJSMediaConnection {
    const subject = new Subject<MediaStream>();
    connection.on('close', () => {
        subject.complete();
    });
    connection.on('error', (error) => {
        subject.error(error);
    });
    connection.on('stream', (stream) => {
        subject.next(stream);
    });
    const wrappedConnection = subject.asObservable() as PeeRXJSMediaConnection;
    FORWARDED_PROPS.forEach((prop) => {
        Object.defineProperty(wrappedConnection, prop, {
            get: () => connection[prop],
        });
    });
    return wrappedConnection;
}
