import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attendanceWage, clockOn, dateOnly, dateKey, defaultAttendanceRule, divideBonus, type WageProfile } from './payroll-calculation.js';
import { PayrollService, payrollMonth, validDay } from './payroll.service.js';
import { EmployeeAttendanceController, PayrollController } from './payroll.controller.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
const profile: WageProfile = { salaryType: 'MONTHLY', amount: 3000000n, maxLeave: 4, excessLeaveCut: true, excessLeaveAmount: 100000n, lateCut: true, lateAmount: 25000n, earlyCut: false, earlyAmount: 0n };
const row = (day = '2026-11-01', end = '17:00') => ({ id: 1n, userId: 7n, workDate: dateOnly(day), checkIn: clockOn(day, '08:00'), checkOut: clockOn(day, end), scheduledStart: clockOn(day, '08:00'), scheduledEnd: clockOn(day, '17:00'), autoCheckoutAt: clockOn(day, '17:15'), isLate: false });
const now = clockOn('2026-11-15', '18:00');
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('Payroll amounts and bonus allocation', () => {
  it('deducts only excess leave, respects each toggle, and never takes deductions from PSB bonus', () => {
    const records = [{ ...row(), isLate: true }];
    const result = attendanceWage(profile, records, 6, 30, 30, now);
    expect(result).toMatchObject({ base: 3000000n, leaveCut: 200000n, lateCut: 25000n, netWage: 2775000n, excessDays: 2 });
    expect(attendanceWage({ ...profile, excessLeaveCut: false, lateCut: false }, records, 6, 30, 30, now).netWage).toBe(3000000n);
    expect(attendanceWage({ ...profile, amount: 100n }, records, 31, 30, 30, now).netWage).toBe(0n);
  });
  it('does not pay absent daily workers and prorates only the early checkout portion', () => {
    const daily = { ...profile, salaryType: 'DAILY', amount: 100000n, lateCut: false };
    expect(attendanceWage(daily, [], 15, 30, 30, now).netWage).toBe(0n);
    const result = attendanceWage(daily, [row('2026-11-01', '12:30')], 15, 30, 30, now);
    expect(result).toMatchObject({ base: 100000n, earlyCut: 50000n, leaveCut: 0n, netWage: 50000n });
    expect(attendanceWage(daily, [{ ...row(), checkIn: clockOn('2026-11-01', '10:00'), isLate: true }], 0, 30, 30, now).netWage).toBe(100000n);
  });
  it('does not treat an ongoing shift as an early departure and uses saved auto-checkout time', () => {
    const daily = { ...profile, salaryType: 'DAILY', amount: 100000n };
    expect(attendanceWage(daily, [{ ...row(), checkOut: null }], 0, 30, 30, clockOn('2026-11-01','12:00')).earlyCut).toBe(0n);
    expect(attendanceWage(daily, [{ ...row(), checkOut: null }], 0, 30, 30, now).earlyCut).toBe(0n);
    expect(attendanceWage(profile, [], 0, 15, 30, now).base).toBe(3000000n);
    expect(attendanceWage(profile, [], 0, 0, 30, now).base).toBe(0n);
  });
  it('divides a PSB fee across three distinct members with no lost or duplicated rupiah', () => {
    const shares = divideBonus(100000n, [9n, 7n, 8n, 7n]);
    expect(shares).toEqual([{ userId: 7n, bonusAmount: 33334n }, { userId: 8n, bonusAmount: 33333n }, { userId: 9n, bonusAmount: 33333n }]);
    expect(shares.reduce((sum, m) => sum + m.bonusAmount, 0n)).toBe(100000n);
    expect(divideBonus(0n, [7n])[0].bonusAmount).toBe(0n);
  });
  it('uses WIB month boundaries and rejects malformed dates', () => {
    expect(dateKey(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11-01');
    expect(payrollMonth('2026-02').days).toBe(28);
    expect(validDay('2028-02-29')).toEqual(dateOnly('2028-02-29'));
    for (const date of ['2026-02-30','2026-11-31','abc']) expect(() => validDay(date)).toThrow();
    expect(() => payrollMonth('2026-13')).toThrow();
  });
});
function fixture() {
  const db: any = {
    appSetting: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([{id:7n,name:'Teknisi',role:'teknisi',additionalRoles:null,status:'active',createdAt:dateOnly('2026-01-01')}]), findUnique: vi.fn().mockResolvedValue({ status: 'active' }) },
    employeeAttendance: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(), updateMany: vi.fn().mockResolvedValue({count:1}) },
    employeeLeave: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    employeePayrollProfile: { findMany: vi.fn().mockResolvedValue([{...profile,id:1n,userId:7n,effectiveFrom:dateOnly('2026-11-01'),absenceTrackingFrom:dateOnly('2026-11-01')}]) },
    psbOrder: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fn: any) => fn(db)),
  };
  return { db, service: new PayrollService(db) };
}
describe('Attendance server enforcement and payroll report', () => {
  it('rejects early attendance and allows Sunday check-in at opening time', async () => {
    vi.useFakeTimers();vi.setSystemTime(clockOn('2026-11-15','07:59'));
    const {service,db}=fixture();await expect(service.checkIn('7')).rejects.toThrow('Belum waktunya');expect(db.employeeAttendance.create).not.toHaveBeenCalled();
    vi.setSystemTime(clockOn('2026-11-15','08:00'));await service.checkIn('7');
    expect(db.employeeAttendance.create).toHaveBeenCalledTimes(1);
  });
  it('records real server time, snapshots shift settings, and blocks check-in on recorded leave', async () => {
    vi.useFakeTimers();vi.setSystemTime(clockOn('2026-11-15','08:16'));
    const {service,db}=fixture();await service.checkIn('7');
    expect(db.employeeAttendance.create.mock.calls[0][0].data).toMatchObject({userId:7n,isLate:true,checkIn:clockOn('2026-11-15','08:16'),autoCheckoutAt:clockOn('2026-11-15','17:15')});
    db.employeeLeave.findUnique.mockResolvedValue({id:1n});await expect(service.checkIn('7')).rejects.toThrow('dicatat libur');
  });
  it('permits early manual checkout and prevents a second checkout', async () => {
    vi.useFakeTimers();vi.setSystemTime(clockOn('2026-11-15','12:00'));
    const {service,db}=fixture();db.employeeAttendance.findUnique.mockResolvedValue({...row('2026-11-15'),checkOut:null});await service.checkOut('7');
    expect(db.employeeAttendance.updateMany).toHaveBeenCalledWith({where:{id:1n,checkOut:null},data:{checkOut:clockOn('2026-11-15','12:00'),checkoutSource:'MANUAL'}});
    db.employeeAttendance.updateMany.mockResolvedValue({count:0});await expect(service.checkOut('7')).rejects.toThrow('sudah tercatat');
  });
  it('recovers missed checkout after server downtime using the scheduled time and a conditional update', async () => {
    const {service,db}=fixture();db.employeeAttendance.findMany.mockResolvedValue([{...row(),checkOut:null}]);await service.autoClose(now);
    expect(db.employeeAttendance.updateMany).toHaveBeenCalledWith({where:{id:1n,checkOut:null},data:{checkOut:clockOn('2026-11-01','17:15'),checkoutSource:'AUTO'}});
  });
  it('counts elapsed missing days once, combines team bonus and sales commission, and preserves older PSB rows', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);const {service,db}=fixture();
    db.employeeAttendance.findMany.mockResolvedValue([row('2026-11-01'),row('2026-11-02'),row('2026-11-03')]);
    db.employeeLeave.findMany.mockResolvedValue([{userId:7n,workDate:dateOnly('2026-11-04')}]);
    db.psbOrder.findMany.mockResolvedValue([{salesUserId:7n,salesCommission:50000n,completedByUserId:8n,installationFeePaid:100000n,team:[{userId:7n,bonusAmount:33334n}]},{salesUserId:8n,salesCommission:50000n,completedByUserId:7n,installationFeePaid:100000n,team:[]}]);
    const result=await service.summary('2026-11','7');expect(result.data[0]).toMatchObject({leaveDays:12,excessDays:8,psbBonus:133334,salesSalary:50000,total:2383334});
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({id:7n});
  });
  it('keeps each employee leave allowance and deductions separate in the Finance total', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);const {service,db}=fixture();
    const users=[{id:7n,name:'Teknisi A',role:'teknisi',additionalRoles:null,status:'active',createdAt:dateOnly('2026-01-01')},{id:8n,name:'Teknisi B',role:'teknisi',additionalRoles:null,status:'active',createdAt:dateOnly('2026-01-01')}];
    db.user.findMany.mockResolvedValue(users);
    const profiles=[{...profile,userId:7n,effectiveFrom:dateOnly('2026-11-01'),absenceTrackingFrom:dateOnly('2026-11-01'),maxLeave:4},{...profile,userId:8n,effectiveFrom:dateOnly('2026-11-01'),absenceTrackingFrom:dateOnly('2026-11-01'),maxLeave:2,amount:2000000n}];
    db.employeePayrollProfile.findMany.mockResolvedValue(profiles);
    db.employeeAttendance.findMany.mockResolvedValue([
      ...Array.from({length:10},(_,i)=>row('2026-11-'+String(i+1).padStart(2,'0'))),
      ...Array.from({length:13},(_,i)=>({...row('2026-11-'+String(i+1).padStart(2,'0')),userId:8n})),
    ]);
    db.employeeLeave.findMany.mockResolvedValue([{userId:7n,workDate:dateOnly('2026-11-11')},{userId:8n,workDate:dateOnly('2026-11-14')}]);
    const result=await service.summary('2026-11');
    expect(result.data.find(u=>String(u.user.id)==='7')).toMatchObject({profile:{maxLeave:4},presentDays:10,leaveDays:5,excessDays:1,leaveCut:100000,total:2900000});
    expect(result.data.find(u=>String(u.user.id)==='8')).toMatchObject({profile:{maxLeave:2},presentDays:13,leaveDays:2,excessDays:0,leaveCut:0,total:2000000});
    expect(result.total).toBe(4900000);
    profiles[0].maxLeave=6;
    const revised=await service.summary('2026-11');
    expect(revised.data.find(u=>String(u.user.id)==='7')).toMatchObject({leaveDays:5,excessDays:0,leaveCut:0,total:3000000});
    expect(revised.data.find(u=>String(u.user.id)==='8')).toEqual(result.data.find(u=>String(u.user.id)==='8'));
    expect(revised.total).toBe(5000000);
  });
  it('pays the configured monthly amount per employee without prorating by account creation date', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);const {service,db}=fixture();
    db.user.findMany.mockResolvedValue([{id:7n,name:'Teknisi A',role:'teknisi',additionalRoles:null,status:'active',createdAt:dateOnly('2026-11-10')},{id:8n,name:'Teknisi B',role:'teknisi',additionalRoles:null,status:'active',createdAt:dateOnly('2026-11-15')}]);
    const profiles=[7n,8n].map(userId=>({...profile,userId,amount:2500000n,effectiveFrom:dateOnly('2026-11-01'),absenceTrackingFrom:dateOnly('2026-11-15')}));
    db.employeePayrollProfile.findMany.mockResolvedValue(profiles);
    const report=await service.summary('2026-11');
    expect(report.data.map(r=>r.base)).toEqual([2500000,2500000]);
    expect(report.data.map(r=>r.netWage)).toEqual([2500000,2500000]);
    expect(report.total).toBe(5000000);
    db.employeePayrollProfile.findMany.mockResolvedValue([profiles[0]]);
    const unconfigured=await service.summary('2026-11');
    expect(unconfigured.data.find(r=>String(r.user.id)==='8')).toMatchObject({profile:null,base:0,total:0});
    expect(unconfigured.total).toBe(2500000);
  });
  it('counts Sunday absence after auto checkout, including when an old policy excluded weekends', async () => {
    vi.useFakeTimers();vi.setSystemTime(clockOn('2026-11-01','12:00'));const {service,db}=fixture();
    db.appSetting.findMany.mockImplementation(async ({where}:any) => where.key.startsWith ? [{key:'attendance_policy_2026-11',value:JSON.stringify({...defaultAttendanceRule,workDays:'1,2,3,4,5'})}] : []);
    expect(await service.policy('2026-11')).not.toHaveProperty('workDays');
    expect((await service.summary('2026-11')).data[0]['leaveDays']).toBe(0);
    vi.setSystemTime(clockOn('2026-11-01','18:00'));expect((await service.summary('2026-11')).data[0]['leaveDays']).toBe(1);
  });
  it('does not create retroactive absence deductions before the configured monitoring date', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);const {service,db}=fixture();db.employeePayrollProfile.findMany.mockResolvedValue([{...profile,userId:7n,effectiveFrom:dateOnly('2026-11-01'),absenceTrackingFrom:dateOnly('2026-11-15')}]);
    expect((await service.summary('2026-11')).data[0]['leaveDays']).toBe(1);
  });
  it('rejects new check-in after scheduled end even before auto checkout runs', async () => {
    vi.useFakeTimers();vi.setSystemTime(clockOn('2026-11-15','17:01'));const {service,db}=fixture();await expect(service.checkIn('7')).rejects.toThrow('sudah berakhir');expect(db.employeeAttendance.create).not.toHaveBeenCalled();
  });
  it('keeps employee identity from JWT and restricts Finance reporting and policy to Finance/Admin', () => {
    expect(Reflect.getMetadata('__guards__',PayrollController)).toEqual([JwtAuthGuard,RolesGuard]);
    expect(Reflect.getMetadata('__guards__',EmployeeAttendanceController)).toEqual([JwtAuthGuard,RolesGuard]);
    const payroll={checkIn:vi.fn(),summary:vi.fn()};const c=new EmployeeAttendanceController(payroll as any);c.checkIn({user:{id:'7'}} as any);expect(payroll.checkIn).toHaveBeenCalledWith('7');
  });
});
