import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
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
export class UsersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  items = signal<User[]>([]);
  photoUrls = signal<Record<string, string>>({});
  private photoSubscriptions = new Subscription();
  private listSubscription?: Subscription;
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 15, total: 0 });
  search = '';
  role = '';
  status = '';
  page = signal(1);
  open = signal(false);
  editing = signal<User | null>(null);
  showPassword = signal(false);
  form = { name: '', email: '', phone: '', photo: '', password: '', role: 'teknisi', status: 'active', additionalRoles: [] as string[] };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.listSubscription?.unsubscribe();
    this.listSubscription = this.api
      .get<{ data: User[]; meta: PageMeta }>(
        `/users?search=${encodeURIComponent(this.search)}&role=${this.role}&status=${this.status}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
          this.loadPhotos(r.data);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  private loadPhotos(users: User[]): void {
    this.clearPhotos();
    for (const user of users) {
      if (!user.photo) continue;
      if (/^data:image\/(jpeg|png|webp);base64,/.test(user.photo)) {
        this.photoUrls.update(urls => ({ ...urls, [user.id]: user.photo! }));
        continue;
      }
      this.photoSubscriptions.add(this.api.getBlob(`/users/${encodeURIComponent(user.id)}/photo`).subscribe({
        next: blob => this.photoUrls.update(urls => ({ ...urls, [user.id]: URL.createObjectURL(blob) })),
        error: () => { /* Keep the initial avatar if the file is unavailable. */ },
      }));
    }
  }

  formPhotoUrl(): string {
    if (!this.form.photo) return '';
    if (this.form.photo.startsWith('data:image/')) return this.form.photo;
    return this.photoUrls()[this.editing()?.id ?? ''] ?? '';
  }

  private clearPhotos(): void {
    this.photoSubscriptions.unsubscribe();
    this.photoSubscriptions = new Subscription();
    for (const url of Object.values(this.photoUrls())) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    this.photoUrls.set({});
  }

  ngOnDestroy(): void {
    this.listSubscription?.unsubscribe();
    this.clearPhotos();
  }

  show(user?: User): void {
    this.editing.set(user ?? null);
    this.showPassword.set(false);
    this.form = user
      ? { name: user.name, email: user.email, phone: user.phone ?? '', photo: user.photo ?? '', password: '', role: user.role, status: user.status, additionalRoles: [...(user.additionalRoles ?? [])] }
      : { name: '', email: '', phone: '', photo: '', password: '', role: 'teknisi', status: 'active', additionalRoles: [] as string[] };
    this.open.set(true);
  }

  choosePhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      this.toast.set({ message: 'Foto wajib JPG, PNG, atau WebP.', type: 'error' });
      input.value = '';
      return;
    }
    if (file.size > 2_000_000) {
      this.toast.set({ message: 'Foto maksimal 2 MB.', type: 'error' });
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.form = { ...this.form, photo: String(reader.result || '') };
    };
    reader.readAsDataURL(file);
  }

  clearPhoto(): void {
    this.form = { ...this.form, photo: '' };
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

  readonly accessOptions = ['sales', 'kolektor', 'finance', 'teknisi'];
  accessChecked(role: string): boolean {
    return this.form.role === 'admin' || this.form.role === role || this.form.additionalRoles.includes(role);
  }
  toggleAccess(role: string, event: Event): void {
    if (this.form.role === 'admin' || this.form.role === role) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.form.additionalRoles = checked ? [...new Set([...this.form.additionalRoles, role])]
      : this.form.additionalRoles.filter(item => item !== role);
  }

  roleLabel(role?: string): string {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'teknisi':
        return 'Teknisi';
      case 'finance':
        return 'Finance';
      case 'sales':
        return 'Sales';
      case 'kolektor':
        return 'Kolektor';
      default:
        return role || '';
    }
  }
}
