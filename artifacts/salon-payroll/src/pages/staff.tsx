import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2, UserRound, UserRoundCheck } from 'lucide-react';
import { getGetPayrollSummaryQueryKey, getListStaffQueryKey, useCreateStaff, useDeleteStaff, useListStaff, useUpdateStaff, type Staff } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Field, inputClass, LoadingRows, Modal, PageHeader, SubmitButton } from '@/components/common';
import { initials } from '@/lib/format';
import { toast } from '@/hooks/use-toast';

type StaffForm = { firstName: string; lastName: string; role: string; email: string; hourlyRate: string; status: 'active' | 'inactive' };
const blank: StaffForm = { firstName: '', lastName: '', role: '', email: '', hourlyRate: '', status: 'active' };

export default function StaffPage() {
  const queryClient = useQueryClient();
  const staff = useListStaff();
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const remove = useDeleteStaff();
  const [term, setTerm] = useState('');
  const [editing, setEditing] = useState<Staff | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(blank);
  const visible = (staff.data ?? []).filter((person) => `${person.firstName} ${person.lastName} ${person.role}`.toLowerCase().includes(term.toLowerCase()));
  const openCreate = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (person: Staff) => { setEditing(person); setForm({ firstName: person.firstName, lastName: person.lastName, role: person.role, email: person.email ?? '', hourlyRate: String(person.hourlyRate), status: person.status }); setModalOpen(true); };
  const close = () => setModalOpen(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const data = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role.trim(), email: form.email.trim() || undefined, hourlyRate: Number(form.hourlyRate), status: form.status };
    if (!data.firstName || !data.lastName || !data.role || Number.isNaN(data.hourlyRate)) { toast({ title: 'Complete the required fields', description: 'Name, role, and hourly rate are needed.' }); return; }
    const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetPayrollSummaryQueryKey() }); close(); toast({ title: editing ? 'Staff record updated' : 'Staff member added' }); };
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError: () => toast({ title: 'Could not update staff record', variant: 'destructive' }) });
    else create.mutate({ data }, { onSuccess, onError: () => toast({ title: 'Could not add staff member', variant: 'destructive' }) });
  };
  const deletePerson = (person: Staff) => { if (window.confirm(`Remove ${person.firstName} ${person.lastName} from staff?`)) remove.mutate({ id: person.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetPayrollSummaryQueryKey() }); toast({ title: 'Staff member removed' }); }, onError: () => toast({ title: 'Could not remove staff member', variant: 'destructive' }) }); };
  const pending = create.isPending || update.isPending;
  return (
    <div>
      <PageHeader eyebrow="People & rates" title="Your team, in order." description="Keep hourly rates and staff details current so every pay run starts from the right numbers." action={<Button onClick={openCreate} data-testid="button-add-staff"><Plus className="h-4 w-4" /> Add staff</Button>} />
      {staff.isLoading ? <LoadingRows count={5} /> : staff.isError ? <ErrorState onRetry={() => staff.refetch()} /> : <section className="rounded-2xl border hairline bg-card soft-shadow">
        <div className="flex flex-col gap-4 border-b hairline p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="font-display text-xl font-bold tracking-[-0.03em]">Hourly staff</h2><p className="mt-1 text-sm text-muted-foreground">{visible.length} of {(staff.data ?? []).length} people shown</p></div><label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={`${inputClass} pl-9`} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search staff" aria-label="Search staff" data-testid="input-search-staff" /></label></div>
        {visible.length === 0 ? <div className="p-6"><EmptyState title={term ? 'No one matches that search' : 'Your roster is ready for names'} description={term ? 'Try a different name or role.' : 'Add your hourly team so payroll can calculate the right gross pay.'} action={!term ? <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" /> Add first staff member</Button> : undefined} /></div> : <div className="divide-y divide-[hsl(var(--border)/.7)]">{visible.map((person) => <div key={person.id} className="group flex flex-col gap-4 p-5 transition-colors hover:bg-secondary/35 sm:flex-row sm:items-center sm:justify-between sm:p-6" data-testid={`row-staff-${person.id}`}><div className="flex items-center gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${person.status === 'active' ? 'bg-[hsl(17_70%_63%/0.2)] text-[hsl(10_50%_35%)]' : 'bg-muted text-muted-foreground'}`}>{initials(person.firstName, person.lastName)}</div><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{person.firstName} {person.lastName}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${person.status === 'active' ? 'bg-[hsl(156_34%_42%/0.13)] text-[hsl(156_34%_34%)]' : 'bg-muted text-muted-foreground'}`}>{person.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{person.role}{person.email ? ` · ${person.email}` : ''}</p></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-left sm:text-right"><p className="font-mono text-sm font-bold">${person.hourlyRate.toFixed(2)}<span className="font-sans text-xs font-normal text-muted-foreground"> / hour</span></p><p className="mt-1 text-xs text-muted-foreground">{person.status === 'active' ? 'Included in payroll' : 'Not currently paid'}</p></div><div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><button onClick={() => openEdit(person)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Edit ${person.firstName} ${person.lastName}`} data-testid={`button-edit-staff-${person.id}`}><Pencil className="h-4 w-4" /></button><button onClick={() => deletePerson(person)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${person.firstName} ${person.lastName}`} data-testid={`button-delete-staff-${person.id}`}><Trash2 className="h-4 w-4" /></button></div></div></div>)}</div>}
      </section>}
      {modalOpen && <Modal title={editing ? 'Edit staff record' : 'Add staff member'} description="A little detail here makes payday much easier." onClose={close}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="First name"><input className={inputClass} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required data-testid="input-first-name" /></Field><Field label="Last name"><input className={inputClass} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required data-testid="input-last-name" /></Field></div><Field label="Role"><input className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Stylist, assistant, receptionist..." required data-testid="input-role" /></Field><Field label="Email" hint="Optional"><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-staff-email" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Hourly rate"><input className={`${inputClass} font-mono`} type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} required data-testid="input-hourly-rate" /></Field><Field label="Status"><select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StaffForm['status'] })} data-testid="select-staff-status"><option value="active">Active</option><option value="inactive">Inactive</option></select></Field></div><div className="flex justify-end gap-3 pt-3"><Button type="button" variant="ghost" onClick={close} data-testid="button-cancel-staff">Cancel</Button><SubmitButton pending={pending}>{editing ? 'Save changes' : 'Add to team'}</SubmitButton></div></form></Modal>}
    </div>
  );
}
