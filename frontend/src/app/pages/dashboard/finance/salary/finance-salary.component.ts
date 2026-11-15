import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { AttendancePolicy, AttendanceReport, PayrollProfile, PayrollReport, PayrollRow } from '../../../../shared/models/payroll';
@Component({
  host: { class: 'workspace-page' },
  selector: 'app-finance-salary', standalone: true, imports: [FormsModule, CommonModule, ModalComponent],
  templateUrl: './finance-salary.component.html',
})
export class FinanceSalaryComponent implements OnInit {
  private api = inject(ApiService);
  private confirmation = inject(ConfirmationService);
  private request = 0;
  loading = signal(true); loaded = signal(false); saving = signal(false); error = signal(''); message = signal('');
  rates = { psb: 0, sales: 0 };
  tab = signal('employees');
  private todayWib() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date()); }
  month = this.todayWib().slice(0, 7);
  attendanceDate = this.todayWib();
  attendanceUser = '';
  report = signal<PayrollReport | null>(null);
  attendance = signal<AttendanceReport | null>(null);
  policy: AttendancePolicy = { checkInStart: '08:00', lateAfter: '08:15', checkOutTime: '17:00', autoCheckoutTime: '17:15' };
  profileOpen = signal(false);
  selectedName = '';
  profile: PayrollProfile = this.blankProfile('');
  leave = { userId: '', date: this.todayWib(), note: '' };
  ngOnInit() { this.load(); }
  blankProfile(userId: string): PayrollProfile { return { userId, effectiveFrom: this.month + '-01', absenceTrackingFrom: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date()), salaryType: 'MONTHLY', amount: 0, maxLeave: 4, excessLeaveCut: false, excessLeaveAmount: 0, lateCut: false, lateAmount: 0, earlyCut: false, earlyAmount: 0 }; }
  load() {
    const request = ++this.request;
    this.loading.set(true); this.error.set(''); this.loaded.set(false); this.report.set(null); this.attendance.set(null);
    const month = encodeURIComponent(this.month);
    forkJoin({ rates: this.api.get<typeof this.rates>('/finance/salary'), report: this.api.get<PayrollReport>('/finance/payroll?month=' + month), policy: this.api.get<AttendancePolicy>('/finance/payroll/policy?month=' + month), attendance: this.api.get<AttendanceReport>(`/finance/payroll/attendance?month=${month}&date=${encodeURIComponent(this.attendanceDate)}&userId=${encodeURIComponent(this.attendanceUser)}`) }).subscribe({
      next: data => { if (request !== this.request) return; this.rates = data.rates; this.report.set(data.report); this.policy = data.policy; this.attendance.set(data.attendance); this.loaded.set(true); this.loading.set(false); },
      error: e => { if (request !== this.request) return; this.loading.set(false); this.error.set(e.message); },
    });
  }
  changeMonth() { const today = this.todayWib(); this.attendanceDate = this.month === today.slice(0, 7) ? today : ''; this.load(); }
  money(value: number) { return 'Rp ' + value.toLocaleString('id-ID'); }
  time(value: string | null) { return value ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '-'; }
  day(value: string) { return value.slice(0, 10); }
  save() {
    if (!this.loaded() || this.saving()) return;
    this.mutate('/finance/salary', this.rates, true);
  }
  edit(row: PayrollRow) { this.selectedName = row.user.name; this.profile = { ...this.blankProfile(row.user.id), ...(row.profile ?? {}), userId: row.user.id, effectiveFrom: this.month + '-01' }; this.profile.absenceTrackingFrom = this.profile.absenceTrackingFrom.slice(0, 10); this.profileOpen.set(true); }
  saveProfile() { this.mutate('/finance/payroll/profiles', this.profile); }
  savePolicy() { this.mutate('/finance/payroll/policy?month=' + encodeURIComponent(this.month), this.policy, true); }
  saveLeave() { this.mutate('/finance/payroll/leaves', this.leave); }
  async removeLeave(id: string) {
    if (this.saving() || !await this.confirmation.ask('Hapus Catatan Libur', 'Hapus catatan libur ini? Hari tanpa absen tetap dihitung tidak hadir sesuai jadwal.')) return;
    this.saving.set(true);
    this.api.delete<{message: string}>('/finance/payroll/leaves/' + id).subscribe({ next: r => { this.saving.set(false); this.message.set(r.message); this.load(); }, error: e => { this.saving.set(false); this.error.set(e.message); } });
  }
  private mutate(path: string, body: unknown, patch = false) {
    if (this.saving()) return;
    this.error.set(''); this.message.set(''); this.saving.set(true);
    const request = patch ? this.api.patch<{message: string}>(path, body) : this.api.post<{message: string}>(path, body);
    request.subscribe({ next: r => { this.saving.set(false); this.profileOpen.set(false); this.message.set(r.message); this.load(); }, error: e => { this.saving.set(false); this.error.set(e.message); } });
  }
}
