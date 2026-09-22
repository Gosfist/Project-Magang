import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideEye, LucideEyeOff, LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { User, PageMeta } from '../../../shared/models/types';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    FormsModule,
    LucideEye,
    LucideEyeOff,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<User[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 15, total: 0 });
  search = '';
  role = '';
  status = '';
  page = signal(1);
  open = signal(false);
  editing = signal<User | null>(null);
  showPassword = signal(false);
  form = { name: '', email: '', phone: '', password: '', role: 'teknisi', status: 'active' };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api
      .get<{ data: User[]; meta: PageMeta }>(
        `/users?search=${encodeURIComponent(this.search)}&role=${this.role}&status=${this.status}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  show(user?: User): void {
    this.editing.set(user ?? null);
    this.showPassword.set(false);
    this.form = user
      ? { name: user.name, email: user.email, phone: user.phone ?? '', password: '', role: user.role, status: user.status }
      : { name: '', email: '', phone: '', password: '', role: 'teknisi', status: 'active' };
    this.open.set(true);
  }

  save(): void {
    const body = {
      ...this.form,
      ...(this.editing() && !this.form.password ? { password: undefined } : {}),
    };
    const req = this.editing()
      ? this.api.patch<{ message: string }>(`/users/${this.editing()!.id}`, body)
      : this.api.post<{ message: string }>('/users', body);
    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  remove(user: User): void {
    if (!confirm(`Hapus ${user.name}?`)) return;
    this.api.delete<{ message: string }>(`/users/${user.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  roleLabel(role?: string): string {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'teknisi':
        return 'Teknisi';
      case 'finance':
        return 'Keuangan';
      case 'sales':
        return 'Sales';
      case 'kolektor':
        return 'Kolektor';
      default:
        return role || '';
    }
  }
}
