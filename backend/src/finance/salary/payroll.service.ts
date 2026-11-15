import { BadRequestException, ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { serialize } from '../../common/serialize.js';
import { accessRoles } from '../../auth/access-roles.js';
import { AttendancePolicyDto, EmployeeLeaveDto, PayrollProfileDto } from './payroll.dto.js';
import { attendanceWage, clockOn, dateKey, dateOnly, defaultAttendanceRule, type AttendanceRule } from './payroll-calculation.js';
import { salaryMonth } from './finance-salary.service.js';

export function payrollMonth(value?: string) {
  const month = value || dateKey(new Date()).slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Periode harus YYYY-MM antara tahun 2000 dan 2099.');
  const [year, number] = month.split('-').map(Number);
  return { month, first: `${month}-01`, days: new Date(Date.UTC(year, number, 0)).getUTCDate(), period: salaryMonth(year, number) };
}
export function validDay(value: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value) || !Number.isFinite(dateOnly(value).getTime()) || dateOnly(value).toISOString().slice(0, 10) !== value) throw new BadRequestException('Tanggal tidak valid.');
  return dateOnly(value);
}
function id(value: string) {
  if (!/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > 18446744073709551615n) throw new BadRequestException('ID karyawan tidak valid.');
  return BigInt(value);
}
@Injectable()
export class PayrollService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  private logger = new Logger(PayrollService.name);
  onModuleInit() {
    this.timer = setInterval(() => { void this.autoClose().catch(() => this.logger.error('Checkout otomatis gagal; akan dicoba kembali.')); }, 60000);
    this.timer.unref();
    void this.autoClose().catch(() => this.logger.error('Checkout otomatis awal belum dapat dijalankan.'));
  }
  onModuleDestroy() { clearInterval(this.timer); }
  async autoClose(now = new Date()) {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const rows = await this.prisma.employeeAttendance.findMany({ where: { checkOut: null, autoCheckoutAt: { lte: now } }, take: 1000, orderBy: { autoCheckoutAt: 'asc' } });
      for (const row of rows) await this.prisma.employeeAttendance.updateMany({ where: { id: row.id, checkOut: null }, data: { checkOut: row.autoCheckoutAt, checkoutSource: 'AUTO' } });
    } finally { this.sweeping = false; }
  }
  async policy(monthInput?: string): Promise<AttendanceRule> {
    const { month } = payrollMonth(monthInput);
    const rows = await this.prisma.appSetting.findMany({ where: { key: { startsWith: 'attendance_policy_', lte: `attendance_policy_${month}` } }, orderBy: { key: 'desc' }, take: 1 });
    return rows[0] ? { ...defaultAttendanceRule, ...JSON.parse(rows[0].value || '{}') } : { ...defaultAttendanceRule };
  }
  async savePolicy(monthInput: string, dto: AttendancePolicyDto) {
    const { month } = payrollMonth(monthInput);
    if (!(dto.checkInStart <= dto.lateAfter && dto.lateAfter < dto.checkOutTime && dto.checkOutTime <= dto.autoCheckoutTime)) throw new BadRequestException('Urutan jam harus masuk <= batas terlambat < pulang <= checkout otomatis, pada hari yang sama.');
    const key = `attendance_policy_${month}`, value = JSON.stringify(dto);
    await this.prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return { message: 'Jadwal disimpan. Absensi yang sudah masuk tetap memakai jadwal saat check-in.' };
  }
  async saveProfile(dto: PayrollProfileDto) {
    const { first } = payrollMonth(dto.effectiveFrom.slice(0, 7));
    if (dto.effectiveFrom !== first) throw new BadRequestException('Gaji berlaku mulai tanggal 1 pada periode yang dipilih.');
    const userId = id(dto.userId);
    if (!await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new BadRequestException('Karyawan tidak ditemukan.');
    const { userId: _, effectiveFrom: __, ...rest } = dto;
    const data = { ...rest, absenceTrackingFrom: validDay(dto.absenceTrackingFrom), amount: BigInt(dto.amount), excessLeaveAmount: BigInt(dto.excessLeaveAmount), lateAmount: BigInt(dto.lateAmount), earlyAmount: BigInt(dto.earlyAmount) };
    await this.prisma.employeePayrollProfile.upsert({ where: { userId_effectiveFrom: { userId, effectiveFrom: dateOnly(first) } }, create: { userId, effectiveFrom: dateOnly(first), ...data }, update: data });
    return { message: 'Gaji karyawan disimpan mulai periode ' + first.slice(0, 7) + '.' };
  }
  async attendance(monthInput?: string, date?: string, userInput?: string) {
    await this.autoClose();
    const { first, days } = payrollMonth(monthInput);
    const start = date ? validDay(date) : dateOnly(first), end = date ? start : dateOnly(first.slice(0, 8) + String(days));
    const where = { workDate: { gte: start, lte: end }, ...(userInput ? { userId: id(userInput) } : {}) };
    const [data, total, leaves] = await Promise.all([
      this.prisma.employeeAttendance.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: [{ workDate: 'desc' }, { checkIn: 'asc' }], take: 1000 }),
      this.prisma.employeeAttendance.count({ where }),
      this.prisma.employeeLeave.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { workDate: 'desc' }, take: 1000 }),
    ]);
    return serialize({ data, total, leaves });
  }
  async recordLeave(dto: EmployeeLeaveDto, actor: string) {
    const userId = id(dto.userId), workDate = validDay(dto.date);
    if (!await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new BadRequestException('Karyawan tidak ditemukan.');
    await this.atomic(async tx => {
      if (await tx.employeeAttendance.findUnique({ where: { userId_workDate: { userId, workDate } } })) throw new ConflictException('Tanggal ini sudah memiliki absensi. Tidak bisa dicatat sebagai libur.');
      await tx.employeeLeave.upsert({ where: { userId_workDate: { userId, workDate } }, create: { userId, workDate, note: dto.note, recordedByUserId: id(actor) }, update: { note: dto.note, recordedByUserId: id(actor) } });
    });
    return { message: 'Libur dicatat oleh Finance.' };
  }
  async removeLeave(leaveId: string) {
    await this.prisma.employeeLeave.deleteMany({ where: { id: id(leaveId) } });
    return { message: 'Catatan libur dihapus. Hari tanpa absen tetap dihitung tidak hadir jika termasuk hari kerja.' };
  }
  async self(userInput: string) {
    await this.autoClose();
    const now = new Date(), today = dateKey(now), userId = id(userInput), policy = await this.policy(today.slice(0, 7));
    const [attendance, leave] = await Promise.all([
      this.prisma.employeeAttendance.findUnique({ where: { userId_workDate: { userId, workDate: dateOnly(today) } } }),
      this.prisma.employeeLeave.findUnique({ where: { userId_workDate: { userId, workDate: dateOnly(today) } } }),
    ]);
    const working = policy.workDays.split(',').includes(String(dateOnly(today).getUTCDay()));
    return serialize({ today, serverNow: now, policy, attendance, leave, canCheckIn: !attendance && !leave && working && now >= clockOn(today, policy.checkInStart) && now < clockOn(today, policy.checkOutTime), canCheckOut: !!attendance && !attendance.checkOut && now < attendance.autoCheckoutAt });
  }
  async checkIn(userInput: string) {
    const userId = id(userInput), now = new Date(), today = dateKey(now), workDate = dateOnly(today), policy = await this.policy(today.slice(0, 7));
    if (now < clockOn(today, policy.checkInStart)) throw new BadRequestException('Belum waktunya absen masuk. Mulai pukul ' + policy.checkInStart + ' WIB.');
    if (now >= clockOn(today, policy.checkOutTime)) throw new BadRequestException('Waktu absen masuk hari ini sudah berakhir.');
    if (!policy.workDays.split(',').includes(String(workDate.getUTCDay()))) throw new BadRequestException('Hari ini bukan hari kerja.');
    await this.atomic(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (user?.status !== 'active') throw new BadRequestException('Akun karyawan tidak aktif.');
      if (await tx.employeeLeave.findUnique({ where: { userId_workDate: { userId, workDate } } })) throw new ConflictException('Hari ini sudah dicatat libur oleh Finance.');
      await tx.employeeAttendance.create({ data: { userId, workDate, checkIn: now, scheduledStart: clockOn(today, policy.checkInStart), scheduledEnd: clockOn(today, policy.checkOutTime), autoCheckoutAt: clockOn(today, policy.autoCheckoutTime), isLate: now > clockOn(today, policy.lateAfter) } });
    });
    return { message: 'Absen masuk tercatat.' };
  }
  async checkOut(userInput: string) {
    const userId = id(userInput), now = new Date(), today = dateOnly(dateKey(now));
    const row = await this.prisma.employeeAttendance.findUnique({ where: { userId_workDate: { userId, workDate: today } } });
    if (!row) throw new BadRequestException('Belum absen masuk hari ini.');
    if (row.checkOut) throw new ConflictException('Absen pulang sudah tercatat.');
    if (now < row.checkIn) throw new BadRequestException('Jam server sedang disesuaikan. Coba kembali setelah waktu masuk.');
    const automatic = now >= row.autoCheckoutAt;
    const result = await this.prisma.employeeAttendance.updateMany({ where: { id: row.id, checkOut: null }, data: { checkOut: automatic ? row.autoCheckoutAt : now, checkoutSource: automatic ? 'AUTO' : 'MANUAL' } });
    if (!result.count) throw new ConflictException('Absen pulang sudah tercatat.');
    return { message: 'Absen pulang tercatat.' };
  }
  private async atomic(action: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    try { return await this.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new ConflictException('Data sedang diubah atau absensi sudah tercatat. Muat ulang dan coba lagi.');
      throw error;
    }
  }
  async summary(monthInput?: string, onlyUser?: string) {
    const { month, first, days, period } = payrollMonth(monthInput), now = new Date();
    const userWhere = onlyUser ? { id: id(onlyUser) } : {};
    const users = await this.prisma.user.findMany({ where: userWhere, select: { id: true, name: true, role: true, additionalRoles: true, status: true, createdAt: true }, orderBy: { name: 'asc' } });
    const ids = users.map(u => u.id);
    const [profiles, records, leaves, orders, policy, rates] = await Promise.all([
      this.prisma.employeePayrollProfile.findMany({ where: { userId: { in: ids }, effectiveFrom: { lte: dateOnly(first) } }, orderBy: { effectiveFrom: 'desc' } }),
      this.prisma.employeeAttendance.findMany({ where: { userId: { in: ids }, workDate: { gte: dateOnly(first), lte: dateOnly(`${month}-${days}`) } } }),
      this.prisma.employeeLeave.findMany({ where: { userId: { in: ids }, workDate: { gte: dateOnly(first), lte: dateOnly(`${month}-${days}`) } } }),
      this.prisma.psbOrder.findMany({ where: { status: 'COMPLETED', completedAt: period }, select: { id: true, salesUserId: true, salesCommission: true, installationFeePaid: true, completedByUserId: true, team: { select: { userId: true, bonusAmount: true } } } }),
      this.policy(month), this.prisma.appSetting.findMany({ where: { key: { in: ['biaya_psb', 'gaji_sales'] } } }),
    ]);
    const rate = new Map(rates.map(r => [r.key, BigInt(r.value || '0')]));
    const data = users.map(user => {
      const profile = profiles.find(p => p.userId === user.id) ?? null;
      const start = user.createdAt ? dateKey(user.createdAt) : first;
      const activeFrom = start > first ? start : first;
      const attendance = records.filter(r => r.userId === user.id && r.workDate.toISOString().slice(0,10) >= activeFrom);
      const leaveDates = new Set(leaves.filter(r => r.userId === user.id).map(r => r.workDate.toISOString().slice(0, 10)));
      const present = new Set(attendance.map(r => r.workDate.toISOString().slice(0, 10)));
      let leaveDays = 0, eligibleDays = 0;
      for (let day = 1; day <= days; day++) {
        const key = `${month}-${String(day).padStart(2, '0')}`;
        if (key < activeFrom) continue;
        eligibleDays++;
        if (clockOn(key, policy.autoCheckoutTime) > now || present.has(key)) continue;
        const workDay = policy.workDays.split(',').includes(String(dateOnly(key).getUTCDay()));
        if (leaveDates.has(key) || (profile && key >= profile.absenceTrackingFrom.toISOString().slice(0, 10) && workDay && accessRoles(user).includes('teknisi'))) leaveDays++;
      }
      const wage = attendanceWage(profile ?? { salaryType: 'MONTHLY', amount: 0n, maxLeave: 0, excessLeaveCut: false, excessLeaveAmount: 0n, lateCut: false, lateAmount: 0n, earlyCut: false, earlyAmount: 0n }, attendance, leaveDays, eligibleDays, days, now);
      let psbBonus = 0n, salesSalary = 0n, psbCount = 0;
      for (const order of orders) {
        if (order.salesUserId === user.id) salesSalary += order.salesCommission ?? rate.get('gaji_sales') ?? 0n;
        const member = order.team.find(t => t.userId === user.id);
        if (member) { psbBonus += member.bonusAmount; psbCount++; }
        else if (!order.team.length && order.completedByUserId === user.id) { psbBonus += order.installationFeePaid ?? rate.get('biaya_psb') ?? 0n; psbCount++; }
      }
      const numeric = Object.fromEntries(Object.entries(wage).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value])) as { [K in keyof typeof wage]: number };
      return { user, profile: profile ? { ...profile, amount: Number(profile.amount), excessLeaveAmount: Number(profile.excessLeaveAmount), lateAmount: Number(profile.lateAmount), earlyAmount: Number(profile.earlyAmount) } : null, ...numeric, psbCount, psbBonus: Number(psbBonus), salesSalary: Number(salesSalary), total: Number(wage.netWage + psbBonus + salesSalary) };
    });
    return serialize({ month, data, total: data.reduce((sum, row) => sum + row.total, 0), calculatedAt: now });
  }
}
