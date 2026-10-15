import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { PppoePackage } from '../../../../shared/models/types';
import { PaketLayananComponent } from './paket-layanan.component';

describe('Package popular checkbox', () => {
  it('loads the saved checkbox and submits checked and unchecked values', async () => {
    const item: PppoePackage = { id: '2', name: 'Paket', price: 100000, costPrice: 0,
      downloadMbps: 20, uploadMbps: 5, addressPool: null, ipPool: null,
      validityDays: 30, isActive: true, isPopular: true,
      title: 'Fiber Pemula', description: 'Untuk menjelajah internet, belajar, dan penggunaan harian.' };
    const api = {
      get: jasmine.createSpy('get').and.callFake((path: string) => of(path.includes('ip-pools') ? { data: [] } : {
        data: [item], meta: { currentPage: 1, lastPage: 1, perPage: 5, total: 1 },
      })),
      patch: jasmine.createSpy('patch').and.returnValue(of({ message: 'Disimpan' })),
    };
    TestBed.configureTestingModule({ imports: [PaketLayananComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(PaketLayananComponent);
    fixture.detectChanges();
    fixture.componentInstance.show(item);
    fixture.detectChanges();
    await fixture.whenStable();
    const title = fixture.nativeElement.querySelector('input[name="title"]') as HTMLInputElement;
    const description = fixture.nativeElement.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
    expect(title.value).toBe(item.title!);
    expect(description.value).toBe(item.description!);
    title.value = 'Fiber Keluarga';
    title.dispatchEvent(new Event('input'));
    description.value = 'Nyaman untuk menonton video dan bekerja.';
    description.dispatchEvent(new Event('input'));
    const checkbox = fixture.nativeElement.querySelector('input[name="isPopular"]') as HTMLInputElement;
    expect(checkbox.checked).toBeTrue();
    checkbox.click();
    fixture.detectChanges();
    fixture.componentInstance.save();
    expect(api.patch).toHaveBeenCalledWith('/pppoe/packages/2', jasmine.objectContaining({
      isPopular: false, name: 'Paket', title: 'Fiber Keluarga', description: 'Nyaman untuk menonton video dan bekerja.',
    }));
    fixture.componentInstance.show({ ...item, isPopular: false });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('input[name="isPopular"]').click();
    fixture.detectChanges();
    fixture.componentInstance.save();
    expect(api.patch).toHaveBeenCalledWith('/pppoe/packages/2', jasmine.objectContaining({ isPopular: true }));
    fixture.componentInstance.show();
    expect(fixture.componentInstance.form.title).toBe('');
    expect(fixture.componentInstance.form.description).toBe('');
  });
});
