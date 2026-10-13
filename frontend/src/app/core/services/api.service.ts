import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { from, Observable, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`).pipe(catchError(this.handleError));
  }

  getBlob(path: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { responseType: 'blob' }).pipe(catchError(this.handleError));
  }

  postBlob(path: string, body: unknown): Observable<Blob> {
    return this.http.post(`${this.baseUrl}${path}`, body, { responseType: 'blob' }).pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body).pipe(catchError(this.handleError));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body).pipe(catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.error instanceof Blob) {
      return from(error.error.text()).pipe(mergeMap(text => {
        let message = 'Permintaan gagal diproses.';
        try { const body = JSON.parse(text); message = Array.isArray(body.message) ? body.message[0] : body.message || message; } catch { /* Non-JSON response. */ }
        return throwError(() => new Error(message));
      }));
    }
    let message = 'Permintaan gagal diproses.';
    if (error.error) {
      const body = error.error;
      if (Array.isArray(body.message)) {
        message = body.message[0];
      } else if (body.message) {
        message = body.message;
      }
    }
    return throwError(() => new Error(message));
  }
}
