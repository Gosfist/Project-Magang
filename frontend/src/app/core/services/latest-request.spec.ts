import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { latestRequest } from './latest-request';

describe('search request ordering', () => {
  it('ignores an old response and error after a newer search starts', () => {
    const latest = TestBed.runInInjectionContext(() => latestRequest());
    const old = new Subject<string>();
    const current = new Subject<string>();
    const values: string[] = [];
    const error = jasmine.createSpy('error');
    old.pipe(latest).subscribe({ next: value => values.push(value), error });
    current.pipe(latest).subscribe(value => values.push(value));
    current.next('Andi');
    old.next('wrong customer');
    old.error(new Error('old request failed'));
    expect(values).toEqual(['Andi']);
    expect(error).not.toHaveBeenCalled();
  });

  it('keeps independent searches separate and cancels them on destroy', () => {
    const [list, picker] = TestBed.runInInjectionContext(() => [latestRequest(), latestRequest()]);
    const source = new Subject<string>();
    const values: string[] = [];
    source.pipe(list).subscribe(value => values.push('list ' + value));
    source.pipe(picker).subscribe(value => values.push('picker ' + value));
    source.next('first');
    TestBed.resetTestingModule();
    source.next('after destroy');
    expect(values).toEqual(['list first', 'picker first']);
  });
});
