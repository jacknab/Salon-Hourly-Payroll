import { useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import {
  getGetPayRunQueryKey,
  getGetPayrollSummaryQueryKey,
  getListPayPeriodsQueryKey,
  useCalculatePayPeriod,
  useCreatePayPeriod,
  useFinalizePayRun,
  useGetPayRun,
  useListPayPeriods,
  useListStaff,
  type PayPeriod,
  type PayRun,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  LoadingRows,
  Modal,
  PageHeader,
  SubmitButton,
} from '@/components/common';
import { dateLabel, dateRange, money } from '@/lib/format';
import { toast } from '@/hooks/use-toast';

type PeriodForm = { startDate: string; endDate: string; payDate: string };
const periodBlank: PeriodForm = { startDate: '', endDate: '', payDate: '' };

function statusStyle(status: string) {
  if (status === 'paid' || status === 'finalized') return 'bg-primary/10 text-primary';
  if (status === 'ready') return 'bg-[hsl(156_34%_42%/0.13)] text-[hsl(156_34%_34%)]';
  return 'bg-[hsl(39_75%_59%/0.17)] text-[hsl(34_67%_35%)]';
}

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const periods = useListPayPeriods();
  const staff = useListStaff();
  const create = useCreatePayPeriod();
  const calculate = useCalculatePayPeriod();
  const finalize = useFinalizePayRun();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PeriodForm>(periodBlank);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const selectedPeriod = periods.data?.find((period) => period.id === selectedPeriodId);
  const run = useGetPayRun(selectedRunId ?? 0, {
    query: {
      enabled: Boolean(selectedRunId),
      queryKey: getGetPayRunQueryKey(selectedRunId ?? 0),
    },
  });
  const needsProfileReview = (staff.data ?? []).some(
    (person) => person.status === 'active' && !person.taxProfileReviewed,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.startDate || !form.endDate || !form.payDate) {
      toast({ title: 'Choose all three dates' });
      return;
    }
    create.mutate(
      { data: form },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPayPeriodsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPayrollSummaryQueryKey() });
          setModalOpen(false);
          setForm(periodBlank);
          toast({ title: 'Pay period created' });
        },
        onError: () =>
          toast({ title: 'Could not create pay period', variant: 'destructive' }),
      },
    );
  };

  const calculatePeriod = (id: number) => {
    calculate.mutate(
      { id },
      {
        onSuccess: (payRun) => {
          queryClient.invalidateQueries({ queryKey: getListPayPeriodsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPayrollSummaryQueryKey() });
          setSelectedPeriodId(payRun.payPeriodId);
          setSelectedRunId(payRun.id);
          queryClient.setQueryData(getGetPayRunQueryKey(payRun.id), payRun);
          toast({
            title: 'Payroll estimate calculated',
            description:
              'Review deductions, employer liabilities, and compliance warnings.',
          });
        },
        onError: () =>
          toast({ title: 'Could not calculate payroll', variant: 'destructive' }),
      },
    );
  };

  const reviewPeriod = (period: PayPeriod) => {
    setSelectedPeriodId(period.id);
    setSelectedRunId(period.payRunId);
  };

  const finalizeRun = (id: number) => {
    if (
      !window.confirm(
        'Finalize this payroll run? Finalized calculations are locked and cannot be recalculated.',
      )
    ) {
      return;
    }
    finalize.mutate(
      { id },
      {
        onSuccess: (payRun) => {
          queryClient.invalidateQueries({ queryKey: getListPayPeriodsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPayrollSummaryQueryKey() });
          queryClient.setQueryData(getGetPayRunQueryKey(payRun.id), payRun);
          toast({
            title: 'Payroll run finalized',
            description: 'The calculation snapshot is now locked for audit review.',
          });
        },
        onError: () =>
          toast({
            title: 'Could not finalize payroll run',
            variant: 'destructive',
          }),
      },
    );
  };

  if (selectedPeriodId && selectedPeriod) {
    return (
      <RunDetail
        period={selectedPeriod}
        run={run.data}
        loading={run.isLoading}
        error={run.isError}
        finalizing={finalize.isPending}
        onBack={() => {
          setSelectedPeriodId(null);
          setSelectedRunId(null);
        }}
        onRetry={() => run.refetch()}
        onFinalize={finalizeRun}
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pay periods & runs"
        title="Run payroll with a clear boundary."
        description="Calculate gross wages, employee deductions, net pay, and employer liabilities for review before payday."
        action={
          <Button
            onClick={() => setModalOpen(true)}
            data-testid="button-create-period"
          >
            <Plus className="h-4 w-4" /> New pay period
          </Button>
        }
      />
      <div className="mb-6 flex gap-3 rounded-2xl border border-accent/35 bg-accent/10 p-4 text-sm leading-6 text-foreground">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground" />
        <p>
          <strong>This is a payroll calculation MVP, not a filing or payment service.</strong>{' '}
          Tax estimates use the saved employee profile and supported state rules. Review with
          a payroll professional before paying or filing.
        </p>
      </div>
      {needsProfileReview ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm leading-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p>
            <strong>One or more tax profiles need review.</strong>{' '}
            <a
              className="font-bold underline"
              href={`${import.meta.env.BASE_URL}staff`}
            >
              Review staff tax profiles
            </a>{' '}
            before calculating a run.
          </p>
        </div>
      ) : null}
      {periods.isLoading ? (
        <LoadingRows count={4} />
      ) : periods.isError ? (
        <ErrorState onRetry={() => periods.refetch()} />
      ) : (
        <PeriodWorkspace
          periods={periods.data ?? []}
          calculatePending={calculate.isPending}
          onCalculate={calculatePeriod}
          onReview={reviewPeriod}
          onCreate={() => setModalOpen(true)}
        />
      )}
      {modalOpen ? (
        <Modal
          title="Create pay period"
          description="Give this run a clear home on the calendar."
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Period starts">
              <input
                className={inputClass}
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                required
                data-testid="input-period-start"
              />
            </Field>
            <Field label="Period ends">
              <input
                className={inputClass}
                type="date"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                required
                data-testid="input-period-end"
              />
            </Field>
            <Field label="Pay date" hint="When your team receives this payroll">
              <input
                className={inputClass}
                type="date"
                value={form.payDate}
                onChange={(event) => setForm({ ...form, payDate: event.target.value })}
                required
                data-testid="input-pay-date"
              />
            </Field>
            <div className="flex justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                data-testid="button-cancel-period"
              >
                Cancel
              </Button>
              <SubmitButton pending={create.isPending}>Create period</SubmitButton>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function PeriodWorkspace({
  periods,
  calculatePending,
  onCalculate,
  onReview,
  onCreate,
}: {
  periods: PayPeriod[];
  calculatePending: boolean;
  onCalculate: (id: number) => void;
  onReview: (period: PayPeriod) => void;
  onCreate: () => void;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border hairline bg-card soft-shadow">
        <div className="border-b hairline p-6">
          <h2 className="font-display text-xl font-bold tracking-[-0.03em]">Pay periods</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your payroll calendar, from open to finalized.
          </p>
        </div>
        {periods.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No pay periods yet"
              description="Set your first date range and start your payroll rhythm."
              action={
                <Button size="sm" onClick={onCreate}>
                  <CalendarPlus className="h-4 w-4" /> Create a period
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border)/.7)]">
            {periods.map((period) => (
              <div
                key={period.id}
                className="flex flex-col gap-4 p-5 transition-colors hover:bg-secondary/35 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                data-testid={`row-pay-period-${period.id}`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-bold">{dateRange(period.startDate, period.endDate)}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusStyle(period.status)}`}
                    >
                      {period.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pay date {dateLabel(period.payDate, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                    · {period.staffCount} staff
                  </p>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-sm font-bold">{money(period.grossPay)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {period.totalHours.toFixed(1)} hours · gross
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {period.status === 'open' ? (
                      <Button
                        size="sm"
                        onClick={() => onCalculate(period.id)}
                        disabled={calculatePending}
                        data-testid={`button-calculate-period-${period.id}`}
                      >
                        {calculatePending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}{' '}
                        Calculate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onReview(period)}
                        data-testid={`button-view-period-${period.id}`}
                      >
                        Review <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border hairline bg-primary p-6 text-primary-foreground soft-shadow">
        <FileText className="h-5 w-5 text-accent" />
        <h2 className="mt-8 font-display text-2xl font-bold leading-tight tracking-[-0.04em]">
          Review before payday
        </h2>
        <p className="mt-3 text-sm leading-6 text-primary-foreground/65">
          Every run keeps gross wages, employee deductions, net pay, and employer liabilities
          visible in one reviewable snapshot.
        </p>
        <div className="mt-7 space-y-4 border-t border-primary-foreground/15 pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-primary-foreground/60">Open periods</span>
            <span className="font-bold">{periods.filter((period) => period.status === 'open').length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-primary-foreground/60">Ready to finalize</span>
            <span className="font-bold">{periods.filter((period) => period.status === 'ready').length}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RunDetail({
  period,
  run,
  loading,
  error,
  finalizing,
  onBack,
  onRetry,
  onFinalize,
}: {
  period: PayPeriod;
  run?: PayRun;
  loading: boolean;
  error: boolean;
  finalizing: boolean;
  onBack: () => void;
  onRetry: () => void;
  onFinalize: (id: number) => void;
}) {
  if (loading) {
    return (
      <>
        <BackButton onBack={onBack} />
        <LoadingRows count={4} />
      </>
    );
  }
  if (error || !run) {
    return (
      <>
        <BackButton onBack={onBack} />
        <ErrorState onRetry={onRetry} />
      </>
    );
  }

  const canFinalize = run.status === 'ready' && run.complianceWarnings.length === 0;

  return (
    <div>
      <BackButton onBack={onBack} />
      <PageHeader
        eyebrow="Pay run review"
        title="A pay stub for every employee."
        description={`${dateRange(period.startDate, period.endDate)} · Pay date ${dateLabel(period.payDate, { month: 'long', day: 'numeric' })}`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] ${statusStyle(run.status)}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {run.status}
            </span>
            {run.status === 'ready' ? (
              <Button
                onClick={() => onFinalize(run.id)}
                disabled={!canFinalize || finalizing}
                data-testid="button-finalize-pay-run"
              >
                {finalizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}{' '}
                Finalize run
              </Button>
            ) : null}
          </div>
        }
      />
      {run.complianceWarnings.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-bold">Review required before finalization</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                {run.complianceWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total hours" value={run.totalHours.toFixed(1)} icon={<Clock3 className="h-5 w-5" />} />
        <Metric label="Gross wages" value={money(run.grossPay)} icon={<Banknote className="h-5 w-5 text-accent" />} />
        <Metric label="Employee taxes" value={money(run.employeeTaxes)} icon={<FileText className="h-5 w-5" />} />
        <Metric label="Net pay" value={money(run.netPay)} icon={<CheckCircle2 className="h-5 w-5 text-[hsl(156_34%_34%)]" />} />
        <Metric label="Employer cost" value={money(run.totalCost)} icon={<ShieldCheck className="h-5 w-5 text-accent" />} />
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border hairline bg-card soft-shadow">
          <div className="border-b hairline p-6">
            <h2 className="font-display text-xl font-bold tracking-[-0.03em]">Pay-stub calculations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gross-to-net employee detail with employer liabilities kept separate.
            </p>
          </div>
          <div className="divide-y divide-[hsl(var(--border)/.7)]">
            {run.lines.map((line) => (
              <div key={line.staffId} className="p-5 sm:p-6" data-testid={`row-payroll-line-${line.staffId}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{line.staffName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {line.role} · {line.hours.toFixed(1)}h × {money(line.hourlyRate)} / hour
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold">{money(line.netPay)}</p>
                    <p className="text-xs text-muted-foreground">net pay</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <Breakdown label="Gross wages" value={line.grossPay} />
                  <Breakdown label="Federal withholding" value={line.federalWithholding} />
                  <Breakdown label="State withholding" value={line.stateWithholding} />
                  <Breakdown label="Social Security" value={line.socialSecurity} />
                  <Breakdown label="Medicare" value={line.medicare} />
                  <Breakdown label="Employee taxes" value={line.employeeTaxes} strong />
                  <Breakdown label="Employer taxes" value={line.employerTaxes} />
                  <Breakdown label="Total employer cost" value={line.totalCost} strong />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t hairline p-6">
            <Button variant="outline" onClick={() => window.print()} data-testid="button-print-pay-run">
              <ArrowUpRight className="h-4 w-4" /> Print pay-stub review
            </Button>
          </div>
        </div>
        <aside className="h-fit rounded-2xl border hairline bg-secondary/35 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Run totals</p>
          <div className="mt-5 space-y-3 text-sm">
            <Breakdown label="Federal withholding" value={run.federalWithholding} />
            <Breakdown label="State withholding" value={run.stateWithholding} />
            <Breakdown label="Social Security" value={run.socialSecurity} />
            <Breakdown label="Medicare" value={run.medicare} />
            <Breakdown label="FUTA" value={run.futa} />
            <div className="border-t hairline pt-3">
              <Breakdown label="Employer liabilities" value={run.employerTaxes} strong />
            </div>
            <Breakdown label="Total cost" value={run.totalCost} strong />
          </div>
          <p className="mt-6 border-t hairline pt-5 text-xs leading-5 text-muted-foreground">
            {run.status === 'finalized'
              ? `Finalized ${run.finalizedAt ? dateLabel(run.finalizedAt, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}. This snapshot is locked for audit review.`
              : 'Finalize after resolving warnings to lock this calculation snapshot. Estimates use 2026 baseline federal and FICA assumptions plus configured state rules. This screen does not file returns, remit tax, or replace payroll advice.'}
          </p>
        </aside>
      </section>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
      data-testid="button-back-payroll"
    >
      <ArrowLeft className="h-4 w-4" /> Back to periods
    </button>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border hairline bg-card p-5 soft-shadow">
      {icon}
      <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Breakdown({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'font-bold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{money(value)}</span>
    </div>
  );
}