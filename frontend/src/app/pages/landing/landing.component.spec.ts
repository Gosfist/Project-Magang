import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { LandingComponent } from './landing.component';

describe('Landing pricing cards', () => {
  const packages = Array.from({ length: 4 }, (_, i) => ({
    id: String(i + 1), name: `Paket ${i + 1}`, price: (i + 1) * 50000,
    downloadMbps: (i + 1) * 10, uploadMbps: 999, isPopular: i === 1,
  }));

  function setup(data = packages) {
    const get = jasmine.createSpy('get').and.returnValue(of({ data }));
    TestBed.configureTestingModule({ imports: [LandingComponent], providers: [{ provide: ApiService, useValue: { get } }] });
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    return { fixture, get, element: fixture.nativeElement as HTMLElement };
  }

  it('renders the real price and download speed with fixed data limit and support on every card', () => {
    const { element, get } = setup();
    expect(get).toHaveBeenCalledWith('/public/packages');
    const cards = [...element.querySelectorAll('.package-card')];
    expect(cards.length).toBe(4);
    cards.forEach((card, index) => {
      expect(card.querySelector('h3')?.textContent).toContain(packages[index].name);
      expect(card.textContent).toContain(packages[index].price.toLocaleString('id-ID'));
      expect([...card.querySelectorAll('dd')].map(dd => dd.textContent?.trim())).toEqual([
        `${packages[index].downloadMbps} Mbps`, 'Tanpa batas', 'Teknis responsif',
      ]);
      expect(card.textContent).not.toContain('999');
    });
    expect(cards.filter(card => card.textContent?.includes('Paling Populer')).length).toBe(1);
  });

  it('shows navigation above three packages and moves by one card in either direction', () => {
    const { fixture, element } = setup();
    const track = element.querySelector<HTMLElement>('.package-track')!;
    const scroll = spyOn(track, 'scrollBy');
    const right = element.querySelector<HTMLButtonElement>('[aria-label="Geser paket ke kanan"]')!;
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Geser paket ke kiri"]')!.disabled).toBeTrue();
    right.click();
    expect(scroll.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ left: jasmine.any(Number) }));
    expect((scroll.calls.mostRecent().args[0] as ScrollToOptions).left!).toBeGreaterThan(0);
    fixture.componentInstance.canScrollLeft.set(true);
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('[aria-label="Geser paket ke kiri"]')!.click();
    expect((scroll.calls.mostRecent().args[0] as ScrollToOptions).left!).toBeLessThan(0);
  });

  it('fits the responsive card count and overflows for remaining packages', () => {
    const { element } = setup();
    const track = element.querySelector<HTMLElement>('.package-track')!;
    const visibleCount = matchMedia('(min-width: 768px)').matches ? 3 : matchMedia('(min-width: 640px)').matches ? 2 : 1;
    const cards = [...track.querySelectorAll<HTMLElement>('article')];
    expect(track.scrollWidth).toBeGreaterThan(track.clientWidth);
    expect(cards[visibleCount - 1].getBoundingClientRect().right).toBeLessThanOrEqual(track.getBoundingClientRect().right + 1);
    expect(cards[visibleCount].getBoundingClientRect().right).toBeGreaterThan(track.getBoundingClientRect().right);
  });

  it('hides navigation when there are only three packages', () => {
    const { element } = setup(packages.slice(0, 3));
    expect(element.querySelector('.package-arrow')).toBeNull();
  });

  it('shows an empty state without example prices', () => {
    const { element } = setup([]);
    expect(element.textContent).toContain('Paket internet belum tersedia.');
    expect(element.querySelector('.package-card')).toBeNull();
  });

  it('shows a retry after API failure and loads the actual packages on retry', () => {
    const get = jasmine.createSpy('get').and.returnValues(throwError(() => new Error('offline')), of({ data: packages }));
    TestBed.configureTestingModule({ imports: [LandingComponent], providers: [{ provide: ApiService, useValue: { get } }] });
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.package-card').length).toBe(4);
  });
});
