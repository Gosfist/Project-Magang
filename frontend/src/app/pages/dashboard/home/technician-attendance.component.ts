import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AttendancePolicy, AttendanceRow, PayrollReport, PayrollRow } from '../../../shared/models/payroll';
type TodayAttendance = { today: string; serverNow: string; policy: AttendancePolicy; attendance: AttendanceRow | null; leave: {note: string} | null; canCheckIn: boolean; canCheckOut: boolean };
@Component({
  selector: 'app-technician-attendance', standalone: true,
  template: `
    <section class="card p-5 space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-semibold">Absensi Hari Ini</h2><p class="text-sm text-slate-500">{{ today()?.today || 'Memuat...' }} / Waktu Indonesia Barat</p></div><button class="btn-secondary" type="button" (click)="load()" [disabled]="busy()">Muat Ulang</button></div>
      @if (error()) {<p role="alert" class="text-sm text-red-600">{{ error() }}</p>}
      @if (message()) {<p role="status" class="text-sm text-emerald-700">{{ message() }}</p>}
      @if (today(); as data) {
        <p class="text-sm text-slate-500">Masuk mulai {{ data.policy.checkInStart }} / Batas tepat waktu {{ data.policy.lateAfter }} / Pulang {{ data.policy.checkOutTime }} / Checkout otomatis {{ data.policy.autoCheckoutTime }}</p>
        <div class="grid gap-4 sm:grid-cols-2"><div class="rounded-lg bg-slate-50 p-4"><p class="text-sm text-slate-500">Absen masuk</p><p class="text-xl font-semibold">{{ time(data.attendance?.checkIn) }}</p>@if (data.attendance?.isLate) {<p class="text-sm text-amber-700">Terlambat</p>}</div><div class="rounded-lg bg-slate-50 p-4"><p class="text-sm text-slate-500">Absen pulang</p><p class="text-xl font-semibold">{{ time(data.attendance?.checkOut) }}</p>@if (data.attendance?.checkoutSource === 'AUTO') {<p class="text-sm text-slate-500">Dicatat otomatis oleh server</p>}</div></div>
        @if (data.leave) {<p class="text-sm text-slate-600">Hari ini dicatat libur oleh Finance. {{ data.leave.note }}</p>}
        <div class="flex flex-wrap gap-3"><button class="btn-primary" type="button" [disabled]="busy() || !data.canCheckIn" (click)="submit('check-in')">Absen Masuk</button><button class="btn-secondary" type="button" [disabled]="busy() || !data.canCheckOut" (click)="submit('check-out')">Absen Pulang</button></div>
        <p class="text-xs text-slate-500">Tidak bisa absen sebelum jam masuk. Absen pulang boleh lebih awal; potongan mengikuti pengaturan gaji Finance.</p>
      }
      @if (salary(); as row) {<div class="border-t border-slate-200 pt-4 space-y-1"><h3 class="font-semibold">Rincian Gaji dan Bonus Bulan Ini</h3><p class="text-sm">Gaji pokok {{ money(row.base) }} / Potongan {{ money(row.deduction) }} / Bonus PSB {{ money(row.psbBonus) }}</p><p class="text-sm text-slate-500">{{ row.presentDays }} hari masuk / {{ row.leaveDays }} hari libur/tidak hadir / Jatah libur {{ row.profile?.maxLeave ?? 0 }} hari</p><p class="font-semibold">Total {{ money(row.total) }}</p></div>}
    </section>
  `,
})
export class TechnicianAttendanceComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private timer?: ReturnType<typeof setInterval>;
  private request = 0;
  today = signal<TodayAttendance | null>(null); salary = signal<PayrollRow | null>(null);
  busy = signal(false); error = signal(''); message = signal('');
  ngOnInit() { this.load(); this.timer = setInterval(() => { if (!document.hidden && !this.busy()) this.load(); }, 30000); }
  ngOnDestroy() { clearInterval(this.timer); }
  load() {
    const request = ++this.request;
    forkJoin({ today: this.api.get<TodayAttendance>('/employee/attendance'), salary: this.api.get<PayrollReport>('/employee/attendance/salary') }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: r => { if (request !== this.request) return; this.today.set(r.today); this.salary.set(r.salary.data[0] ?? null); this.error.set(''); }, error: e => { if (request !== this.request) return; this.today.set(null); this.salary.set(null); this.error.set(e.message); } });
  }
  submit(action: string) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.api.post<{message: string}>('/employee/attendance/' + action, {}).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: r => { this.message.set(r.message); this.load(); }, error: e => { this.error.set(e.message); } });
  }
  time(value?: string | null) { return value ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '-'; }
  money(value: number) { return 'Rp ' + value.toLocaleString('id-ID'); }
}
