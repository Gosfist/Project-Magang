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
    this.router.navigate(['/dashboard']);
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(this.api.post('/auth/logout', {})); } catch { /* Pengguna tetap dapat keluar secara lokal saat koneksi terputus. */ }
    localStorage.removeItem('unzanet_token');
    this.user.set(null);
    this.router.navigate(['/login']);
  }
}
