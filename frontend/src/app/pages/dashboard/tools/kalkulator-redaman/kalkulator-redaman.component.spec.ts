import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { KalkulatorRedamanComponent } from './kalkulator-redaman.component';

describe('optical attenuation calculator', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [KalkulatorRedamanComponent] });
    const fixture = TestBed.createComponent(KalkulatorRedamanComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const change = (element: HTMLInputElement | HTMLSelectElement, value: string, event: string) => {
      element.value = value;
      element.dispatchEvent(new Event(event));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    };
    const input = (index: number, value: string) => change(host.querySelectorAll('input')[index], value, 'input');
    const select = (index: number, value: string) => change(host.querySelectorAll('select')[index], value, 'change');
    const losses = () => Array.from(host.querySelectorAll('.text-xl')).map(el => el.textContent?.trim());
    const output = () => host.querySelector('.text-3xl')?.textContent?.trim();
    return { fixture, host, input, select, losses, output };
  }

  it('calculates the screenshot values after the initial blank render and recalculates later input changes', fakeAsync(() => {
    const { input, losses, output } = setup();
    expect(output()).toBe('- dBm');
    input(0, '5');
    input(1, '500');
    expect(losses()).toEqual(['3,01 dB', '0,175 dB', '1,00 dB']);
    expect(output()).toBe('-0,19 dBm');
    input(1, '1000');
    expect(losses()[1]).toBe('0,350 dB');
    expect(output()).toBe('-0,36 dBm');
    input(0, '-10');
    expect(output()).toBe('-15,36 dBm');
  }));

  it('shows and refreshes asymmetric paths and updates the result when selecting another splitter', fakeAsync(() => {
    const { host, input, select, losses, output } = setup();
    input(0, '5'); input(1, '500');
    select(0, '70:30');
    expect(Array.from(host.querySelectorAll('select')[1].options).map(option => option.value)).toEqual(['70', '30']);
    expect(losses()[0]).toBe('1,55 dB');
    expect(output()).toBe('1,28 dBm');
    select(1, '30');
    expect(losses()[0]).toBe('5,23 dB');
    expect(output()).toBe('-2,40 dBm');
    select(0, '90:10');
    expect(Array.from(host.querySelectorAll('select')[1].options).map(option => option.value)).toEqual(['90', '10']);
    expect(host.querySelectorAll('select')[1].value).toBe('90');
    expect(losses()[0]).toBe('0,46 dB');
    select(0, '1:8');
    expect(host.querySelectorAll('select').length).toBe(1);
    expect(losses()[0]).toBe('9,03 dB');
  }));

  it('recalculates loss settings, treats zero as valid, and clears results for empty or negative loss inputs', fakeAsync(() => {
    const { input, losses, output } = setup();
    input(0, '5'); input(1, '500'); input(2, '3'); input(3, '0.25'); input(4, '0.4');
    expect(losses()).toEqual(['3,01 dB', '0,200 dB', '0,75 dB']);
    expect(output()).toBe('0,04 dBm');
    input(3, '');
    expect(losses()[2]).toBe('- dB');
    expect(output()).toBe('- dBm');
    input(3, '0.25'); input(0, '');
    expect(output()).toBe('- dBm');
    input(0, '0'); input(1, '0');
    expect(losses()[1]).toBe('0,000 dB');
    expect(output()).toBe('-4,76 dBm');
    input(1, '-1');
    expect(losses()[1]).toBe('- dB');
    expect(output()).toBe('- dBm');
    input(1, '');
    expect(output()).toBe('- dBm');
  }));
});
