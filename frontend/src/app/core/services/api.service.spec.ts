import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

describe('authenticated binary downloads', () => {
  it('returns readable backend errors from a failed blob download', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ApiService), http = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(api.postBlob('/settings/backup/router/3/script', { mode: 'local', reconnect: false }));
    const assertion = expectAsync(result).toBeRejectedWithError('Simpan gateway terlebih dahulu.');
    const req = http.expectOne(request => request.url.endsWith('/settings/backup/router/3/script'));
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob([JSON.stringify({ message: 'Simpan gateway terlebih dahulu.' })], { type: 'application/json' }), { status: 400, statusText: 'Bad Request' });
    await assertion; http.verify();
  });
});
