import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { latestRequest } from '../../../../core/services/latest-request';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type Rule = Record<string, string>;
const readOnly = new Set(['bytes', 'packets', 'dynamic', 'invalid', 'builtin', 'creation-time', 'last-seen', 'expires-after']);
@Component({ selector: 'app-router-firewall', standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent, PaginationComponent, ToastComponent], templateUrl: './firewall.component.html' })
export class FirewallComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly latest = latestRequest();
  routers = signal<{ id: number; displayName: string }[]>([]);
  rows = signal<Rule[]>([]);
  loading = signal(false); saving = signal(false); error = signal('');
  routerId = 0; family = 'ip'; table = 'filter'; search = ''; page = 1;
  readonly tables = [{ id: 'filter', label: 'Filter' }, { id: 'nat', label: 'NAT' }, { id: 'mangle', label: 'Mangle' }, { id: 'raw', label: 'Raw' }, { id: 'address-list', label: 'Address List' }];
  editorOpen = signal(false); editing: Rule | null = null;
  fields: { key: string; value: string }[] = [];
  confirm = signal<Rule | null>(null); moveTarget = signal<Rule | null>(null); beforeId = 'end';
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit() {
    this.api.get<{ data: { id: number; displayName: string }[] }>('/router/nas/options').subscribe({
      next: result => { this.routers.set(result.data); if (result.data[0]) { this.routerId = result.data[0].id; this.load(); } },
      error: err => this.error.set(err.message),
    });
  }
  path() { return `/router/firewall/${this.routerId}/${this.family}/${this.table}`; }
  load() {
    if (!this.routerId) return;
    this.editorOpen.set(false); this.editing = null; this.confirm.set(null); this.moveTarget.set(null);
    this.loading.set(true); this.error.set(''); this.rows.set([]); this.page = 1;
    this.api.get<{ data: Rule[] }>(this.path()).pipe(this.latest).subscribe({
      next: result => { this.rows.set(result.data); this.loading.set(false); },
      error: err => { this.error.set(err.message); this.loading.set(false); },
    });
  }
  filtered() { const q = this.search.trim().toLowerCase(); return this.rows().filter(row => !q || Object.values(row).some(value => value.toLowerCase().includes(q))); }
  visible() { return this.filtered().slice((this.page - 1) * 25, this.page * 25); }
  meta() { return { currentPage: this.page, lastPage: Math.max(1, Math.ceil(this.filtered().length / 25)), perPage: 25, total: this.filtered().length }; }
  locked(row: Rule) { return row['dynamic'] === 'true' || row['builtin'] === 'true' || row['comment']?.startsWith('UNZANET-ISOLIR:'); }
  disabled(row: Rule) { return ['true', 'yes'].includes(row['disabled']); }
  rowNumber(row: Rule) { return this.rows().indexOf(row); }
  summary(row: Rule) {
    return Object.entries(row).filter(([key, value]) => value && !key.startsWith('.') && !readOnly.has(key) && !['chain', 'action', 'comment', 'disabled'].includes(key))
      .map(([key, value]) => `${key}: ${value}`).join(' · ');
  }
  show(row?: Rule) {
    this.editing = row ?? null;
    const defaults: Record<string, Rule> = {
      filter: { chain: 'forward', action: 'drop', 'src-address': '', 'dst-address': '', protocol: '', 'dst-port': '', comment: '', disabled: 'no' },
      nat: { chain: 'srcnat', action: 'masquerade', 'src-address': '', 'out-interface': '', comment: '', disabled: 'no' },
      mangle: { chain: 'prerouting', action: 'mark-connection', 'new-connection-mark': '', passthrough: 'yes', comment: '', disabled: 'no' },
      raw: { chain: 'prerouting', action: 'drop', 'src-address': '', comment: '', disabled: 'no' },
      'address-list': { list: '', address: '', timeout: 'none-static', comment: '', disabled: 'no' },
    };
    this.fields = Object.entries(row ?? defaults[this.table]).filter(([key]) => !key.startsWith('.') && !readOnly.has(key)).map(([key, value]) => ({ key, value }));
    this.editorOpen.set(true);
  }
  save() {
    if (this.saving()) return;
    const fields: Rule = {};
    for (const entry of this.fields) {
      const key = entry.key.trim();
      if (!key || Object.hasOwn(fields, key)) { this.toast.set({ message: 'Nama properti wajib diisi dan tidak boleh duplikat.', type: 'error' }); return; }
      if (entry.value || this.editing) fields[key] = entry.value;
    }
    if (this.editing) for (const key of Object.keys(this.editing)) if (!key.startsWith('.') && !readOnly.has(key) && !Object.hasOwn(fields, key)) fields[key] = '';
    this.saving.set(true);
    const request = this.editing ? this.api.patch<{ message: string }>(`${this.path()}/${encodeURIComponent(this.editing['.id'])}`, { fields }) : this.api.post<{ message: string }>(this.path(), { fields });
    request.subscribe({ next: result => { this.editorOpen.set(false); this.success(result.message); }, error: err => this.failure(err) });
  }
  toggle(row: Rule) {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.patch<{ message: string }>(`${this.path()}/${encodeURIComponent(row['.id'])}`, { fields: { disabled: this.disabled(row) ? 'no' : 'yes' } })
      .subscribe({ next: result => this.success(result.message), error: err => this.failure(err) });
  }
  remove() {
    const row = this.confirm(); if (!row || this.saving()) return;
    this.saving.set(true);
    this.api.delete<{ message: string }>(`${this.path()}/${encodeURIComponent(row['.id'])}`).subscribe({
      next: result => { this.confirm.set(null); this.success(result.message); }, error: err => this.failure(err),
    });
  }
  move() {
    const row = this.moveTarget(); if (!row || this.saving()) return;
    this.saving.set(true);
    this.api.post<{ message: string }>(`${this.path()}/${encodeURIComponent(row['.id'])}/move`, { beforeId: this.beforeId }).subscribe({
      next: result => { this.moveTarget.set(null); this.success(result.message); }, error: err => this.failure(err),
    });
  }
  private success(message: string) { this.saving.set(false); this.toast.set({ message, type: 'success' }); this.load(); }
  private failure(err: Error) { this.saving.set(false); this.toast.set({ message: err.message, type: 'error' }); }
}
