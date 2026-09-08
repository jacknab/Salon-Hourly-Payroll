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

const router: IRouter = Router();

type StaffRow = typeof staffTable.$inferSelect;
type TimeEntryRow = typeof timeEntriesTable.$inferSelect;
type PayPeriodRow = typeof payPeriodsTable.$inferSelect;

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
  };
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
  const totals = await getPeriodTotals(period);
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
  const [staff] = await db.insert(staffTable).values(parsed.data).returning();
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
  const [staff] = await db.update(staffTable).set(body.data).where(eq(staffTable.id, params.data.id)).returning();
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
  const lines = [...grouped.values()].map(({ hours, member }) => ({
    staffId: member.id,
    staffName: `${member.firstName} ${member.lastName}`,
    role: member.role,
    hours: roundMoney(hours),
    hourlyRate: Number(member.hourlyRate),
    grossPay: roundMoney(hours * Number(member.hourlyRate)),
  }));
  return {
    totalHours: roundMoney(lines.reduce((sum, line) => sum + line.hours, 0)),
    grossPay: roundMoney(lines.reduce((sum, line) => sum + line.grossPay, 0)),
    lines,
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
  const calculated = await buildPayRun(period);
  const [existing] = await db.select().from(payRunsTable).where(eq(payRunsTable.payPeriodId, period.id));
  const run = existing
    ? (
        await db
          .update(payRunsTable)
          .set({ totalHours: calculated.totalHours, grossPay: calculated.grossPay, status: "ready" })
          .where(eq(payRunsTable.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(payRunsTable)
          .values({ payPeriodId: period.id, status: "ready", totalHours: calculated.totalHours, grossPay: calculated.grossPay })
          .returning()
      )[0];
  if (existing) {
    await db.delete(payrollLinesTable).where(eq(payrollLinesTable.payRunId, run.id));
  }
  await db.insert(payrollLinesTable).values(calculated.lines.map((line) => ({ ...line, payRunId: run.id })));
  const [updatedPeriod] = await db.update(payPeriodsTable).set({ status: "ready" }).where(eq(payPeriodsTable.id, period.id)).returning();
  void updatedPeriod;
  res.json(CalculatePayPeriodResponse.parse({
    ...run,
    createdAt: run.createdAt.toISOString(),
    finalizedAt: run.finalizedAt?.toISOString() ?? null,
    lines: calculated.lines,
  }));
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
  res.json(
    GetPayRunResponse.parse({
      ...run,
      createdAt: run.createdAt.toISOString(),
      finalizedAt: run.finalizedAt?.toISOString() ?? null,
      totalHours: Number(run.totalHours),
      grossPay: Number(run.grossPay),
      lines: lines.map((line) => ({
        staffId: line.staffId,
        staffName: line.staffName,
        role: line.role,
        hours: Number(line.hours),
        hourlyRate: Number(line.hourlyRate),
        grossPay: Number(line.grossPay),
      })),
    }),
  );
});

export default router;