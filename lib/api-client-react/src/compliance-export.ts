export type W2StaffRow = {
  firstName: string;
  lastName: string;
  email?: string | null;
  workState: string;
  ytdWages: number;
  ytdFutaWages: number;
  status: string;
};

export type Contractor1099Row = {
  firstName: string;
  lastName: string;
  businessName?: string | null;
  email?: string | null;
  workState: string;
  taxClassification: string;
  w9Status: string;
  ytdReportableCompensation: number;
  stateTaxWithheld: number;
  status: string;
};

export const W2_PREP_HEADERS = [
  'Employee name',
  'Email',
  'Work state',
  'YTD wages',
  'YTD FUTA wages',
  'SSN (enter securely before filing)',
  'Employer EIN',
  'Mailing address',
];

export const NEC_PREP_HEADERS = [
  'Recipient name',
  'Business name',
  'Recipient email',
  'TIN (enter securely before filing)',
  'Nonemployee compensation',
  'State',
  'State tax withheld',
  'Tax classification',
  'W-9 status',
];

export function buildW2PrepRows(staffRows: W2StaffRow[]): string[][] {
  return [
    W2_PREP_HEADERS,
    ...staffRows
      .filter((member) => member.status === 'active')
      .map((member) => [
        `${member.firstName} ${member.lastName}`,
        member.email ?? '',
        member.workState,
        member.ytdWages.toFixed(2),
        member.ytdFutaWages.toFixed(2),
        '',
        '',
        '',
      ]),
  ];
}

export function build1099PrepRows(contractorRows: Contractor1099Row[]): string[][] {
  return [
    NEC_PREP_HEADERS,
    ...contractorRows
      .filter((contractor) => contractor.status === 'active')
      .map((contractor) => [
        `${contractor.firstName} ${contractor.lastName}`,
        contractor.businessName ?? '',
        contractor.email ?? '',
        '',
        contractor.ytdReportableCompensation.toFixed(2),
        contractor.workState,
        contractor.stateTaxWithheld.toFixed(2),
        contractor.taxClassification,
        contractor.w9Status,
      ]),
  ];
}

export function serializeCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}