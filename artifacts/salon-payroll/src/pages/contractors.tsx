import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, FileKey2, Pencil, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import {
  getListContractorsQueryKey,
  useCreateContractor,
  useDeleteContractor,
  useListContractors,
  useUpdateContractor,
  type Contractor,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Field, inputClass, LoadingRows, Modal, PageHeader, SubmitButton } from '@/components/common';
import { money } from '@/lib/format';
import { toast } from '@/hooks/use-toast';

type ContractorForm = {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  workState: string;
  status: 'active' | 'inactive';
  taxClassification: 'individual' | 'corporation' | 'partnership';
  w9Status: 'missing' | 'on_file';
  taxYear: string;
  ytdReportableCompensation: string;
  stateTaxWithheld: string;
};

const blank: ContractorForm = {
  firstName: '', lastName: '', businessName: '', email: '', workState: 'CO', status: 'active',
  taxClassification: 'individual', w9Status: 'missing', taxYear: String(new Date().getFullYear()),
  ytdReportableCompensation: '0', stateTaxWithheld: '0',
};

export default function ContractorsPage() {
  const queryClient = useQueryClient();
  const contractors = useListContractors();
  const create = useCreateContractor();
  const update = useUpdateContractor();
  const remove = useDeleteContractor();
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ContractorForm>(blank);
  const rows = contractors.data ?? [];
  const activeRows = rows.filter((contractor) => contractor.status === 'active');

  function openCreate() {
    setEditing(null);
    setForm(blank);
    setModalOpen(true);
  }

  function openEdit(contractor: Contractor) {
    setEditing(contractor);
    setForm({
      firstName: contractor.firstName,
      lastName: contractor.lastName,
      businessName: contractor.businessName ?? '',
      email: contractor.email ?? '',
      workState: contractor.workState,
      status: contractor.status,
      taxClassification: contractor.taxClassification,
      w9Status: contractor.w9Status,
      taxYear: String(contractor.taxYear),
      ytdReportableCompensation: String(contractor.ytdReportableCompensation),
      stateTaxWithheld: String(contractor.stateTaxWithheld),
    });
    setModalOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const data = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      businessName: form.businessName.trim() || undefined,
      email: form.email.trim() || undefined,
      workState: form.workState.trim().toUpperCase(),
      status: form.status,
      taxClassification: form.taxClassification,
      w9Status: form.w9Status,
      taxYear: Number(form.taxYear),
      ytdReportableCompensation: Number(form.ytdReportableCompensation),
      stateTaxWithheld: Number(form.stateTaxWithheld),
      taxProfileReviewed: form.w9Status === 'on_file',
    };
    if (!data.firstName || !data.lastName || data.workState.length !== 2 || !Number.isInteger(data.taxYear) || data.taxYear < 2000 || Number.isNaN(data.ytdReportableCompensation) || data.ytdReportableCompensation < 0) {
      toast({ title: 'Complete the required fields', description: 'Name, two-letter state, tax year, and a non-negative compensation amount are required.' });
      return;
    }
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListContractorsQueryKey() });
      setModalOpen(false);
      toast({ title: editing ? 'Contractor record updated' : 'Contractor added' });
    };
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError: () => toast({ title: 'Could not update contractor', variant: 'destructive' }) });
    else create.mutate({ data }, { onSuccess, onError: () => toast({ title: 'Could not add contractor', variant: 'destructive' }) });
  }

  function archive(contractor: Contractor) {
    if (!window.confirm(`Archive ${contractor.firstName} ${contractor.lastName}?`)) return;
    remove.mutate({ id: contractor.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContractorsQueryKey() });
        toast({ title: 'Contractor archived' });
      },
      onError: () => toast({ title: 'Could not archive contractor', variant: 'destructive' }),
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="People & year-end"
        title="Contractors, kept tidy."
        description="Track nonemployee compensation for 1099-NEC preparation without storing TINs or SSNs in this workspace."
        action={<Button onClick={openCreate} data-testid="button-add-contractor"><Plus className="h-4 w-4" /> Add contractor</Button>}
      />

      <section className="mb-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border hairline bg-card p-5 soft-shadow"><p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">Active contractors</p><p className="mt-3 font-display text-3xl font-bold">{activeRows.length}</p><p className="mt-2 text-xs text-muted-foreground">Included in year-end prep</p></div>
        <div className="rounded-2xl border hairline bg-card p-5 soft-shadow"><p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">Reportable compensation</p><p className="mt-3 font-display text-3xl font-bold">{money(activeRows.reduce((sum, contractor) => sum + contractor.ytdReportableCompensation, 0))}</p><p className="mt-2 text-xs text-muted-foreground">For the tracked tax year</p></div>
        <div className="rounded-2xl border hairline bg-card p-5 soft-shadow"><p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">W-9s on file</p><p className="mt-3 font-display text-3xl font-bold">{activeRows.filter((contractor) => contractor.w9Status === 'on_file').length}/{activeRows.length}</p><p className="mt-2 text-xs text-muted-foreground">Identifiers stay outside Morrow</p></div>
      </section>

      <div className="mb-7 flex gap-3 rounded-2xl border border-[hsl(199_45%_48%/0.2)] bg-[hsl(199_45%_48%/0.07)] p-5 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(199_45%_38%)]" />
        <div><p className="font-bold">Secure-by-default recordkeeping</p><p className="mt-1 leading-6 text-muted-foreground">Store the W-9 status here, not the taxpayer identification number. Add the TIN only inside a secure filing provider or official IRS portal when you are ready to submit.</p></div>
      </div>

      {contractors.isLoading ? <LoadingRows count={4} /> : contractors.isError ? <ErrorState onRetry={() => contractors.refetch()} /> : (
        <section className="rounded-2xl border hairline bg-card soft-shadow">
          <div className="border-b hairline p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">1099-NEC records</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">{rows.length ? `${rows.length} contractor${rows.length === 1 ? '' : 's'}` : 'Your contractor roster'}</h2></div>
          {rows.length === 0 ? <div className="p-6"><EmptyState title="No contractors yet" description="Add a contractor to turn the 1099-NEC template into a real year-end prep report." action={<Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" /> Add first contractor</Button>} /></div> : <div className="divide-y divide-[hsl(var(--border)/.7)]">{rows.map((contractor) => (
            <div key={contractor.id} className="group flex flex-col gap-4 p-5 transition-colors hover:bg-secondary/35 sm:flex-row sm:items-center sm:justify-between sm:p-6" data-testid={`row-contractor-${contractor.id}`}>
              <div className="flex items-center gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${contractor.status === 'active' ? 'bg-[hsl(17_70%_63%/0.2)] text-[hsl(10_50%_35%)]' : 'bg-muted text-muted-foreground'}`}>{contractor.businessName ? <Building2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</div><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{contractor.firstName} {contractor.lastName}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${contractor.status === 'active' ? 'bg-[hsl(156_34%_42%/0.13)] text-[hsl(156_34%_34%)]' : 'bg-muted text-muted-foreground'}`}>{contractor.status}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${contractor.w9Status === 'on_file' ? 'bg-[hsl(199_45%_48%/0.13)] text-[hsl(199_45%_38%)]' : 'bg-[hsl(39_75%_59%/0.17)] text-[hsl(34_67%_35%)]'}`}>{contractor.w9Status === 'on_file' ? 'W-9 on file' : 'W-9 needed'}</span></div><p className="mt-1 text-sm text-muted-foreground">{contractor.businessName ?? contractor.taxClassification}{contractor.email ? ` · ${contractor.email}` : ''} · {contractor.workState}</p></div></div>
              <div className="flex items-center justify-between gap-5 sm:justify-end"><div className="text-left sm:text-right"><p className="font-mono text-sm font-bold">{money(contractor.ytdReportableCompensation)}</p><p className="mt-1 text-xs text-muted-foreground">{contractor.taxYear} reportable compensation</p></div><div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><button onClick={() => openEdit(contractor)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Edit ${contractor.firstName} ${contractor.lastName}`}><Pencil className="h-4 w-4" /></button><button onClick={() => archive(contractor)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Archive ${contractor.firstName} ${contractor.lastName}`}><Trash2 className="h-4 w-4" /></button></div></div>
            </div>
          ))}</div>}
        </section>
      )}

      {modalOpen ? <Modal title={editing ? 'Edit contractor record' : 'Add contractor'} description="Track reportable compensation and W-9 readiness without entering a TIN or SSN." onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="First name"><input className={inputClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field><Field label="Last name"><input className={inputClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></Field></div>
          <Field label="Business name" hint="Optional"><input className={inputClass} value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} placeholder="Independent business or studio" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Email" hint="Optional"><input className={inputClass} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field><Field label="Work state" hint="Two-letter code"><input className={inputClass} maxLength={2} value={form.workState} onChange={(event) => setForm({ ...form, workState: event.target.value.toUpperCase() })} required /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Tax classification"><select className={inputClass} value={form.taxClassification} onChange={(event) => setForm({ ...form, taxClassification: event.target.value as ContractorForm['taxClassification'] })}><option value="individual">Individual / sole proprietor</option><option value="corporation">Corporation</option><option value="partnership">Partnership</option></select></Field><Field label="Tax year"><input className={`${inputClass} font-mono`} type="number" min="2000" step="1" value={form.taxYear} onChange={(event) => setForm({ ...form, taxYear: event.target.value })} required /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="W-9 status"><select className={inputClass} value={form.w9Status} onChange={(event) => setForm({ ...form, w9Status: event.target.value as ContractorForm['w9Status'] })}><option value="missing">Needs W-9</option><option value="on_file">W-9 on file</option></select></Field><Field label="Record status"><select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContractorForm['status'] })}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field></div>
          <div className="rounded-xl border hairline bg-secondary/35 p-4"><div className="mb-4 flex items-center gap-2"><FileKey2 className="h-4 w-4 text-accent" /><div><p className="text-sm font-bold">Year-end amounts</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use totals from your books. Do not paste a TIN or SSN here.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Reportable compensation"><input className={`${inputClass} font-mono`} type="number" min="0" step="0.01" value={form.ytdReportableCompensation} onChange={(event) => setForm({ ...form, ytdReportableCompensation: event.target.value })} required /></Field><Field label="State tax withheld"><input className={`${inputClass} font-mono`} type="number" min="0" step="0.01" value={form.stateTaxWithheld} onChange={(event) => setForm({ ...form, stateTaxWithheld: event.target.value })} /></Field></div></div>
          <div className="flex justify-end gap-3 pt-1"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><SubmitButton pending={create.isPending || update.isPending}>{editing ? 'Save changes' : 'Add contractor'}</SubmitButton></div>
        </form>
      </Modal> : null}
    </div>
  );
}