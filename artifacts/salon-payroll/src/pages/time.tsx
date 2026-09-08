import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { getGetPayrollSummaryQueryKey, getListTimeEntriesQueryKey, useCreateTimeEntry, useDeleteTimeEntry, useListStaff, useListTimeEntries, useUpdateTimeEntry, type TimeEntry } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Field, inputClass, LoadingRows, Modal, PageHeader, SubmitButton } from '@/components/common';
import { dateLabel } from '@/lib/format';
import { toast } from '@/hooks/use-toast';

type EntryForm = { staffId: string; workDate: string; hours: string; note: string };
const today = new Date().toISOString().slice(0, 10);
const blank: EntryForm = { staffId: '', workDate: today, hours: '', note: '' };

export default function TimePage() {
  const queryClient = useQueryClient();
  const params = { limit: 100 };
  const entries = useListTimeEntries(params);
  const staff = useListStaff();
  const create = useCreateTimeEntry();
  const update = useUpdateTimeEntry();
  const remove = useDeleteTimeEntry();
  const [term, setTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(blank);
  const shown = (entries.data ?? []).filter((entry) => `${entry.staffName} ${entry.note ?? ''}`.toLowerCase().includes(term.toLowerCase()));
  const openCreate = () => { setEditing(null); setForm({ ...blank, staffId: staff.data?.[0] ? String(staff.data[0].id) : '' }); setModalOpen(true); };
  const openEdit = (entry: TimeEntry) => { setEditing(entry); setForm({ staffId: String(entry.staffId), workDate: entry.workDate, hours: String(entry.hours), note: entry.note ?? '' }); setModalOpen(true); };
  const close = () => setModalOpen(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const data = { staffId: Number(form.staffId), workDate: form.workDate, hours: Number(form.hours), note: form.note.trim() || undefined };
    if (!data.staffId || !data.workDate || Number.isNaN(data.hours) || data.hours < 0 || data.hours > 24) { toast({ title: 'Check the time entry', description: 'Choose a staff member and enter between 0 and 24 hours.' }); return; }
    const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey(params) }); queryClient.invalidateQueries({ queryKey: getGetPayrollSummaryQueryKey() }); close(); toast({ title: editing ? 'Time entry updated' : 'Hours added' }); };
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError: () => toast({ title: 'Could not update time entry', variant: 'destructive' }) });
    else create.mutate({ data }, { onSuccess, onError: () => toast({ title: 'Could not add time entry', variant: 'destructive' }) });
  };
  const deleteEntry = (entry: TimeEntry) => { if (window.confirm(`Delete ${entry.hours} hours for ${entry.staffName}?`)) remove.mutate({ id: entry.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey(params) }); queryClient.invalidateQueries({ queryKey: getGetPayrollSummaryQueryKey() }); toast({ title: 'Time entry deleted' }); }, onError: () => toast({ title: 'Could not delete time entry', variant: 'destructive' }) }); };
  return (
    <div>
      <PageHeader eyebrow="Hours & attendance" title="Make every hour count." description="Review the hours your team has worked, then make quick corrections before payroll is calculated." action={<Button onClick={openCreate} data-testid="button-add-time-entry"><Plus className="h-4 w-4" /> Add time</Button>} />
      {entries.isLoading || staff.isLoading ? <LoadingRows count={6} /> : entries.isError || staff.isError ? <ErrorState onRetry={() => { entries.refetch(); staff.refetch(); }} /> : <section className="rounded-2xl border hairline bg-card soft-shadow">
        <div className="flex flex-col gap-4 border-b hairline p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="font-display text-xl font-bold tracking-[-0.03em]">Time entries</h2><p className="mt-1 text-sm text-muted-foreground">Most recent first · {shown.length} entries</p></div><label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={`${inputClass} pl-9`} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by staff or note" aria-label="Search time entries" data-testid="input-search-time" /></label></div>
        {shown.length === 0 ? <div className="p-6"><EmptyState title={term ? 'No entries match that search' : 'The timesheet is clear'} description={term ? 'Try a different name or note.' : 'Log the first shift to start building this pay period.'} action={!term ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add first entry</Button> : undefined} /></div> : <div className="divide-y divide-[hsl(var(--border)/.7)]">{shown.map((entry) => <div key={entry.id} className="group flex flex-col gap-4 p-5 transition-colors hover:bg-secondary/35 sm:flex-row sm:items-center sm:justify-between sm:p-6" data-testid={`row-time-entry-${entry.id}`}><div className="flex items-center gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary font-display text-sm font-bold text-primary">{entry.staffName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><p className="font-bold">{entry.staffName}</p><p className="mt-1 text-sm text-muted-foreground">{dateLabel(entry.workDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}{entry.note ? ` · ${entry.note}` : ''}</p></div></div><div className="flex items-center justify-between gap-5 sm:justify-end"><p className="font-mono text-lg font-bold">{entry.hours.toFixed(1)}<span className="font-sans text-xs font-normal text-muted-foreground"> hours</span></p><div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><button onClick={() => openEdit(entry)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Edit time entry for ${entry.staffName}`} data-testid={`button-edit-time-${entry.id}`}><Pencil className="h-4 w-4" /></button><button onClick={() => deleteEntry(entry)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete time entry for ${entry.staffName}`} data-testid={`button-delete-time-${entry.id}`}><Trash2 className="h-4 w-4" /></button></div></div></div>)}</div>}
      </section>}
      {modalOpen ? <Modal title={editing ? 'Edit time entry' : 'Add time entry'} description="Keep the day and hours precise; payroll does the rest." onClose={close}><form onSubmit={submit} className="space-y-4"><Field label="Staff member"><select className={inputClass} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} required data-testid="select-time-staff"><option value="" disabled>Select staff member</option>{(staff.data ?? []).filter((person) => person.status === 'active').map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName} · {person.role}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Work date"><input className={inputClass} type="date" value={form.workDate} onChange={(e) => setForm({ ...form, workDate: e.target.value })} required data-testid="input-work-date" /></Field><Field label="Hours" hint="Up to 24 hours"><input className={`${inputClass} font-mono`} type="number" min="0" max="24" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required data-testid="input-hours" /></Field></div><Field label="Note" hint="Optional"><input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Opening shift, training, cover..." data-testid="input-time-note" /></Field><div className="flex justify-end gap-3 pt-3"><Button type="button" variant="ghost" onClick={close} data-testid="button-cancel-time">Cancel</Button><SubmitButton pending={create.isPending || update.isPending}>{editing ? 'Save changes' : 'Add hours'}</SubmitButton></div></form></Modal> : null}
    </div>
  );
}
