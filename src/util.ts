import { BehaviorSubject, Observable, Observer } from 'rxjs';

export function combineObserverAndObservable<In, Out>(
    observer: Observer<In>,
    observable: Observable<Out>,
): Observer<In> & Observable<Out> {
    const obs = observable as Observer<In> & Observable<Out>;
    obs.next = observer.next.bind(observer);
    obs.error = observer.error.bind(observer);
    obs.complete = observer.complete.bind(observer);
    return obs;
}

export type RequireExactlyOne<
    ObjectType,
    KeysType extends keyof ObjectType = keyof ObjectType,
> = {
    [Key in KeysType]: Required<Pick<ObjectType, Key>> &
        Partial<Record<Exclude<KeysType, Key>, never>>;
}[KeysType] &
    Omit<ObjectType, KeysType>;
type Empty = Record<never, unknown>;
export type OrEmpty<T> = T | Empty;

export function getIterate<T>(
    subject: BehaviorSubject<T>,
): (map: (current: T) => T) => void {
    return (map: (current: T) => T) => {
        const current = subject.getValue();
        subject.next(map(current));
    };
}
