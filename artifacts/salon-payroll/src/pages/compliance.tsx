import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarClock, Check, CircleAlert, Download, ExternalLink, FileKey2, FileText, Landmark, Link2, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'wouter';
import { useGetPayrollSummary, useListContractors, useListStaff } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Field, inputClass, Modal, PageHeader, StatCard } from '@/components/common';
import { dateLabel, money } from '@/lib/format';
import { toast } from '@/hooks/use-toast';

type ActionStatus = 'open' | 'done';
type ActionItem = {
  id: string;
  title: string;
  authority: string;
  category: 'Federal' | 'State';
  dueDate: string;
  description: string;
  href: string;
  actionLabel: string;
};

type ActivityRecord = {
  confirmation: string;
  completedAt: string;
};

const COMPLETED_KEY = 'morrow-compliance-completed-v1';
const ACTIVITY_KEY = 'morrow-compliance-activity-v1';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nextMonthlyDate(day: number) {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), day, 12);
  if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
  return isoDate(candidate);
}

function nextQuarterDate() {
  const now = new Date();
  const year = now.getFullYear();
  const candidates = [new Date(year, 3, 30, 12), new Date(year, 6, 31, 12), new Date(year, 9, 31, 12), new Date(year + 1, 0, 31, 12)];
  return isoDate(candidates.find((date) => date > now) ?? new Date(year + 1, 3, 30, 12));
}

function nextJanuaryDate() {
  const now = new Date();
  const year = now.getMonth() === 0 && now.getDate() < 31 ? now.getFullYear() : now.getFullYear() + 1;
  return `${year}-01-31`;
}

function buildActionItems(): ActionItem[] {
  return [
    {
      id: 'federal-deposit',
      title: 'Review federal tax deposit',
      authority: 'U.S. Treasury · EFTPS',
      category: 'Federal',
      dueDate: nextMonthlyDate(15),
      description: 'Confirm the IRS deposit schedule assigned to this employer, then submit through the free EFTPS service.',
      href: 'https://www.eftps.gov/eftps/',
      actionLabel: 'Open EFTPS',
    },
    {
      id: 'form-941',
      title: 'Prepare quarterly Form 941',
      authority: 'IRS · Employment tax return',
      category: 'Federal',
      dueDate: nextQuarterDate(),
      description: 'Quarterly federal return for wages, withholding, Social Security, and Medicare. Confirm the actual due date and filing method.',
      href: 'https://www.irs.gov/forms-pubs/about-form-941',
      actionLabel: 'View IRS guidance',
    },
    {
      id: 'state-withholding',
      title: 'Review state withholding report',
      authority: 'State revenue agency',
      category: 'State',
      dueDate: nextQuarterDate(),
      description: 'State deadlines vary by registration and deposit frequency. Use the report export below as the starting point.',
      href: 'https://tax.colorado.gov/withholding-tax',
      actionLabel: 'Open Colorado guidance',
    },
    {
      id: 'w2',
      title: 'Prepare annual W-2 data',
      authority: 'SSA · Business Services Online',
      category: 'Federal',
      dueDate: nextJanuaryDate(),
      description: 'Generate a review file, then submit W-2/W-3 data through SSA BSO after the employer has registered.',
      href: 'https://www.ssa.gov/bso/',
      actionLabel: 'Open SSA BSO',
    },
    {
      id: '1099',
      title: 'Prepare 1099-NEC report',
      authority: 'IRS · IRIS Taxpayer Portal',
      category: 'Federal',
      dueDate: nextJanuaryDate(),
      description: 'Contractor records are not yet tracked in this workspace. The export below provides an IRIS-ready starting template.',
      href: 'https://www.irs.gov/filing/e-file-information-returns',
      actionLabel: 'Open IRS IRIS',
    },
    {
      id: 'form-940',
      title: 'Prepare annual Form 940',
      authority: 'IRS · FUTA return',
      category: 'Federal',
      dueDate: nextJanuaryDate(),
      description: 'Annual FUTA return. The current payroll engine keeps FUTA wages and employer tax totals available for review.',
      href: 'https://www.irs.gov/forms-pubs/about-form-940',
      actionLabel: 'View IRS guidance',
    },
  ];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ActivityModal({ item, onClose, onSave }: { item: ActionItem; onClose: () => void; onSave: (confirmation: string) => void }) {
  const [confirmation, setConfirmation] = useState('');
  return (
    <Modal title="Record completed activity" description={`${item.title} · ${item.authority}`} onClose={onClose}>
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(confirmation); }}>
        <div className="rounded-xl bg-secondary/70 p-4 text-sm leading-6 text-muted-foreground">
          This records your confirmation in this browser only. It does not transmit a payment, file a return, or connect to an agency.
        </div>
        <Field label="Confirmation or reference number" hint="Optional, but helpful for your audit trail.">
          <input className={inputClass} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Example: EFTPS confirmation" autoFocus />
        </Field>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit"><Check className="h-4 w-4" /> Mark complete</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CompliancePage() {
  const summary = useGetPayrollSummary();
  const staff = useListStaff();
  const contractors = useListContractors();
  const [completed, setCompleted] = useState<string[]>([]);
  const [activity, setActivity] = useState<Record<string, ActivityRecord>>({});
  const [recording, setRecording] = useState<ActionItem | null>(null);
  const items = useMemo(buildActionItems, []);

  useEffect(() => {
    setCompleted(readJson<string[]>(COMPLETED_KEY, []));
    setActivity(readJson<Record<string, ActivityRecord>>(ACTIVITY_KEY, {}));
  }, []);

  const openItems = items.filter((item) => !completed.includes(item.id)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextItem = openItems[0];
  const staffRows = staff.data ?? [];
  const contractorRows = contractors.data ?? [];
  const ytdWages = staffRows.reduce((total, member) => total + member.ytdWages, 0);
  const ytdFutaWages = staffRows.reduce((total, member) => total + member.ytdFutaWages, 0);
  const reviewedProfiles = staffRows.filter((member) => member.taxProfileReviewed).length;
  const contractorCompensation = contractorRows.filter((contractor) => contractor.status === 'active').reduce((total, contractor) => total + contractor.ytdReportableCompensation, 0);
  const period = summary.data?.currentPayPeriod;

  function markComplete(item: ActionItem, confirmation = '') {
    const nextCompleted = [...new Set([...completed, item.id])];
    const nextActivity = { ...activity, [item.id]: { confirmation: confirmation || 'Marked complete', completedAt: isoDate(new Date()) } };
    setCompleted(nextCompleted);
    setActivity(nextActivity);
    window.localStorage.setItem(COMPLETED_KEY, JSON.stringify(nextCompleted));
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(nextActivity));
    setRecording(null);
    toast({ title: 'Activity recorded', description: item.title });
  }

  function reopen(item: ActionItem) {
    const nextCompleted = completed.filter((id) => id !== item.id);
    setCompleted(nextCompleted);
    window.localStorage.setItem(COMPLETED_KEY, JSON.stringify(nextCompleted));
    toast({ title: 'Action reopened', description: item.title });
  }

  function exportW2Prep() {
    const rows = [
      ['Employee name', 'Email', 'Work state', 'YTD wages', 'YTD FUTA wages', 'SSN (enter securely before filing)', 'Employer EIN', 'Mailing address'],
      ...staffRows.filter((member) => member.status === 'active').map((member) => [`${member.firstName} ${member.lastName}`, member.email ?? '', member.workState, member.ytdWages.toFixed(2), member.ytdFutaWages.toFixed(2), '', '', '']),
    ];
    downloadCsv(`morrow-w2-prep-${new Date().getFullYear()}.csv`, rows);
    toast({ title: 'W-2 prep file downloaded', description: 'Review and complete required identity fields before using SSA BSO.' });
  }

  function export1099Prep() {
    downloadCsv(`morrow-1099-nec-prep-${new Date().getFullYear()}.csv`, [
      ['Recipient name', 'Business name', 'Recipient email', 'TIN (enter securely before filing)', 'Nonemployee compensation', 'State', 'State tax withheld', 'Tax classification', 'W-9 status'],
      ...contractorRows.filter((contractor) => contractor.status === 'active').map((contractor) => [`${contractor.firstName} ${contractor.lastName}`, contractor.businessName ?? '', contractor.email ?? '', '', contractor.ytdReportableCompensation.toFixed(2), contractor.workState, contractor.stateTaxWithheld.toFixed(2), contractor.taxClassification, contractor.w9Status]),
    ]);
    toast({ title: '1099-NEC prep file downloaded', description: contractorRows.length ? 'Review the W-9 status and complete the TIN inside a secure filing channel.' : 'No contractors are tracked yet, so the export contains the required headers.' });
  }

  function exportStateReport() {
    const grouped = new Map<string, number>();
    staffRows.forEach((member) => grouped.set(member.workState, (grouped.get(member.workState) ?? 0) + member.ytdWages));
    downloadCsv(`morrow-state-withholding-report-${new Date().getFullYear()}.csv`, [
      ['State', 'Employees', 'YTD wages', 'YTD FUTA wages', 'Report status'],
      ...[...grouped.entries()].map(([state, wages]) => [state, String(staffRows.filter((member) => member.workState === state).length), wages.toFixed(2), staffRows.filter((member) => member.workState === state).reduce((total, member) => total + member.ytdFutaWages, 0).toFixed(2), 'Prep only']),
    ]);
    toast({ title: 'State report downloaded', description: 'Use the report with the applicable state portal or filing provider.' });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Compliance workspace"
        title="Keep tax work moving."
        description="A free-first command center for deadlines, deposits, agency handoffs, and reviewable payroll reports. It does not file returns or move money."
        action={<div className="flex flex-wrap gap-2"><Link href="/contractors"><Button variant="outline"><FileKey2 className="h-4 w-4" /> Contractors</Button></Link><Button variant="outline" onClick={() => window.open('https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-due-dates', '_blank', 'noopener,noreferrer')}><ExternalLink className="h-4 w-4" /> IRS calendar</Button></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Open actions" value={String(openItems.length)} detail={nextItem ? `Next: ${dateLabel(nextItem.dueDate, { month: 'short', day: 'numeric' })}` : 'All caught up'} accent="coral" icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="YTD wages" value={money(ytdWages)} detail="From staff tax profiles" accent="ink" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Tax profiles" value={`${reviewedProfiles}/${staffRows.length || 0}`} detail="Reviewed employee profiles" accent="sage" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="FUTA wages" value={money(ytdFutaWages)} detail="Available for Form 940 review" accent="gold" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="1099 compensation" value={money(contractorCompensation)} detail={`${contractorRows.filter((contractor) => contractor.status === 'active').length} active contractors`} accent="coral" icon={<FileKey2 className="h-5 w-5" />} />
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border hairline bg-card p-6 soft-shadow sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Upcoming obligations</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">Your next tax moves</h2></div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground">{openItems.length} open</span>
          </div>
          <div className="mt-6 space-y-3">
            {items.map((item) => {
              const done = completed.includes(item.id);
              return (
                <div key={item.id} className={`rounded-xl border p-4 transition-colors ${done ? 'border-[hsl(156_34%_42%/0.25)] bg-[hsl(156_34%_42%/0.06)]' : 'hairline bg-background'}`} data-testid={`compliance-item-${item.id}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done ? 'bg-[hsl(156_34%_42%/0.16)] text-[hsl(156_34%_34%)]' : 'bg-accent/15 text-accent'}`}>{done ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</div>
                      <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{item.title}</h3><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{item.category}</span></div><p className="mt-1 text-xs font-semibold text-muted-foreground">{item.authority} · Due {dateLabel(item.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}</p><p className="mt-2 max-w-xl text-sm leading-5 text-muted-foreground">{item.description}</p>{done && activity[item.id] ? <p className="mt-2 text-xs font-semibold text-[hsl(156_34%_34%)]">Recorded {dateLabel(activity[item.id].completedAt)} · {activity[item.id].confirmation}</p> : null}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:pl-3">
                      <a className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-primary hover:bg-secondary" href={item.href} target="_blank" rel="noreferrer">{item.actionLabel} <ArrowUpRight className="h-3.5 w-3.5" /></a>
                      {done ? <Button variant="outline" size="sm" onClick={() => reopen(item)}>Reopen</Button> : <Button size="sm" onClick={() => setRecording(item)}>Record</Button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border hairline bg-primary p-6 text-primary-foreground soft-shadow sm:p-7">
          <Landmark className="h-5 w-5 text-accent" />
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground/55">Free-first route</p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-[-0.04em]">Prepare here. Submit there.</h2>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/65">This workspace keeps the numbers, deadlines, and evidence together while official agencies retain filing and payment control.</p>
          <div className="mt-7 space-y-3">
            {[['EFTPS', 'Free federal tax payments', 'https://www.eftps.gov/eftps/'], ['SSA BSO', 'Free W-2 wage reporting', 'https://www.ssa.gov/bso/'], ['IRS IRIS', 'Free 1099 e-filing portal', 'https://www.irs.gov/filing/e-file-information-returns']].map(([name, detail, href]) => <a key={name} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 px-4 py-3 transition-colors hover:bg-primary-foreground/10"><span><span className="block text-sm font-bold">{name}</span><span className="mt-0.5 block text-xs text-primary-foreground/55">{detail}</span></span><ExternalLink className="h-4 w-4 text-accent" /></a>)}
          </div>
        </div>
      </section>

      <section className="mt-7 rounded-2xl border hairline bg-card p-6 soft-shadow sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Reports & prep files</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">Export what agencies need</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">These are prep files, not filed returns. Never add SSNs or EINs to an ordinary downloaded file unless you have a secure handling process.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[hsl(39_75%_59%/0.17)] px-3 py-1.5 text-xs font-bold text-[hsl(34_67%_35%)]"><CircleAlert className="h-3.5 w-3.5" /> Review before submitting</span></div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border hairline bg-background p-5"><FileText className="h-5 w-5 text-accent" /><h3 className="mt-4 text-sm font-bold">W-2 prep file</h3><p className="mt-2 min-h-[60px] text-sm leading-5 text-muted-foreground">Payroll totals and employee fields formatted for a review pass before SSA BSO.</p><Button className="mt-5 w-full" variant="outline" onClick={exportW2Prep}><Download className="h-4 w-4" /> Download CSV</Button></div>
          <div className="rounded-xl border hairline bg-background p-5"><ReceiptText className="h-5 w-5 text-accent" /><h3 className="mt-4 text-sm font-bold">1099-NEC prep file</h3><p className="mt-2 min-h-[60px] text-sm leading-5 text-muted-foreground">{contractorRows.length ? 'Export active contractor amounts with W-9 readiness for secure review.' : 'Add contractors to turn the IRIS-oriented template into a real year-end report.'}</p><Button className="mt-5 w-full" variant="outline" onClick={export1099Prep}><Download className="h-4 w-4" /> Download CSV</Button></div>
          <div className="rounded-xl border hairline bg-background p-5"><Landmark className="h-5 w-5 text-accent" /><h3 className="mt-4 text-sm font-bold">State withholding report</h3><p className="mt-2 min-h-[60px] text-sm leading-5 text-muted-foreground">Group YTD wages by work state for a state portal or filing provider.</p><Button className="mt-5 w-full" variant="outline" onClick={exportStateReport}><Download className="h-4 w-4" /> Download CSV</Button></div>
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-secondary/70 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">{period ? <>Current payroll period: <strong className="text-foreground">{dateLabel(period.startDate)} – {dateLabel(period.endDate)}</strong></> : 'No current pay period is available yet.'}</span><a href="https://www.taxbandits.com/payroll-tax-api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-bold text-primary hover:text-accent">Explore automated provider option <Link2 className="h-4 w-4" /></a></div>
      </section>

      {recording ? <ActivityModal item={recording} onClose={() => setRecording(null)} onSave={(confirmation) => markComplete(recording, confirmation)} /> : null}
    </div>
  );
}