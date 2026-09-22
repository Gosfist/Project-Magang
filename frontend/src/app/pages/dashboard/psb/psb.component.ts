import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Area, NasOption, OdpOption, PageMeta, PppoePackage, PsbOrder } from '../../../shared/models/types';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-psb', standalone: true, imports: [FormsModule, ModalComponent, PaginationComponent, ToastComponent],
  templateUrl: './psb.component.html',
})
export class PsbComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  items = signal<PsbOrder[]>([]); packages = signal<PppoePackage[]>([]); areas = signal<Area[]>([]); odps = signal<OdpOption[]>([]); routers = signal<NasOption[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 }); page = signal(1); search = ''; status = '';
  formOpen = signal(false); activationOpen = signal(false); activationStep = signal(1); editing = signal<PsbOrder | null>(null); selected = signal<PsbOrder | null>(null);
  odpPickerOpen = false; odpSearch = ''; activationViewOnly = false;
  form = { customerName: '', phone: '', idCardNumber: '', idCardPhoto: '', latitude: '', longitude: '', address: '', pppoePackageId: '', areaId: '' };
  activation = { username: '', password: '', odp: '', routerNasId: '', installationPhoto: '' };
  saving = signal(false); toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit() { this.load(); this.loadOptions(); }
  load() { this.api.get<{ data: PsbOrder[]; meta: PageMeta }>(`/psb?search=${encodeURIComponent(this.search)}&status=${this.status}&page=${this.page()}`).subscribe({ next: r => { this.items.set(r.data); this.meta.set(r.meta); }, error: e => this.error(e) }); }
  loadOptions() {
    this.api.get<{ data: PppoePackage[] }>('/pppoe/packages/options').subscribe(r => this.packages.set(r.data.filter(x => x.isActive)));
    this.api.get<{ data: Area[] }>('/areas/options').subscribe(r => this.areas.set(r.data));
    this.api.get<{ data: OdpOption[] }>('/pppoe/odp/options').subscribe(r => this.odps.set(r.data));
    this.api.get<{ data: NasOption[] }>('/pppoe/nas/options').subscribe(r => this.routers.set(r.data));
  }
  openForm(item?: PsbOrder) { this.editing.set(item || null); this.form = item ? { customerName: item.customerName, phone: item.phone, idCardNumber: item.idCardNumber || '', idCardPhoto: item.idCardPhoto || '', latitude: item.latitude?.toString() || '', longitude: item.longitude?.toString() || '', address: item.address, pppoePackageId: item.pppoePackageId, areaId: item.areaId || '' } : { customerName: '', phone: '', idCardNumber: '', idCardPhoto: '', latitude: '', longitude: '', address: '', pppoePackageId: '', areaId: '' }; this.formOpen.set(true); }
  chooseKtp(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) return this.toast.set({ message: 'Foto KTP maksimal 5 MB.', type: 'error' }); const reader = new FileReader(); reader.onload = () => this.form.idCardPhoto = String(reader.result); reader.readAsDataURL(file); }
  save() { this.saving.set(true); const req = this.editing() ? this.api.patch<any>(`/psb/${this.editing()!.id}`, this.form) : this.api.post<any>('/psb', this.form); req.subscribe({ next: r => { this.saving.set(false); this.formOpen.set(false); this.toast.set({ message: r.message, type: 'success' }); this.load(); }, error: e => { this.saving.set(false); this.error(e); } }); }
  remove(item: PsbOrder) { if (!confirm(`Hapus registrasi ${item.customerName}?`)) return; this.api.delete<any>(`/psb/${item.id}`).subscribe({ next: r => { this.toast.set({ message: r.message, type: 'success' }); this.load(); }, error: e => this.error(e) }); }
  openActivation(item: PsbOrder, viewOnly = false) { this.selected.set(item); this.activationViewOnly = viewOnly; this.activationStep.set(1); this.odpPickerOpen = false; this.odpSearch = ''; this.activation = { username: item.username || item.customerId, password: item.customerId, odp: item.odp || '', routerNasId: item.routerNasId?.toString() || '', installationPhoto: item.installationPhoto || '' }; const selectedOdp = this.odps().find(o => o.id === this.activation.odp); this.odpSearch = selectedOdp ? selectedOdp.namaTitik + ' (' + selectedOdp.tipeTitik.toUpperCase() + ')' : ''; this.activationOpen.set(true); }
  filteredOdps() { const query = this.odpSearch.trim().toLocaleLowerCase(); return this.odps().filter(item => `${item.namaTitik} ${item.tipeTitik} ${item.alamat || ''}`.toLocaleLowerCase().includes(query)); }
  selectOdp(item: OdpOption) { this.activation.odp = item.id; this.odpSearch = `${item.namaTitik} (${item.tipeTitik.toUpperCase()})`; this.odpPickerOpen = false; }
  choosePhoto(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) return this.toast.set({ message: 'Foto maksimal 5 MB.', type: 'error' }); const reader = new FileReader(); reader.onload = () => this.activation.installationPhoto = String(reader.result); reader.readAsDataURL(file); }
  activate() { if (!this.activation.installationPhoto) return this.toast.set({ message: 'Foto instalasi wajib dipilih.', type: 'error' }); this.saving.set(true); this.api.post<any>(`/psb/${this.selected()!.id}/activate`, this.activation).subscribe({ next: r => { this.saving.set(false); this.activationOpen.set(false); this.toast.set({ message: r.message, type: 'success' }); this.load(); }, error: e => { this.saving.set(false); this.error(e); } }); }
  complete(item: PsbOrder) { if (!confirm(`Tandai pemasangan ${item.customerName} selesai dan kirim notifikasi WA?`)) return; this.api.post<any>(`/psb/${item.id}/complete`, {}).subscribe({ next: r => { this.toast.set({ message: r.message, type: 'success' }); this.load(); }, error: e => this.error(e) }); }
  statusLabel(value: string) { return value === 'COMPLETED' ? 'Selesai' : 'Proses'; }
  private error(e: any) { this.toast.set({ message: e.message || 'Terjadi kesalahan.', type: 'error' }); }
}
