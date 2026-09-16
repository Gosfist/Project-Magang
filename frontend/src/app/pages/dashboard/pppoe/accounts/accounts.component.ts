import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCamera, LucidePencil, LucidePlus, LucideSearch, LucideTrash2, LucideX } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { PppoeAccount, PppoePackage, PageMeta, NasOption, OdpOption } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-pppoe-accounts',
  standalone: true,
  imports: [
    FormsModule,
    LucideCamera,
    LucideX,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.css',
})
export class AccountsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private changeDetector = inject(ChangeDetectorRef);
  editTab = signal<'customer' | 'account'>('customer');

  items = signal<PppoeAccount[]>([]);
  packages = signal<PppoePackage[]>([]);
  nasOptions = signal<NasOption[]>([]);
  odpOptions = signal<OdpOption[]>([]);
  odpOpen = signal(false);
  odpSearch = '';
  nasOpen = signal(false);

  selectedNasName(): string {
    const item = this.nasOptions().find(option => String(option.id) === String(this.form.routerNasId));
    return item ? item.shortname || item.nasname : this.form.routerNasId ? 'Pilihan tidak tersedia' : 'Pilih NAS';
  }

  toggleNas(): void {
    this.odpOpen.set(false);
    this.nasOpen.update(value => !value);
    this.changeDetector.detectChanges();
    if (this.nasOpen()) document.querySelector<HTMLButtonElement>('#nas-options button')?.focus();
  }

  selectNas(id: string): void {
    this.form.routerNasId = String(id);
    this.nasOpen.set(false);
    document.getElementById('nas-picker')?.focus();
  }

  closeNasOnBlur(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) this.nasOpen.set(false);
  }

  filteredOdpOptions(): OdpOption[] {
    const search = this.odpSearch.trim().toLocaleLowerCase();
    return this.odpOptions().filter(item => `${item.namaTitik} ${item.tipeTitik ?? ''} ${item.alamat ?? ''}`.toLocaleLowerCase().includes(search));
  }

  selectedOdpName(): string {
    const item = this.odpOptions().find(option => String(option.id) === String(this.form.odp));
    return item ? `${item.namaTitik} (${(item.tipeTitik || 'odp').toUpperCase()})` : this.form.odp ? 'Pilihan tidak tersedia' : 'Pilih ODC / ODP';
  }

  toggleOdp(): void {
    this.nasOpen.set(false);
    this.odpSearch = '';
    this.odpOpen.update(value => !value);
    this.changeDetector.detectChanges();
    if (this.odpOpen()) document.getElementById('odp-search')?.focus();
  }

  selectOdp(item: OdpOption): void {
    this.form.odp = String(item.id);
    this.odpOpen.set(false);
    document.getElementById('odp-picker')?.focus();
  }

  closeOdpOnBlur(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) this.odpOpen.set(false);
  }
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 5, total: 0 });
  search = '';
  page = signal(1);
  open = signal(false);
  editing = signal<PppoeAccount | null>(null);
  step = signal(1);
  uploading = signal(false);
  saving = signal(false);
  formError = signal('');
  photoPreview = signal('');
  photoLoading = signal(false);
  photoError = signal('');
  private photoRequest = 0;

  private clearPreview(): void {
    if (this.photoPreview()) URL.revokeObjectURL(this.photoPreview());
    this.photoPreview.set('');
    this.photoLoading.set(false);
    this.photoError.set('');
    this.photoRequest++;
  }

  ngOnDestroy(): void { this.clearPreview(); }

  removePhoto(): void {
    if (this.uploading() || this.saving()) return;
    this.clearPreview();
    this.form.idCardPhoto = '';
  }

  private loadPhoto(): void {
    if (!this.form.idCardPhoto) return;
    if (!/^id-cards\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(this.form.idCardPhoto)) {
      this.photoError.set('Foto lama tidak dapat ditampilkan. Pilih gambar untuk menggantinya.');
      return;
    }
    const request = ++this.photoRequest;
    this.photoLoading.set(true);
    this.api.getBlob(`/pppoe/id-card-photo/${encodeURIComponent(this.form.idCardPhoto.slice(9))}`).subscribe({
      next: blob => {
        if (request !== this.photoRequest) return;
        this.photoPreview.set(URL.createObjectURL(blob));
        this.photoLoading.set(false);
      },
      error: () => {
        if (request !== this.photoRequest) return;
        this.photoLoading.set(false);
        this.photoError.set('Preview foto tidak tersedia. Coba buka ulang atau pilih gambar lain.');
      },
    });
  }
  prorateEstimate = signal<{amount: number, daysActive: number, daysInMonth: number, nextBilling: Date} | null>(null);

  form: any = {
    customerName: '', phone: '', idCardNumber: '', idCardPhoto: '', latitude: '', longitude: '', address: '',
    pppoePackageId: '', subscriptionType: 'POSTPAID', billingDay: '1', discount: '0',
    username: '', password: '', routerNasId: '', odp: '',
    expiresAt: '', isActive: true, notes: '', firstInvoice: 'prorate',
  };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
    this.api.get<{ data: PppoePackage[] }>('/pppoe/packages/options').subscribe({
      next: (r) => this.packages.set(r.data),
    });
    this.api.get<{ data: NasOption[] }>('/pppoe/nas/options').subscribe({ next: (r) => this.nasOptions.set(r.data) });
    this.api.get<{ data: OdpOption[] }>('/pppoe/odp/options').subscribe({ next: (r) => this.odpOptions.set(r.data) });
  }

  load(): void {
    this.api
      .get<{ data: PppoeAccount[]; meta: PageMeta }>(
        `/pppoe/accounts?search=${encodeURIComponent(this.search)}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  show(item?: PppoeAccount): void {
    if (this.uploading() || this.saving()) return;
    this.nasOpen.set(false);
    this.odpOpen.set(false);
    this.odpSearch = '';
    this.clearPreview();
    this.formError.set('');
    this.editing.set(item ?? null);
    this.step.set(1);
    this.editTab.set('customer');
    this.form = item
      ? {
          customerName: item.customerName,
          phone: item.phone ?? '',
          idCardNumber: item.idCardNumber ?? '',
          idCardPhoto: item.idCardPhoto ?? '',
          latitude: item.latitude ?? '',
          longitude: item.longitude ?? '',
          address: item.address ?? '',
          pppoePackageId: item.pppoePackageId,
          subscriptionType: item.subscriptionType || 'POSTPAID',
          billingDay: String(item.billingDay || 1),
          discount: String(item.discount || 0),
          username: item.username,
          password: '',
          routerNasId: item.routerNasId ?? '',
          odp: item.odp ?? '',
          expiresAt: item.expiresAt?.slice(0, 10) ?? '',
          isActive: item.isActive,
          notes: item.notes ?? '',
          firstInvoice: 'prorate',
        }
      : {
          customerName: '', phone: '', idCardNumber: '', idCardPhoto: '', latitude: '', longitude: '', address: '',
          pppoePackageId: '', subscriptionType: 'POSTPAID', billingDay: '1', discount: '0',
          username: '', password: '', routerNasId: '', odp: '',
          expiresAt: '', isActive: true, notes: '', firstInvoice: 'prorate',
        };
    this.calculateProrate();
    this.open.set(true);
    this.loadPhoto();
  }

  customerValid(): boolean {
    return ['customerName', 'phone', 'idCardNumber', 'idCardPhoto', 'address'].every(key => String(this.form[key] ?? '').trim())
      && this.form.latitude !== '' && this.form.latitude != null && Number.isFinite(Number(this.form.latitude))
      && this.form.longitude !== '' && this.form.longitude != null && Number.isFinite(Number(this.form.longitude));
  }

  paymentValid(): boolean {
    return !!this.form.pppoePackageId && this.form.billingDay !== '' && Number(this.form.billingDay) >= 1
      && Number(this.form.billingDay) <= 28 && this.form.discount !== '' && Number(this.form.discount) >= 0;
  }

  nextStep(element: HTMLFormElement): void {
    if (this.uploading() || !element.reportValidity()) return;
    if (this.step() === 1 && !this.customerValid()) {
      this.formError.set('Lengkapi seluruh data pelanggan dan unggah foto KTP sebelum melanjutkan.');
      return;
    }
    if (this.step() === 2 && !this.paymentValid()) return;
    this.formError.set('');
    if (this.step() < 3) this.step.set(this.step() + 1);
  }

  uploadPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.formError.set('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.formError.set('Foto KTP harus JPG, PNG, atau WebP, maksimal 5 MB.');
      input.value = '';
      return;
    }
    const body = new FormData();
    body.append('file', file);
    this.uploading.set(true);
    ++this.photoRequest;
    this.photoLoading.set(false);
    this.api.post<{ path: string }>('/pppoe/id-card-photo', body).subscribe({
      next: result => {
        this.clearPreview();
        this.form.idCardPhoto = result.path;
        this.photoPreview.set(URL.createObjectURL(file));
        this.uploading.set(false);
        input.value = '';
      },
      error: error => { this.formError.set(error.message); this.uploading.set(false); input.value = ''; },
    });
  }

  close(): void {
    if (!this.uploading() && !this.saving()) { this.open.set(false); this.clearPreview(); }
  }

  submit(element: HTMLFormElement): void {
    if (!this.editing() && this.step() < 3) { this.nextStep(element); return; }
    if (this.editing()) {
      const invalid = element.querySelector<HTMLElement>('input:invalid, select:invalid, textarea:invalid');
      const panel = invalid?.closest<HTMLElement>('[data-edit-tab]');
      if (panel) {
        this.editTab.set(panel.dataset['editTab'] as 'customer' | 'account');
        this.changeDetector.detectChanges();
      }
    }
    if (element.reportValidity()) this.save();
  }

  prevStep(): void {
    this.formError.set('');
    if (this.step() > 1) this.step.set(this.step() - 1);
  }

  calculateProrate(): void {
    const pkg = this.packages().find(p => String(p.id) === String(this.form.pppoePackageId));
    if (!pkg || this.form.subscriptionType !== 'POSTPAID') { this.prorateEstimate.set(null); return; }
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const bd = Math.min(Math.max(parseInt(this.form.billingDay) || 1, 1), 28);
    let nextBilling: Date;
    if (currentDay < bd) { nextBilling = new Date(year, month, bd); }
    else { nextBilling = new Date(year, month + 1, bd); }
    const msPerDay = 86400000;
    const daysActive = Math.max(1, Math.ceil((nextBilling.getTime() - now.getTime()) / msPerDay));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const discount = parseInt(this.form.discount) || 0;
    const baseAmount = Math.max(0, pkg.price - discount);
    const amount = Math.ceil((daysActive / daysInMonth) * baseAmount);
    this.prorateEstimate.set({ amount, daysActive, daysInMonth, nextBilling });
  }

  save(): void {
    if (this.uploading() || this.saving()) return;
    if (!this.editing() && !this.customerValid()) {
      this.step.set(1);
      this.formError.set('Lengkapi seluruh data pelanggan dan unggah foto KTP.');
      return;
    }
    if (!this.form.pppoePackageId || (!this.editing() && !this.paymentValid())) {
      if (!this.editing()) this.step.set(2);
      this.formError.set('Pilih paket dan lengkapi data pembayaran.');
      return;
    }
    if (!String(this.form.customerName).trim() || !String(this.form.username).trim() || !this.form.odp
      || (!this.editing() && !this.form.password) || (this.form.password && this.form.password.length < 6)) {
      if (!this.form.odp && this.editing()) this.editTab.set('account');
      this.formError.set('Lengkapi nama pelanggan, username, password minimal 6 karakter, dan pilih ODC / ODP.');
      return;
    }
    this.formError.set('');
    this.saving.set(true);
    const body = {
      ...this.form,
      firstInvoice: this.editing() ? 'none' : this.form.subscriptionType === 'PREPAID' ? 'full' : this.form.firstInvoice,
      password: this.form.password || undefined,
      expiresAt: this.form.expiresAt || undefined,
      latitude: this.form.latitude !== '' && this.form.latitude != null ? Number(this.form.latitude) : undefined,
      longitude: this.form.longitude !== '' && this.form.longitude != null ? Number(this.form.longitude) : undefined,
      billingDay: Number(this.form.billingDay),
      discount: Number(this.form.discount),
      routerNasId: this.form.routerNasId ? String(this.form.routerNasId) : undefined,
    };
    const req = this.editing()
      ? this.api.patch<{ message: string; warnings?: string[] }>(`/pppoe/accounts/${this.editing()!.id}`, body)
      : this.api.post<{ message: string; warnings?: string[] }>('/pppoe/accounts', body);
    req.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.open.set(false);
        this.clearPreview();
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => { this.saving.set(false); this.formError.set(e.message); },
    });
  }

  disconnecting = signal<string | null>(null);

  disconnect(item: PppoeAccount): void {
    if (this.disconnecting() || !confirm(`Putuskan sesi ${item.username}? Akun yang masih aktif dapat terhubung kembali.`)) return;
    this.disconnecting.set(String(item.id));
    this.api.post<{ message: string; warnings?: string[] }>(`/pppoe/accounts/${item.id}/disconnect`, {}).subscribe({
      next: (r) => {
        this.disconnecting.set(null);
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
      },
      error: (e) => { this.disconnecting.set(null); this.toast.set({ message: e.message, type: 'error' }); },
    });
  }

  remove(item: PppoeAccount): void {
    if (!confirm(`Hapus akun ${item.username}?`)) return;
    this.api.delete<{ message: string; warnings?: string[] }>(`/pppoe/accounts/${item.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }
}
