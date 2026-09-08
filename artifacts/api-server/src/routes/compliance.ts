import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  CreateContractorBody,
  CreateContractorResponse,
  DeleteContractorParams,
  ListContractorsResponse,
  UpdateContractorBody,
  UpdateContractorParams,
  UpdateContractorResponse,
} from "@workspace/api-zod";
import { contractorsTable, db } from "@workspace/db";

const router: IRouter = Router();
type ContractorRow = typeof contractorsTable.$inferSelect;

function toContractorResponse(contractor: ContractorRow) {
  return {
    id: contractor.id,
    firstName: contractor.firstName,
    lastName: contractor.lastName,
    businessName: contractor.businessName,
    email: contractor.email,
    workState: contractor.workState,
    status: contractor.status,
    taxClassification: contractor.taxClassification,
    w9Status: contractor.w9Status,
    taxYear: contractor.taxYear,
    ytdReportableCompensation: Number(contractor.ytdReportableCompensation),
    stateTaxWithheld: Number(contractor.stateTaxWithheld),
    taxProfileReviewed: contractor.taxProfileReviewed === "true",
  };
}

function toContractorValues(data: Record<string, unknown>) {
  const values = { ...data } as Record<string, unknown>;
  if (typeof values.taxProfileReviewed === "boolean") values.taxProfileReviewed = String(values.taxProfileReviewed);
  if (typeof values.workState === "string") values.workState = values.workState.toUpperCase();
  values.updatedAt = new Date();
  return values;
}

router.get("/contractors", async (_req, res): Promise<void> => {
  const contractors = await db.select().from(contractorsTable).orderBy(asc(contractorsTable.lastName), asc(contractorsTable.firstName));
  res.json(ListContractorsResponse.parse(contractors.map(toContractorResponse)));
});

router.post("/contractors", async (req, res): Promise<void> => {
  const parsed = CreateContractorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [contractor] = await db
    .insert(contractorsTable)
    .values(toContractorValues(parsed.data) as typeof contractorsTable.$inferInsert)
    .returning();
  res.status(201).json(CreateContractorResponse.parse(toContractorResponse(contractor)));
});

router.patch("/contractors/:id", async (req, res): Promise<void> => {
  const params = UpdateContractorParams.safeParse(req.params);
  const body = UpdateContractorBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [contractor] = await db
    .update(contractorsTable)
    .set(toContractorValues(body.data) as Partial<typeof contractorsTable.$inferInsert>)
    .where(eq(contractorsTable.id, params.data.id))
    .returning();
  if (!contractor) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.json(UpdateContractorResponse.parse(toContractorResponse(contractor)));
});

router.delete("/contractors/:id", async (req, res): Promise<void> => {
  const params = DeleteContractorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [contractor] = await db
    .update(contractorsTable)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(eq(contractorsTable.id, params.data.id))
    .returning();
  if (!contractor) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;