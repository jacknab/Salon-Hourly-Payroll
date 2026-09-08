import { Link } from 'wouter';
import { ArrowUpRight, Banknote, CalendarClock, CheckCircle2, Clock3, Plus, Sparkles, Users } from 'lucide-react';
import { useGetPayrollSummary } from '@workspace/api-client-react';
import { dateLabel, dateRange, money } from '@/lib/format';
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatCard } from '@/components/common';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const summary = useGetPayrollSummary();
  if (summary.isLoading) return <><PageHeader eyebrow="Good morning, Jamie" title="Payroll, at a glance." description="Pulling together your latest hours and pay period." /><LoadingRows count={5} /></>;
  if (summary.isError || !summary.data) return <><PageHeader eyebrow="Good morning, Jamie" title="Payroll, at a glance." description="Your workspace is ready when the connection is restored." /><ErrorState onRetry={() => summary.refetch()} /></>;
  const data = summary.data;
  const period = data.currentPayPeriod;
  const ready = Boolean(period && period.status !== 'open');
  const todayLabel = dateLabel(new Date().toISOString(), { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div>
      <PageHeader eyebrow={`${todayLabel} · Good morning, Jamie`} title="Payroll, at a glance." description="The room is quiet. Here is what needs your attention before the doors open." action={<Link href="/time" className="inline-flex"><Button data-testid="button-add-hours"><Plus className="h-4 w-4" /> Add hours</Button></Link>} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-in-up-delay">
        <StatCard label="Active staff" value={String(data.activeStaff)} detail="Hourly team members" accent="ink" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Hours to review" value={`${data.pendingHours.toFixed(1)}h`} detail="Across the current period" accent="gold" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Current gross pay" value={money(data.currentGrossPay)} detail="Before taxes and deductions" accent="coral" icon={<Banknote className="h-5 w-5" />} />
        <StatCard label="Next pay date" value={dateLabel(data.nextPayDate, { month: 'short', day: 'numeric' })} detail={data.lastPayrollDate ? `Last run ${dateLabel(data.lastPayrollDate)}` : 'No previous run'} accent="sage" icon={<CalendarClock className="h-5 w-5" />} />
      </section>
      <section className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl border hairline bg-card p-6 soft-shadow sm:p-7 animate-in-up-delay-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Current pay period</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">{period ? dateRange(period.startDate, period.endDate) : 'No pay period yet'}</h2>{period ? <p className="mt-2 text-sm text-muted-foreground">Pay date <span className="font-semibold text-foreground">{dateLabel(period.payDate, { month: 'long', day: 'numeric', year: 'numeric' })}</span></p> : null}</div>
            {period ? <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${ready ? 'bg-[hsl(156_34%_42%/0.13)] text-[hsl(156_34%_34%)]' : 'bg-[hsl(39_75%_59%/0.17)] text-[hsl(34_67%_35%)]'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{period.status}</span> : null}
          </div>
          {period ? <div className="mt-8 grid grid-cols-3 gap-3 border-t hairline pt-5"><div><p className="text-xs text-muted-foreground">Hours</p><p className="mt-1 font-display text-xl font-bold">{period.totalHours.toFixed(1)}</p></div><div><p className="text-xs text-muted-foreground">Gross pay</p><p className="mt-1 font-display text-xl font-bold">{money(period.grossPay)}</p></div><div><p className="text-xs text-muted-foreground">Team</p><p className="mt-1 font-display text-xl font-bold">{period.staffCount}</p></div></div> : <EmptyState title="Start with a pay period" description="Create a period in Payroll to begin collecting hours." action={<Link href="/payroll"><Button variant="outline" size="sm">Open payroll <ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>} />}
          {period ? <Link href="/payroll" className="mt-7 flex items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm font-bold transition-colors hover:bg-accent/20" data-testid="link-review-payroll"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[hsl(156_34%_34%)]" /> {ready ? 'Review and run payroll' : 'Review outstanding hours'}</span><ArrowUpRight className="h-4 w-4" /></Link> : null}
        </div>
        <div className="rounded-2xl border hairline bg-primary p-6 text-primary-foreground soft-shadow sm:p-7 animate-in-up-delay-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="mt-10 font-display text-2xl font-bold leading-tight tracking-[-0.04em]">A clean close is a calm opening.</h2>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/65">Keep hours current and payday becomes a quick review, not a late-night project.</p>
          <Link href="/staff" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-accent hover:underline" data-testid="link-manage-staff">Manage your team <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
      </section>
      <section className="mt-7 rounded-2xl border hairline bg-card p-6 soft-shadow sm:p-7">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Recent time entries</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">Latest hours</h2></div><Link href="/time" className="text-sm font-bold text-primary hover:text-accent" data-testid="link-view-all-time">View all <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>
        <div className="mt-6">
          {data.recentEntries.length === 0 ? <EmptyState title="No hours logged yet" description="Add your team's first time entry to see the week take shape." action={<Link href="/time"><Button size="sm"><Plus className="h-4 w-4" /> Add first entry</Button></Link>} /> : <div className="divide-y divide-[hsl(var(--border)/.7)]">{data.recentEntries.slice(0, 5).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" data-testid={`row-recent-entry-${entry.id}`}><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-display text-xs font-bold text-primary">{entry.staffName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><p className="text-sm font-bold">{entry.staffName}</p><p className="mt-0.5 text-xs text-muted-foreground">{dateLabel(entry.workDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p></div></div><p className="font-mono text-sm font-bold">{entry.hours.toFixed(1)}h</p></div>)}</div>}
        </div>
      </section>
    </div>
  );
}
