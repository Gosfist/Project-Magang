import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
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
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './accounts.component.html',
})
export class AccountsComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<PppoeAccount[]>([]);
  packages = signal<PppoePackage[]>([]);
  nasOptions = signal<NasOption[]>([]);
  odpOptions = signal<OdpOption[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 5, total: 0 });
  search = '';
  page = signal(1);
  open = signal(false);
  editing = signal<PppoeAccount | null>(null);
  step = signal(1);
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
    this.editing.set(item ?? null);
    this.step.set(1);
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
  }

  nextStep(): void {
    if (this.step() < 3) this.step.set(this.step() + 1);
  }

  prevStep(): void {
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
    const body = {
      ...this.form,
      firstInvoice: this.editing() ? 'none' : this.form.subscriptionType === 'PREPAID' ? 'full' : this.form.firstInvoice,
      password: this.form.password || undefined,
      expiresAt: this.form.expiresAt || undefined,
      latitude: this.form.latitude ? Number(this.form.latitude) : undefined,
      longitude: this.form.longitude ? Number(this.form.longitude) : undefined,
      billingDay: Number(this.form.billingDay),
      discount: Number(this.form.discount),
      routerNasId: this.form.routerNasId ? String(this.form.routerNasId) : undefined,
    };
    const req = this.editing()
      ? this.api.patch<{ message: string; warnings?: string[] }>(`/pppoe/accounts/${this.editing()!.id}`, body)
      : this.api.post<{ message: string; warnings?: string[] }>('/pppoe/accounts', body);
    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
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
