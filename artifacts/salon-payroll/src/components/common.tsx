import { type ReactNode } from 'react';
import { AlertCircle, ArrowRight, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-in-up">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h1 className="font-display text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="animate-in-up-delay shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, detail, accent = 'coral', icon }: { label: string; value: string; detail: string; accent?: 'coral' | 'sage' | 'gold' | 'ink'; icon: ReactNode }) {
  const color = { coral: 'bg-accent/15 text-accent', sage: 'bg-[hsl(156_34%_42%/0.13)] text-[hsl(156_34%_34%)]', gold: 'bg-[hsl(39_75%_59%/0.17)] text-[hsl(34_67%_35%)]', ink: 'bg-primary/10 text-primary' }[accent];
  return (
    <div className="lift rounded-2xl border hairline bg-card p-5 soft-shadow" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
          <p className="mt-3 font-display text-3xl font-bold tracking-[-0.05em] text-foreground">{value}</p>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-card/60 px-6 py-12 text-center" data-testid="empty-state">
      <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-secondary text-primary"><ArrowRight className="h-5 w-5" /></div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-destructive/20 bg-destructive/5 ${compact ? 'p-5' : 'px-6 py-12 text-center'}`} data-testid="error-state">
      <div className={`flex ${compact ? 'items-center' : 'flex-col items-center text-center'} gap-3`}>
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        <div><h3 className="font-semibold">We could not load this view</h3><p className="mt-1 text-sm text-muted-foreground">Your data is safe. Try again in a moment.</p></div>
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
      </div>
    </div>
  );
}

export function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className="space-y-3" data-testid="loading-state">{Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton h-[62px] rounded-xl" />)}</div>;
}

export function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/25 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-in-up w-full max-w-lg rounded-t-3xl border hairline bg-card p-6 shadow-2xl sm:rounded-3xl" data-testid="modal">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><h2 className="font-display text-2xl font-bold tracking-[-0.04em]">{title}</h2>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close dialog" data-testid="button-close-modal"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return <Button type="submit" disabled={pending} data-testid="button-submit">{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving</> : <><Check className="h-4 w-4" /> {children}</>}</Button>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block space-y-2 text-sm font-semibold"><span>{label}</span>{children}{hint ? <span className="block text-xs font-normal text-muted-foreground">{hint}</span> : null}</label>;
}

export const inputClass = 'h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm font-normal outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/25';
