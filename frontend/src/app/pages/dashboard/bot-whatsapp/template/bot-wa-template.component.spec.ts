import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { BotWaTemplateComponent } from './bot-wa-template.component';
describe('termination WhatsApp template editor', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [BotWaTemplateComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(BotWaTemplateComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne(
        (req) => req.method === 'GET' && req.url.endsWith('/templates'),
      )
      .flush({
        termination_approved:
          'Halo {nama}, prorata {prorata}, total {total_tagihan}',
        termination_completed: 'Diambil {nama_petugas}, dibayar {jumlah}',
      });
    return { fixture, component: fixture.componentInstance, http };
  }
  it('shows both templates with icons and renders the approval preview', () => {
    const { fixture, component, http } = setup();
    component.selectTemplate('termination_approved');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Berhenti Langganan');
    expect(host.textContent).toContain('Perangkat Diambil');
    expect(host.querySelector('svg[lucideUserRoundX]')).not.toBeNull();
    expect(component.preview).toContain('Rp30.000');
    expect(component.preview).toContain('Rp130.000');
    expect(component.preview).not.toContain('{prorata}');
    http.verify();
  });
  it('saves both template keys to the existing bot endpoint', () => {
    const { component, http } = setup();
    component.templatesData['termination_approved'] =
      'Permintaan {nomor_pelanggan} disetujui, total {total_tagihan}';
    component.save();
    const request = http.expectOne(
      (req) => req.method === 'PATCH' && req.url.endsWith('/templates'),
    );
    expect(request.request.body.termination_approved).toContain('disetujui');
    expect(request.request.body.termination_completed).toContain(
      '{nama_petugas}',
    );
    request.flush({ message: 'Tersimpan', data: request.request.body });
    expect(component.saving()).toBeFalse();
    http.verify();
  });
});
