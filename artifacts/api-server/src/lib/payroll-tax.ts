export type FilingStatus = "single" | "married";

export type TaxProfile = {
  federalFilingStatus: FilingStatus;
  federalAllowances: number;
  extraFederalWithholding: number;
  workState: string;
  stateAllowances: number;
  extraStateWithholding: number;
  ytdWages: number;
  ytdFutaWages: number;
  taxProfileReviewed: boolean;
};

export type TaxBreakdown = {
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
  complianceWarnings: string[];
};

const PAY_PERIODS_PER_YEAR = 26;
const SOCIAL_SECURITY_RATE = 0.062;
const SOCIAL_SECURITY_WAGE_BASE = 184_500;
const MEDICARE_RATE = 0.0145;
const FUTA_RATE = 0.006;
const FUTA_WAGE_BASE = 7_000;
const FEDERAL_ALLOWANCE_VALUE = 5_000;
const STATE_ALLOWANCE_VALUE = 5_000;
const STANDARD_DEDUCTION: Record<FilingStatus, number> = { single: 16_100, married: 32_200 };

// Baseline 2026 federal annualized brackets. Keep these in one place so a
// future rules update is auditable instead of hidden in request handlers.
const FEDERAL_BRACKETS: Record<FilingStatus, Array<[number, number]>> = {
  single: [
    [12_400, 0.1],
    [50_400, 0.12],
    [105_700, 0.22],
    [201_775, 0.24],
    [256_225, 0.32],
    [640_600, 0.35],
    [Number.POSITIVE_INFINITY, 0.37],
  ],
  married: [
    [24_800, 0.1],
    [100_800, 0.12],
    [211_400, 0.22],
    [403_550, 0.24],
    [512_450, 0.32],
    [768_700, 0.35],
    [Number.POSITIVE_INFINITY, 0.37],
  ],
};

// The MVP intentionally supports only states where a transparent rate rule is
// safe to explain. Other states produce a warning rather than a false answer.
const STATE_RULES: Record<string, { name: string; rate: number }> = {
  AZ: { name: "Arizona", rate: 0.025 },
  CO: { name: "Colorado", rate: 0.044 },
  FL: { name: "Florida", rate: 0 },
  NV: { name: "Nevada", rate: 0 },
  SD: { name: "South Dakota", rate: 0 },
  TN: { name: "Tennessee", rate: 0 },
  TX: { name: "Texas", rate: 0 },
  WA: { name: "Washington", rate: 0 },
  WY: { name: "Wyoming", rate: 0 },
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function progressiveTax(taxableIncome: number, brackets: Array<[number, number]>): number {
  let previousLimit = 0;
  let tax = 0;
  for (const [limit, rate] of brackets) {
    const amountInBand = Math.max(0, Math.min(taxableIncome, limit) - previousLimit);
    tax += amountInBand * rate;
    previousLimit = limit;
    if (taxableIncome <= limit) break;
  }
  return tax;
}

export function calculateTaxBreakdown(grossPay: number, profile: TaxProfile): TaxBreakdown {
  const warnings: string[] = [];
  const state = profile.workState.trim().toUpperCase();
  const stateRule = STATE_RULES[state];
  const filingStatus = profile.federalFilingStatus === "married" ? "married" : "single";

  if (!profile.taxProfileReviewed) {
    warnings.push("Employee tax profile has not been reviewed and signed off.");
  }
  if (!stateRule) {
    warnings.push(`State withholding rules for ${state || "this work state"} are not configured; state withholding is shown as $0.00.`);
  }

  const annualizedGross = grossPay * PAY_PERIODS_PER_YEAR;
  const annualFederalTaxable = Math.max(
    0,
    annualizedGross - STANDARD_DEDUCTION[filingStatus] - profile.federalAllowances * FEDERAL_ALLOWANCE_VALUE,
  );
  const federalWithholding =
    progressiveTax(annualFederalTaxable, FEDERAL_BRACKETS[filingStatus]) / PAY_PERIODS_PER_YEAR +
    Math.max(0, profile.extraFederalWithholding);

  const annualStateTaxable = Math.max(0, annualizedGross - profile.stateAllowances * STATE_ALLOWANCE_VALUE);
  const stateWithholding =
    (stateRule ? (annualStateTaxable * stateRule.rate) / PAY_PERIODS_PER_YEAR : 0) +
    Math.max(0, profile.extraStateWithholding);

  const socialSecurityTaxable = Math.max(0, Math.min(grossPay, SOCIAL_SECURITY_WAGE_BASE - profile.ytdWages));
  const socialSecurity = socialSecurityTaxable * SOCIAL_SECURITY_RATE;
  const medicare = grossPay * MEDICARE_RATE;
  const futaTaxable = Math.max(0, Math.min(grossPay, FUTA_WAGE_BASE - profile.ytdFutaWages));
  const futa = futaTaxable * FUTA_RATE;
  const employeeTaxes = federalWithholding + stateWithholding + socialSecurity + medicare;
  const employerSocialSecurity = socialSecurity;
  const employerMedicare = medicare;
  const employerTaxes = employerSocialSecurity + employerMedicare + futa;

  return {
    federalWithholding: roundMoney(federalWithholding),
    stateWithholding: roundMoney(stateWithholding),
    socialSecurity: roundMoney(socialSecurity),
    medicare: roundMoney(medicare),
    employeeTaxes: roundMoney(employeeTaxes),
    netPay: roundMoney(Math.max(0, grossPay - employeeTaxes)),
    employerSocialSecurity: roundMoney(employerSocialSecurity),
    employerMedicare: roundMoney(employerMedicare),
    futa: roundMoney(futa),
    employerTaxes: roundMoney(employerTaxes),
    totalCost: roundMoney(grossPay + employerTaxes),
    complianceWarnings: warnings,
  };
}