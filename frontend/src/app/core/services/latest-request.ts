import { DestroyRef, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

/** One independent list/search per instance; discard superseded HTTP responses. */
export function latestRequest() {
  let active: Subscription | undefined;
  inject(DestroyRef).onDestroy(() => active?.unsubscribe());
  return <T>(source: Observable<T>): Observable<T> => new Observable<T>(subscriber => {
    active?.unsubscribe();
    active = source.subscribe(subscriber);
    return active;
  });
}
