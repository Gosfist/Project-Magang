import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '../../shared/models/types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  user = signal<User | null>(null);
  profilePhotoUrl = signal('');
  profilePhotoError = signal(false);
  private photoRequest = 0;
  loading = signal<boolean>(true);
  isAdmin = computed(() => this.user()?.role === 'admin');
  isFinance = computed(() => this.user()?.role === 'finance');
  isSales = computed(() => this.user()?.role === 'sales');
  isKolektor = computed(() => this.user()?.role === 'kolektor');
  isTeknisi = computed(() => this.user()?.role === 'teknisi');
  hasRole = (...roles: string[]) => {
    const role = this.user()?.role;
    return role ? roles.includes(role) : false;
  };

  async loadUser(): Promise<void> {
    const token = localStorage.getItem('unzanet_token');
    if (!token) {
      this.loading.set(false);
      return;
    }
    try {
      const result = await firstValueFrom(this.api.get<{ user: User }>('/auth/me'));
      this.user.set(result.user);
      void this.loadProfilePhoto();
    } catch {
      localStorage.removeItem('unzanet_token');
    } finally {
      this.loading.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const result = await firstValueFrom(
      this.api.post<{ user: User; accessToken: string }>('/auth/login', { email, password })
    );
    localStorage.setItem('unzanet_token', result.accessToken);
    this.user.set(result.user);
    void this.loadProfilePhoto();
    this.router.navigate(['/dashboard']);
  }

  async updateProfile(form: { name: string; phone?: string | null; photo?: string | null; password?: string }): Promise<string> {
    const result = await firstValueFrom(this.api.patch<{ message: string; user: User }>('/auth/profile', form));
    this.user.set(result.user);
    void this.loadProfilePhoto();
    return result.message;
  }

  private clearProfilePhoto(): void {
    const previous = this.profilePhotoUrl();
    if (previous.startsWith('blob:')) URL.revokeObjectURL(previous);
    this.profilePhotoUrl.set('');
  }

  profilePhotoFailed(): void {
    this.clearProfilePhoto();
    this.profilePhotoError.set(true);
  }

  async loadProfilePhoto(): Promise<void> {
    const request = ++this.photoRequest;
    this.clearProfilePhoto();
    this.profilePhotoError.set(false);
    const reference = this.user()?.photo;
    if (!reference) return;
    if (/^data:image\/(jpeg|png|webp);base64,/.test(reference)) {
      this.profilePhotoUrl.set(reference);
      return;
    }
    try {
      const blob = await firstValueFrom(this.api.getBlob('/auth/profile/photo'));
      if (request === this.photoRequest) this.profilePhotoUrl.set(URL.createObjectURL(blob));
    } catch {
      if (request === this.photoRequest) this.profilePhotoError.set(true);
    }
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(this.api.post('/auth/logout', {})); } catch { /* Pengguna tetap dapat keluar secara lokal saat koneksi terputus. */ }
    localStorage.removeItem('unzanet_token');
    ++this.photoRequest;
    this.clearProfilePhoto();
    this.profilePhotoError.set(false);
    this.user.set(null);
    this.router.navigate(['/login']);
  }
}
