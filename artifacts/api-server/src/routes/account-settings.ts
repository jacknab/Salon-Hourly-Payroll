import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import {
  GetAccountSettingsResponse,
  UpdateAccountSettingsBody,
  UpdateAccountSettingsResponse,
} from "@workspace/api-zod";
import { accountSettingsTable, db } from "@workspace/db";

const router: IRouter = Router();
type AccountSettingsRow = typeof accountSettingsTable.$inferSelect;

const defaults = {
  businessName: "Morrow Studio",
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: "CO",
  postalCode: null,
  phone: null,
  payrollFrequency: "biweekly",
  defaultWorkState: "CO",
  federalDepositSchedule: "monthly",
  stateWithholdingFrequency: "quarterly",
  einOnFile: "false",
  stateAccountOnFile: "false",
  eftpsEnrolled: "false",
  ssaBsoEnrolled: "false",
  irsIrisEnrolled: "false",
} as const;

function toBoolean(value: string): boolean {
  return value === "true";
}

function toResponse(settings: AccountSettingsRow) {
  return {
    id: settings.id,
    businessName: settings.businessName,
    legalName: settings.legalName,
    addressLine1: settings.addressLine1,
    addressLine2: settings.addressLine2,
    city: settings.city,
    state: settings.state,
    postalCode: settings.postalCode,
    phone: settings.phone,
    payrollFrequency: settings.payrollFrequency,
    defaultWorkState: settings.defaultWorkState,
    federalDepositSchedule: settings.federalDepositSchedule,
    stateWithholdingFrequency: settings.stateWithholdingFrequency,
    einOnFile: toBoolean(settings.einOnFile),
    stateAccountOnFile: toBoolean(settings.stateAccountOnFile),
    eftpsEnrolled: toBoolean(settings.eftpsEnrolled),
    ssaBsoEnrolled: toBoolean(settings.ssaBsoEnrolled),
    irsIrisEnrolled: toBoolean(settings.irsIrisEnrolled),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function toDbValues(data: Record<string, unknown>) {
  const values = { ...data } as Record<string, unknown>;
  for (const key of ["einOnFile", "stateAccountOnFile", "eftpsEnrolled", "ssaBsoEnrolled", "irsIrisEnrolled"]) {
    if (typeof values[key] === "boolean") values[key] = String(values[key]);
  }
  for (const key of ["state", "defaultWorkState"]) {
    if (typeof values[key] === "string") values[key] = values[key].toUpperCase();
  }
  values.updatedAt = new Date();
  return values;
}

async function getOrCreateSettings(): Promise<AccountSettingsRow> {
  const [settings] = await db.select().from(accountSettingsTable).orderBy(asc(accountSettingsTable.id)).limit(1);
  if (settings) return settings;
  const [created] = await db.insert(accountSettingsTable).values(defaults).returning();
  return created;
}

router.get("/account-settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(GetAccountSettingsResponse.parse(toResponse(settings)));
});

router.patch("/account-settings", async (req, res): Promise<void> => {
  const parsed = UpdateAccountSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await getOrCreateSettings();
  const [updated] = await db
    .update(accountSettingsTable)
    .set(toDbValues(parsed.data) as Partial<typeof accountSettingsTable.$inferInsert>)
    .where((await import("drizzle-orm")).eq(accountSettingsTable.id, settings.id))
    .returning();
  res.json(UpdateAccountSettingsResponse.parse(toResponse(updated)));
});

export default router;