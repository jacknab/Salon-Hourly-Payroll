import assert from "node:assert/strict";
import test from "node:test";
import { CreateContractorBody, ListContractorsResponse } from "@workspace/api-zod";
import { hasSensitiveIdentifierField } from "./compliance-security";

const contractor = {
  firstName: "Taylor",
  lastName: "Morgan",
  workState: "CO",
  taxYear: 2026,
  ytdReportableCompensation: 1250,
  stateTaxWithheld: 0,
};

test("rejects sensitive identifier field names before contractor persistence", () => {
  assert.equal(hasSensitiveIdentifierField({ ...contractor, ssn: "123-45-6789" }), true);
  assert.equal(hasSensitiveIdentifierField({ ...contractor, taxpayerIdentificationNumber: "123" }), true);
  assert.equal(hasSensitiveIdentifierField({ ...contractor, businessName: "Morrow Studio" }), false);
});

test("contractor input and response contracts contain no TIN or SSN fields", () => {
  const parsedInput = CreateContractorBody.parse(contractor);
  const parsedResponse = ListContractorsResponse.parse([{ id: 1, ...parsedInput, taxProfileReviewed: false, stateTaxWithheld: 0 }]);
  for (const record of [parsedInput, parsedResponse[0]]) {
    assert.equal(Object.keys(record).some((key) => /tin|ssn|taxpayer.?identification/i.test(key)), false);
  }
});