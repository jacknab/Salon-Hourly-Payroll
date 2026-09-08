import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><AlertCircle className="h-6 w-6" /></div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Quiet corner</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em]">That page is not on the schedule.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">The route you followed is not part of this payroll workspace.</p>
        <Link href="/" className="mt-6 inline-flex"><Button data-testid="button-return-overview"><ArrowLeft className="h-4 w-4" /> Return to overview</Button></Link>
      </div>
    </div>
  );
}
