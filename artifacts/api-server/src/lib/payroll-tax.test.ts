import assert from "node:assert/strict";
import test from "node:test";
import { calculateTaxBreakdown, type TaxProfile } from "./payroll-tax";

const reviewedProfile = (workState: string, overrides: Partial<TaxProfile> = {}): TaxProfile => ({
  federalFilingStatus: "single",
  federalAllowances: 0,
  extraFederalWithholding: 0,
  workState,
  stateAllowances: 0,
  extraStateWithholding: 0,
  ytdWages: 0,
  ytdFutaWages: 0,
  taxProfileReviewed: true,
  ...overrides,
});

test("calculates the configured CO, AZ, and CA state rules", () => {
  assert.equal(calculateTaxBreakdown(1_000, reviewedProfile("CO")).stateWithholding, 44);
  assert.equal(calculateTaxBreakdown(1_000, reviewedProfile("AZ")).stateWithholding, 25);
  assert.equal(calculateTaxBreakdown(1_000, reviewedProfile("CA")).stateWithholding, 93);
});

test("warns instead of silently calculating unsupported states", () => {
  const result = calculateTaxBreakdown(1_000, reviewedProfile("TX"));
  assert.equal(result.stateWithholding, 0);
  assert.deepEqual(result.complianceWarnings, [
    "State withholding rules for TX are not configured; state withholding is shown as $0.00.",
  ]);
});

test("does not exceed Social Security or FUTA wage bases", () => {
  const result = calculateTaxBreakdown(
    1_000,
    reviewedProfile("CO", { ytdWages: 184_500, ytdFutaWages: 7_000 }),
  );
  assert.equal(result.socialSecurity, 0);
  assert.equal(result.futa, 0);
});

test("includes extra withholding and keeps net pay non-negative", () => {
  const result = calculateTaxBreakdown(
    100,
    reviewedProfile("CO", { extraFederalWithholding: 50, extraStateWithholding: 25 }),
  );
  assert.equal(result.federalWithholding >= 50, true);
  assert.equal(result.stateWithholding >= 25, true);
  assert.equal(result.netPay >= 0, true);
  assert.ok(
    Math.abs(result.employeeTaxes - (result.federalWithholding + result.stateWithholding + result.socialSecurity + result.medicare)) < 0.001,
  );
});