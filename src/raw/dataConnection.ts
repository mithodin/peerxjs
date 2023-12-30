import { DataConnection } from 'peerjs';
import { Observable, Observer, Subject } from 'rxjs';
import { combineObserverAndObservable } from '../util.js';

const FORWARDED_PROPS = [
    'label',
    'metadata',
    'open',
    'peer',
    'reliable',
    'serialization',
    'type',
    'dataChannel',
    'peerConnection',
] satisfies Array<keyof DataConnection>;
export type PeeRXJSDataConnection = Observable<unknown> &
    Observer<unknown> &
    Pick<DataConnection, (typeof FORWARDED_PROPS)[number]>;

export function dataConnection(
    dataConnection: DataConnection
): PeeRXJSDataConnection {
    const subject = new Subject();
    dataConnection.on('close', () => {
        subject.complete();
    });
    dataConnection.on('error', (error) => {
        subject.error(error);
    });
    dataConnection.on('data', (data) => {
        subject.next(data);
    });
    const connection = combineObserverAndObservable(
        {
            next: (data) => dataConnection.send(data),
            complete: () => dataConnection.close(),
            error: (error) => void error, // ignore errors
        },
        subject.asObservable()
    ) as PeeRXJSDataConnection;
    FORWARDED_PROPS.forEach((prop) => {
        Object.defineProperty(connection, prop, {
            get: () => dataConnection[prop],
        });
    });
    return connection;
}
