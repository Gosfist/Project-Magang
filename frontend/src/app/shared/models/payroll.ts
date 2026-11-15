export interface AttendancePolicy { checkInStart: string; lateAfter: string; checkOutTime: string; autoCheckoutTime: string; workDays: string }
export interface PayrollProfile { userId: string; effectiveFrom: string; absenceTrackingFrom: string; salaryType: string; amount: number; maxLeave: number; excessLeaveCut: boolean; excessLeaveAmount: number; lateCut: boolean; lateAmount: number; earlyCut: boolean; earlyAmount: number }
export interface PayrollRow { user: { id: string; name: string; role: string; status: string }; profile: PayrollProfile | null; base: number; presentDays: number; lateDays: number; earlyDays: number; leaveDays: number; excessDays: number; leaveCut: number; lateCut: number; earlyCut: number; deduction: number; netWage: number; psbBonus: number; salesSalary: number; total: number }
export interface PayrollReport { month: string; data: PayrollRow[]; total: number; calculatedAt: string }
export interface AttendanceRow { id: string; user: { id: string; name: string }; workDate: string; checkIn: string; checkOut: string | null; isLate: boolean; checkoutSource: string | null }
export interface LeaveRow { id: string; user: { id: string; name: string }; workDate: string; note: string }
export interface AttendanceReport { data: AttendanceRow[]; total: number; leaves: LeaveRow[] }
