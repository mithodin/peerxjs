import { Observable, Observer } from 'rxjs';

export function combineObserverAndObservable<In, Out>(
    observer: Observer<In>,
    observable: Observable<Out>
): Observer<In> & Observable<Out> {
    return {
        // inputs
        next: observer.next.bind(observer),
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer),
        // outputs
        lift: observable.lift.bind(observable),
        operator: observable.operator,
        source: observable.source,
        forEach: observable.forEach.bind(observable),
        pipe: observable.pipe.bind(observable),
        toPromise: observable.toPromise.bind(observable),
        subscribe: observable.subscribe.bind(observable),
    };
}
