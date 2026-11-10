import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { BotWaLogsComponent, WaLogItem } from './bot-wa-logs.component';

describe('Notification detail overlay', () => {
  it('covers the full viewport without inheriting content spacing', () => {
    const log: WaLogItem = { id: 1, target: '085233371015', text: 'Pesan uji', status: 'berhasil', createdAt: '2026-11-10T15:57:52Z' };
    TestBed.configureTestingModule({
      imports: [BotWaLogsComponent],
      providers: [{ provide: HttpClient, useValue: { get: () => of({ logs: [log] }) } }],
    });
    const fixture = TestBed.createComponent(BotWaLogsComponent);
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      fixture.componentInstance.openDetail(log);
      fixture.detectChanges();
      const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
      const overlay = dialog.parentElement!;
      const bounds = overlay.getBoundingClientRect();
      expect(getComputedStyle(overlay).position).toBe('fixed');
      expect(bounds.top).toBe(0);
      expect(bounds.left).toBe(0);
      expect(bounds.bottom).toBe(window.innerHeight);
      expect(bounds.right).toBe(document.documentElement.clientWidth);
      expect(getComputedStyle(overlay).marginBottom).toBe('0px');
    } finally {
      fixture.destroy();
      fixture.nativeElement.remove();
    }
  });
});
