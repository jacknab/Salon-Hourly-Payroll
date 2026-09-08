import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useHealthCheck } from '@workspace/api-client-react';
import { Banknote, CalendarDays, CheckCircle2, ChevronRight, Clock3, LayoutDashboard, Menu, Scissors, Users, X } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/time', label: 'Time entries', icon: Clock3 },
  { href: '/payroll', label: 'Payroll', icon: Banknote },
];

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const health = useHealthCheck();
  return (
    <div className="app-shell min-h-[100dvh]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-3">
          <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)} data-testid="link-brand">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Scissors className="h-5 w-5" /></span>
            <span><span className="block font-display text-[19px] font-bold tracking-[-0.04em]">Morrow</span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/55">Salon payroll</span></span>
          </Link>
          <button className="rounded-lg p-2 text-sidebar-foreground/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-12 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/40">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? location === '/' : location.startsWith(href);
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={`group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <span className="flex items-center gap-3"><Icon className={`h-[17px] w-[17px] ${active ? 'text-sidebar-primary' : ''}`} />{label}</span>
              {active ? <ChevronRight className="h-4 w-4 text-sidebar-primary" /> : null}
            </Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/55 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-destructive' : 'bg-sidebar-primary'}`} /> {health.isLoading ? 'Checking connection' : health.isError ? 'Connection issue' : 'Systems operational'}</div>
          <p className="mt-2 text-xs leading-5 text-sidebar-foreground/50">A clear morning starts with accurate hours.</p>
        </div>
      </aside>
      {open ? <button className="fixed inset-0 z-30 bg-primary/25 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu overlay" data-testid="button-menu-overlay" /> : null}
      <main className="min-h-[100dvh] lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b hairline bg-background/90 px-5 backdrop-blur-md sm:px-8 lg:px-12">
          <button className="rounded-xl border hairline bg-card p-2.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu className="h-5 w-5" /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><CalendarDays className="h-4 w-4" /> {new Date().getFullYear()} payroll workspace</div>
          <div className="ml-auto flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-display text-sm font-bold text-primary">JR</div><div className="hidden text-right sm:block"><p className="text-xs font-bold">Jamie Reed</p><p className="text-[11px] text-muted-foreground">Owner · Morrow Studio</p></div></div>
        </header>
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
