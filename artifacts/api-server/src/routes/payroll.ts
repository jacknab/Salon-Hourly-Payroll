import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  CreatePayPeriodBody,
  CreateStaffBody,
  CreateTimeEntryBody,
  GetPayrollSummaryResponse,
  GetPayRunParams,
  GetPayRunResponse,
  ListPayPeriodsResponse,
  ListStaffResponse,
  ListTimeEntriesQueryParams,
  ListTimeEntriesResponse,
  CalculatePayPeriodParams,
  CalculatePayPeriodResponse,
  FinalizePayRunParams,
  FinalizePayRunResponse,
  UpdateStaffBody,
  UpdateStaffParams,
  UpdateStaffResponse,
  DeleteStaffParams,
  UpdateTimeEntryBody,
  UpdateTimeEntryParams,
  UpdateTimeEntryResponse,
  DeleteTimeEntryParams,
  DeleteTimeEntryResponse,
  CreateStaffResponse,
  CreateTimeEntryResponse,
  DeleteStaffResponse,
  CreatePayPeriodResponse,
} from "@workspace/api-zod";
import {
  db,
  payPeriodsTable,
  payRunsTable,
  payrollLinesTable,
  staffTable,
  timeEntriesTable,
} from "@workspace/db";
import { calculateTaxBreakdown, type TaxProfile } from "../lib/payroll-tax";

const router: IRouter = Router();

type StaffRow = typeof staffTable.$inferSelect;
type TimeEntryRow = typeof timeEntriesTable.$inferSelect;
type PayPeriodRow = typeof payPeriodsTable.$inferSelect;
type PayRunRow = typeof payRunsTable.$inferSelect;
type PayrollLineValue = {
  staffId: number;
  staffName: string;
  role: string;
  hours: number;
  hourlyRate: number;
  grossPay: number;
  federalWithholding: number;
  stateWithholding: number;
  socialSecurity: number;
  medicare: number;
  employeeTaxes: number;
  netPay: number;
  employerSocialSecurity: number;
  employerMedicare: number;
  futa: number;
  employerTaxes: number;
  totalCost: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function dateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toStaffResponse(staff: StaffRow) {
  return {
    id: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    email: staff.email,
    hourlyRate: Number(staff.hourlyRate),
    status: staff.status,
    federalFilingStatus: staff.federalFilingStatus,
    federalAllowances: staff.federalAllowances,
    extraFederalWithholding: Number(staff.extraFederalWithholding),
    workState: staff.workState,
    stateAllowances: staff.stateAllowances,
    extraStateWithholding: Number(staff.extraStateWithholding),
    ytdWages: Number(staff.ytdWages),
    ytdFutaWages: Number(staff.ytdFutaWages),
    taxProfileReviewed: staff.taxProfileReviewed === "true",
  };
}

function toTaxProfile(staff: StaffRow): TaxProfile {
  return {
    federalFilingStatus: staff.federalFilingStatus === "married" ? "married" : "single",
    federalAllowances: Number(staff.federalAllowances),
    extraFederalWithholding: Number(staff.extraFederalWithholding),
    workState: staff.workState,
    stateAllowances: Number(staff.stateAllowances),
    extraStateWithholding: Number(staff.extraStateWithholding),
    ytdWages: Number(staff.ytdWages),
    ytdFutaWages: Number(staff.ytdFutaWages),
    taxProfileReviewed: staff.taxProfileReviewed === "true",
  };
}

function toStaffValues(data: Record<string, unknown>) {
  const values = { ...data } as Record<string, unknown>;
  if (typeof values.taxProfileReviewed === "boolean") values.taxProfileReviewed = String(values.taxProfileReviewed);
  if (typeof values.workState === "string") values.workState = values.workState.toUpperCase();
  values.taxProfileUpdatedAt = new Date();
  return values;
}

async function getPeriodTotals(period: PayPeriodRow) {
  const [staff, entries] = await Promise.all([
    db.select().from(staffTable),
    db
      .select()
      .from(timeEntriesTable)
      .where(and(gte(timeEntriesTable.workDate, period.startDate), lte(timeEntriesTable.workDate, period.endDate))),
  ]);
  const staffById = new Map(staff.map((member) => [member.id, member]));
  return entries.reduce(
    (totals, entry) => {
      const member = staffById.get(entry.staffId);
      const hours = Number(entry.hours);
      totals.totalHours += hours;
      if (member) totals.grossPay += hours * Number(member.hourlyRate);
      return totals;
    },
    { totalHours: 0, grossPay: 0 },
  );
}

async function toPayPeriodResponse(period: PayPeriodRow) {
  const [totals, [payRun]] = await Promise.all([
    getPeriodTotals(period),
    db.select({ id: payRunsTable.id }).from(payRunsTable).where(eq(payRunsTable.payPeriodId, period.id)),
  ]);
  const entries = await db
    .select({ staffId: timeEntriesTable.staffId })
    .from(timeEntriesTable)
    .where(and(gte(timeEntriesTable.workDate, period.startDate), lte(timeEntriesTable.workDate, period.endDate)));
  return {
    id: period.id,
    startDate: period.startDate,
    endDate: period.endDate,
    payDate: period.payDate,
    status: period.status,
    payRunId: payRun?.id ?? null,
    totalHours: roundMoney(totals.totalHours),
    grossPay: roundMoney(totals.grossPay),
    staffCount: new Set(entries.map((entry) => entry.staffId)).size,
  };
}

router.get("/payroll/summary", async (_req, res): Promise<void> => {
  const [staff, periods, recentEntries] = await Promise.all([
    db.select().from(staffTable).where(eq(staffTable.status, "active")),
    db.select().from(payPeriodsTable).orderBy(asc(payPeriodsTable.startDate)),
    db.select().from(timeEntriesTable).orderBy(desc(timeEntriesTable.workDate), desc(timeEntriesTable.id)).limit(5),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod =
    periods.find((period) => period.status === "open" && dateInRange(today, period.startDate, period.endDate)) ??
    periods.find((period) => period.status === "open") ??
    periods[periods.length - 1];
  const currentTotals = currentPeriod ? await getPeriodTotals(currentPeriod) : { totalHours: 0, grossPay: 0 };
  const staffById = new Map(staff.map((member) => [member.id, member]));
  const recent = recentEntries.map((entry) => ({
    id: entry.id,
    staffName: staffById.get(entry.staffId)
      ? `${staffById.get(entry.staffId)?.firstName} ${staffById.get(entry.staffId)?.lastName}`
      : "Former team member",
    workDate: entry.workDate,
    hours: Number(entry.hours),
  }));
  const paidPeriods = periods.filter((period) => period.status === "paid").sort((a, b) => b.payDate.localeCompare(a.payDate));
  const currentPayPeriod = currentPeriod
    ? {
        ...(await toPayPeriodResponse(currentPeriod)),
      }
    : null;
  res.json(
    GetPayrollSummaryResponse.parse({
      activeStaff: staff.length,
      pendingHours: roundMoney(currentTotals.totalHours),
      currentGrossPay: roundMoney(currentTotals.grossPay),
      nextPayDate: currentPeriod?.payDate ?? null,
      lastPayrollDate: paidPeriods[0]?.payDate ?? null,
      recentEntries: recent,
      currentPayPeriod,
    }),
  );
});

router.get("/staff", async (_req, res): Promise<void> => {
  const staff = await db.select().from(staffTable).orderBy(asc(staffTable.firstName), asc(staffTable.lastName));
  res.json(ListStaffResponse.parse(staff.map(toStaffResponse)));
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [staff] = await db.insert(staffTable).values(toStaffValues(parsed.data) as typeof staffTable.$inferInsert).returning();
  res.status(201).json(CreateStaffResponse.parse(toStaffResponse(staff)));
});

router.patch("/staff/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  const body = UpdateStaffBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [staff] = await db
    .update(staffTable)
    .set(toStaffValues(body.data) as Partial<typeof staffTable.$inferInsert>)
    .where(eq(staffTable.id, params.data.id))
    .returning();
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json(UpdateStaffResponse.parse(toStaffResponse(staff)));
});

router.delete("/staff/:id", async (req, res): Promise<void> => {
  const params = DeleteStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [staff] = await db
    .update(staffTable)
    .set({ status: "inactive" })
    .where(eq(staffTable.id, params.data.id))
    .returning();
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.sendStatus(204);
});

async function listTimeEntries(limit: number, payPeriodId?: number | null) {
  const entries = await db
    .select()
    .from(timeEntriesTable)
    .orderBy(desc(timeEntriesTable.workDate), desc(timeEntriesTable.id))
    .limit(limit);
  let filtered = entries;
  if (payPeriodId != null) {
    const [period] = await db.select().from(payPeriodsTable).where(eq(payPeriodsTable.id, payPeriodId));
    filtered = period
      ? entries.filter((entry) => dateInRange(entry.workDate, period.startDate, period.endDate))
      : [];
  }
  const staff = await db.select().from(staffTable);
  const staffById = new Map(staff.map((member) => [member.id, member]));
  return filtered.map((entry) => ({
    id: entry.id,
    staffId: entry.staffId,
    staffName: staffById.get(entry.staffId)
      ? `${staffById.get(entry.staffId)?.firstName} ${staffById.get(entry.staffId)?.lastName}`
      : "Former team member",
    workDate: entry.workDate,
    hours: Number(entry.hours),
    note: entry.note,
  }));
}

router.get("/time-entries", async (req, res): Promise<void> => {
  const query = ListTimeEntriesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  res.json(ListTimeEntriesResponse.parse(await listTimeEntries(query.data.limit, query.data.payPeriodId)));
});

router.post("/time-entries", async (req, res): Promise<void> => {
  const parsed = CreateTimeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db.select().from(staffTable).where(eq(staffTable.id, parsed.data.staffId));
  if (!member) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  const [entry] = await db
    .insert(timeEntriesTable)
    .values({ ...parsed.data, workDate: dateOnly(parsed.data.workDate) })
    .returning();
  const response = {
    id: entry.id,
    staffId: entry.staffId,
    staffName: `${member.firstName} ${member.lastName}`,
    workDate: entry.workDate,
    hours: Number(entry.hours),
    note: entry.note,
  };
  res.status(201).json(CreateTimeEntryResponse.parse(response));
});

router.patch("/time-entries/:id", async (req, res): Promise<void> => {
  const params = UpdateTimeEntryParams.safeParse(req.params);
  const body = UpdateTimeEntryBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.staffId != null) {
    const [member] = await db.select().from(staffTable).where(eq(staffTable.id, body.data.staffId));
    if (!member) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
  }
  const values: Partial<typeof timeEntriesTable.$inferInsert> = {
    staffId: body.data.staffId,
    workDate: body.data.workDate ? dateOnly(body.data.workDate) : undefined,
    hours: body.data.hours,
    note: body.data.note,
  };
  const [entry] = await db.update(timeEntriesTable).set(values).where(eq(timeEntriesTable.id, params.data.id)).returning();
  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }
  const [member] = await db.select().from(staffTable).where(eq(staffTable.id, entry.staffId));
  res.json(
    UpdateTimeEntryResponse.parse({
      id: entry.id,
      staffId: entry.staffId,
      staffName: member ? `${member.firstName} ${member.lastName}` : "Former team member",
      workDate: entry.workDate,
      hours: Number(entry.hours),
      note: entry.note,
    }),
  );
});

router.delete("/time-entries/:id", async (req, res): Promise<void> => {
  const params = DeleteTimeEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [entry] = await db.delete(timeEntriesTable).where(eq(timeEntriesTable.id, params.data.id)).returning();
  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/pay-periods", async (_req, res): Promise<void> => {
  const periods = await db.select().from(payPeriodsTable).orderBy(desc(payPeriodsTable.startDate));
  res.json(ListPayPeriodsResponse.parse(await Promise.all(periods.map(toPayPeriodResponse))));
});

router.post("/pay-periods", async (req, res): Promise<void> => {
  const parsed = CreatePayPeriodBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const values = {
    startDate: dateOnly(parsed.data.startDate),
    endDate: dateOnly(parsed.data.endDate),
    payDate: dateOnly(parsed.data.payDate),
  };
  if (values.startDate > values.endDate || values.payDate < values.endDate) {
    res.status(400).json({ error: "Pay date must be on or after the period end date" });
    return;
  }
  const [period] = await db.insert(payPeriodsTable).values(values).returning();
  res.status(201).json(CreatePayPeriodResponse.parse(await toPayPeriodResponse(period)));
});

async function buildPayRun(period: PayPeriodRow) {
  const [members, entries] = await Promise.all([
    db.select().from(staffTable),
    db
      .select()
      .from(timeEntriesTable)
      .where(and(gte(timeEntriesTable.workDate, period.startDate), lte(timeEntriesTable.workDate, period.endDate))),
  ]);
  const membersById = new Map(members.map((member) => [member.id, member]));
  const grouped = new Map<number, { hours: number; member: StaffRow }>();
  for (const entry of entries) {
    const member = membersById.get(entry.staffId);
    if (!member) continue;
    const current = grouped.get(member.id) ?? { hours: 0, member };
    current.hours += Number(entry.hours);
    grouped.set(member.id, current);
  }
  const lines = [...grouped.values()].map(({ hours, member }) => {
    const grossPay = roundMoney(hours * Number(member.hourlyRate));
    return {
      staffId: member.id,
      staffName: `${member.firstName} ${member.lastName}`,
      role: member.role,
      hours: roundMoney(hours),
      hourlyRate: Number(member.hourlyRate),
      grossPay,
      ...calculateTaxBreakdown(grossPay, toTaxProfile(member)),
    };
  });
  const totals = lines.reduce(
    (total, line) => ({
      totalHours: total.totalHours + line.hours,
      grossPay: total.grossPay + line.grossPay,
      federalWithholding: total.federalWithholding + line.federalWithholding,
      stateWithholding: total.stateWithholding + line.stateWithholding,
      socialSecurity: total.socialSecurity + line.socialSecurity,
      medicare: total.medicare + line.medicare,
      employeeTaxes: total.employeeTaxes + line.employeeTaxes,
      netPay: total.netPay + line.netPay,
      employerSocialSecurity: total.employerSocialSecurity + line.employerSocialSecurity,
      employerMedicare: total.employerMedicare + line.employerMedicare,
      futa: total.futa + line.futa,
      employerTaxes: total.employerTaxes + line.employerTaxes,
      totalCost: total.totalCost + line.totalCost,
    }),
    {
      totalHours: 0,
      grossPay: 0,
      federalWithholding: 0,
      stateWithholding: 0,
      socialSecurity: 0,
      medicare: 0,
      employeeTaxes: 0,
      netPay: 0,
      employerSocialSecurity: 0,
      employerMedicare: 0,
      futa: 0,
      employerTaxes: 0,
      totalCost: 0,
    },
  );
  const roundedTotals = {
    totalHours: roundMoney(totals.totalHours),
    grossPay: roundMoney(totals.grossPay),
    federalWithholding: roundMoney(totals.federalWithholding),
    stateWithholding: roundMoney(totals.stateWithholding),
    socialSecurity: roundMoney(totals.socialSecurity),
    medicare: roundMoney(totals.medicare),
    employeeTaxes: roundMoney(totals.employeeTaxes),
    netPay: roundMoney(totals.netPay),
    employerSocialSecurity: roundMoney(totals.employerSocialSecurity),
    employerMedicare: roundMoney(totals.employerMedicare),
    futa: roundMoney(totals.futa),
    employerTaxes: roundMoney(totals.employerTaxes),
    totalCost: roundMoney(totals.totalCost),
  };
  return {
    ...roundedTotals,
    complianceWarnings: [...new Set(lines.flatMap((line) => line.complianceWarnings))],
    lines,
  };
}

function toPayRunResponse(run: PayRunRow, lines: PayrollLineValue[], complianceWarnings: string[]) {
  return {
    ...run,
    createdAt: run.createdAt.toISOString(),
    finalizedAt: run.finalizedAt?.toISOString() ?? null,
    totalHours: Number(run.totalHours),
    grossPay: Number(run.grossPay),
    federalWithholding: Number(run.federalWithholding),
    stateWithholding: Number(run.stateWithholding),
    socialSecurity: Number(run.socialSecurity),
    medicare: Number(run.medicare),
    employeeTaxes: Number(run.employeeTaxes),
    netPay: Number(run.netPay),
    employerSocialSecurity: Number(run.employerSocialSecurity),
    employerMedicare: Number(run.employerMedicare),
    futa: Number(run.futa),
    employerTaxes: Number(run.employerTaxes),
    totalCost: Number(run.totalCost),
    complianceWarnings,
    lines: lines.map((line) => ({
      staffId: line.staffId,
      staffName: line.staffName,
      role: line.role,
      hours: Number(line.hours),
      hourlyRate: Number(line.hourlyRate),
      grossPay: Number(line.grossPay),
      federalWithholding: Number(line.federalWithholding),
      stateWithholding: Number(line.stateWithholding),
      socialSecurity: Number(line.socialSecurity),
      medicare: Number(line.medicare),
      employeeTaxes: Number(line.employeeTaxes),
      netPay: Number(line.netPay),
      employerSocialSecurity: Number(line.employerSocialSecurity),
      employerMedicare: Number(line.employerMedicare),
      futa: Number(line.futa),
      employerTaxes: Number(line.employerTaxes),
      totalCost: Number(line.totalCost),
    })),
  };
}

router.post("/pay-periods/:id/calculate", async (req, res): Promise<void> => {
  const params = CalculatePayPeriodParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [period] = await db.select().from(payPeriodsTable).where(eq(payPeriodsTable.id, params.data.id));
  if (!period) {
    res.status(404).json({ error: "Pay period not found" });
    return;
  }
  const [existing] = await db.select().from(payRunsTable).where(eq(payRunsTable.payPeriodId, period.id));
  if (existing?.status === "finalized" || existing?.status === "paid") {
    res.status(409).json({ error: "Finalized payroll runs are locked; create an adjustment run instead of recalculating them." });
    return;
  }
  const calculated = await buildPayRun(period);
  const run = existing
    ? (
        await db
          .update(payRunsTable)
      .set({
        totalHours: calculated.totalHours,
        grossPay: calculated.grossPay,
        federalWithholding: calculated.federalWithholding,
        stateWithholding: calculated.stateWithholding,
        socialSecurity: calculated.socialSecurity,
        medicare: calculated.medicare,
        employeeTaxes: calculated.employeeTaxes,
        netPay: calculated.netPay,
        employerSocialSecurity: calculated.employerSocialSecurity,
        employerMedicare: calculated.employerMedicare,
        futa: calculated.futa,
        employerTaxes: calculated.employerTaxes,
        totalCost: calculated.totalCost,
         complianceWarnings: calculated.complianceWarnings,
        status: "ready",
      })
          .where(eq(payRunsTable.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(payRunsTable)
          .values({
            payPeriodId: period.id,
            status: "ready",
            totalHours: calculated.totalHours,
            grossPay: calculated.grossPay,
            federalWithholding: calculated.federalWithholding,
            stateWithholding: calculated.stateWithholding,
            socialSecurity: calculated.socialSecurity,
            medicare: calculated.medicare,
            employeeTaxes: calculated.employeeTaxes,
            netPay: calculated.netPay,
            employerSocialSecurity: calculated.employerSocialSecurity,
            employerMedicare: calculated.employerMedicare,
            futa: calculated.futa,
            employerTaxes: calculated.employerTaxes,
            totalCost: calculated.totalCost,
            complianceWarnings: calculated.complianceWarnings,
          })
          .returning()
      )[0];
  if (existing) {
    await db.delete(payrollLinesTable).where(eq(payrollLinesTable.payRunId, run.id));
  }
  await db.insert(payrollLinesTable).values(calculated.lines.map((line) => ({ ...line, payRunId: run.id })));
  const [updatedPeriod] = await db.update(payPeriodsTable).set({ status: "ready" }).where(eq(payPeriodsTable.id, period.id)).returning();
  void updatedPeriod;
  res.json(CalculatePayPeriodResponse.parse(toPayRunResponse(run, calculated.lines, calculated.complianceWarnings)));
});

router.post("/pay-runs/:id/finalize", async (req, res): Promise<void> => {
  const params = FinalizePayRunParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [run] = await db.select().from(payRunsTable).where(eq(payRunsTable.id, params.data.id));
  if (!run) {
    res.status(404).json({ error: "Pay run not found" });
    return;
  }
  if (run.status === "paid") {
    res.status(409).json({ error: "Paid payroll runs cannot be finalized again." });
    return;
  }
  if (run.status === "finalized") {
    res.status(409).json({ error: "Payroll run is already finalized." });
    return;
  }
  if (run.status !== "ready") {
    res.status(409).json({ error: "Only a calculated payroll run can be finalized." });
    return;
  }
  const complianceWarnings = Array.isArray(run.complianceWarnings) ? run.complianceWarnings : [];
  if (complianceWarnings.length > 0) {
    res.status(409).json({ error: "Resolve compliance warnings before finalizing this payroll run." });
    return;
  }
  const [finalizedRun] = await db
    .update(payRunsTable)
    .set({ status: "finalized", finalizedAt: new Date() })
    .where(eq(payRunsTable.id, run.id))
    .returning();
  await db.update(payPeriodsTable).set({ status: "finalized" }).where(eq(payPeriodsTable.id, run.payPeriodId));
  const lines = await db.select().from(payrollLinesTable).where(eq(payrollLinesTable.payRunId, finalizedRun.id)).orderBy(asc(payrollLinesTable.staffName));
  res.json(FinalizePayRunResponse.parse(toPayRunResponse(finalizedRun, lines, complianceWarnings)));
});

router.get("/pay-runs/:id", async (req, res): Promise<void> => {
  const params = GetPayRunParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [run] = await db.select().from(payRunsTable).where(eq(payRunsTable.id, params.data.id));
  if (!run) {
    res.status(404).json({ error: "Pay run not found" });
    return;
  }
  const lines = await db.select().from(payrollLinesTable).where(eq(payrollLinesTable.payRunId, run.id)).orderBy(asc(payrollLinesTable.staffName));
  const complianceWarnings = Array.isArray(run.complianceWarnings) ? run.complianceWarnings : [];
  res.json(
    GetPayRunResponse.parse(toPayRunResponse(run, lines, complianceWarnings)),
  );
});

export default router;