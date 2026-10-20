import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { LandingComponent } from './landing.component';

describe('Landing pricing cards', () => {
  const packages = Array.from({ length: 4 }, (_, i) => ({
    id: String(i + 1), name: `Paket ${i + 1}`, title: `Fiber ${i + 1}`, description: `Untuk kebutuhan paket ${i + 1}.`, price: (i + 1) * 50000,
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
      expect(card.querySelector('h3')?.textContent).toContain(packages[index].title);
      expect(card.querySelector('p')?.textContent).toContain(packages[index].description);
      expect(card.textContent).toContain(packages[index].price.toLocaleString('id-ID'));
      expect([...card.querySelectorAll('dd')].map(dd => dd.textContent?.trim())).toEqual([
        `${packages[index].downloadMbps} Mbps`, 'Tanpa batas', 'Teknis responsif',
      ]);
      expect(card.textContent).not.toContain('999');
    });
    expect(cards.filter(card => card.textContent?.includes('Paling Populer')).length).toBe(1);
  });

  it('opens all mobile links and closes the menu after selecting a section', () => {
    const { fixture, element } = setup();
    const toggle = element.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')!;
    const menu = element.querySelector<HTMLElement>('#mobile-navigation')!;
    expect(menu.hidden).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(menu.hidden).toBeFalse();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const links = [...menu.querySelectorAll('a')];
    expect(links.map(link => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Beranda', '#beranda'], ['Tentang Kami', '#tentang-kami'],
      ['Layanan', '#layanan'], ['Kontak', '#kontak'],
    ]);
    links[2].addEventListener('click', event => event.preventDefault());
    links[2].click();
    fixture.detectChanges();
    expect(menu.hidden).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the mobile menu with its toggle and Escape', () => {
    const { fixture, element } = setup();
    const toggle = element.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')!;
    const menu = element.querySelector<HTMLElement>('#mobile-navigation')!;
    toggle.click();
    fixture.detectChanges();
    toggle.click();
    fixture.detectChanges();
    expect(menu.hidden).toBeTrue();
    toggle.click();
    fixture.detectChanges();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(menu.hidden).toBeTrue();
  });

  for (const width of [375, 640, 1280]) {
    it(`wraps packages into rows without horizontal scrolling at ${width}px`, () => {
      const { element } = setup();
      const frame = document.createElement('iframe');
      frame.style.width = `${width}px`;
      frame.style.height = '900px';
      document.body.appendChild(frame);
      try {
        const frameDocument = frame.contentDocument!;
        const styles = frameDocument.createElement('style');
        styles.textContent = [...document.styleSheets]
          .flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
        frameDocument.head.appendChild(styles);
        frameDocument.body.appendChild(element.cloneNode(true));
        const grid = frameDocument.querySelector<HTMLElement>('.package-grid')!;
        const cards = [...grid.querySelectorAll<HTMLElement>('article')];
        const columns = width >= 768 ? 3 : width >= 640 ? 2 : 1;
        const rectangles = cards.map(card => card.getBoundingClientRect());
        expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth + 1);
        expect(frameDocument.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        expect(rectangles[columns - 1].top).toBe(rectangles[0].top);
        expect(rectangles[columns].top).toBeGreaterThan(rectangles[0].bottom);
        expect(rectangles[columns].left).toBeCloseTo(rectangles[0].left, 0);
      } finally {
        frame.remove();
      }
    });
  }

  it('keeps existing packages readable before a title and description are filled', () => {
    const { element } = setup([{ ...packages[0], title: '', description: '' }]);
    expect(element.querySelector('.package-card h3')?.textContent).toContain('Paket 1');
    expect(element.querySelector('.package-card p')?.textContent).toContain('Internet fiber optik untuk kebutuhan harian Anda.');
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
