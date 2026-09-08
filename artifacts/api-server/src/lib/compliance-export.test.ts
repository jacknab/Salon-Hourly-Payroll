import assert from "node:assert/strict";
import test from "node:test";
import { build1099PrepRows, buildW2PrepRows, serializeCsv } from "@workspace/api-client-react/compliance-export";

test("W-2 prep includes active employees and leaves identity fields blank", () => {
  const rows = buildW2PrepRows([
    { firstName: "Ari", lastName: "Lee", email: "ari@example.com", workState: "CO", ytdWages: 32000, ytdFutaWages: 7000, status: "active" },
    { firstName: "Inactive", lastName: "Worker", workState: "CO", ytdWages: 1000, ytdFutaWages: 1000, status: "inactive" },
  ]);
  assert.deepEqual(rows[0], ["Employee name", "Email", "Work state", "YTD wages", "YTD FUTA wages", "SSN (enter securely before filing)", "Employer EIN", "Mailing address"]);
  assert.deepEqual(rows[1], ["Ari Lee", "ari@example.com", "CO", "32000.00", "7000.00", "", "", ""]);
  assert.equal(rows.length, 2);
});

test("1099-NEC prep includes active contractors and leaves TIN blank", () => {
  const rows = build1099PrepRows([
    { firstName: "Sam", lastName: "Cole", businessName: "Cole Studio", email: "sam@example.com", workState: "CO", taxClassification: "individual", w9Status: "on_file", ytdReportableCompensation: 4250.5, stateTaxWithheld: 25, status: "active" },
    { firstName: "Archived", lastName: "Contractor", workState: "CO", taxClassification: "individual", w9Status: "missing", ytdReportableCompensation: 900, stateTaxWithheld: 0, status: "inactive" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][3], "");
  assert.equal(rows[1][4], "4250.50");
  assert.equal(rows[1][8], "on_file");
  assert.equal(serializeCsv(rows).includes("123-45-6789"), false);
});