import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin, Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { appointmentsApi, type Appointment, type AppointmentStatus } from '../api/appointments';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { addDateKeyDays, formatInTimeZone, localDateInput, localDateTimeToIso, localTimeInput } from '../utils/timezone';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import { Badge } from '../components/StatusChip';
import { Modal } from '../components/Modal';

export function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', doctorName: '', location: '', date: '', time: '10:00', notes: '', status: 'UPCOMING' as AppointmentStatus });

  const fetchAppts = useCallback(async () => {
    if (!user) return;
    try { setError(''); const data = await appointmentsApi.getAll(user.token); setAppointments(data.appointments); setCanEdit(data.canEdit); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load appointments.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void fetchAppts(); }, [fetchAppts]);

  const showSuccess = (message: string) => { setSuccessMsg(message); window.setTimeout(() => setSuccessMsg(''), 4000); };
  const handleOpenAdd = () => {
    setEditingAppt(null);
    setFormData({ title: '', doctorName: '', location: '', date: addDateKeyDays(localDateInput(new Date().toISOString(), user?.timezone), 1), time: '10:00', notes: '', status: 'UPCOMING' });
    setIsModalOpen(true);
  };
  const handleOpenEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    setFormData({ title: appt.title, doctorName: appt.doctorName ?? '', location: appt.location ?? '', date: localDateInput(appt.scheduledAt, user?.timezone), time: localTimeInput(appt.scheduledAt, user?.timezone), notes: appt.notes ?? '', status: appt.status });
    setIsModalOpen(true);
  };
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault(); if (!user) return;
    setModalLoading(true); setError('');
    try {
      const payload = { title: formData.title, doctorName: formData.doctorName || null, location: formData.location || null, scheduledAt: localDateTimeToIso(formData.date, formData.time, user.timezone), notes: formData.notes || null, status: formData.status };
      const result = editingAppt ? await appointmentsApi.update(user.token, editingAppt.id, payload) : await appointmentsApi.create(user.token, payload);
      showSuccess(result.message); setIsModalOpen(false); void fetchAppts();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save appointment.'); }
    finally { setModalLoading(false); }
  };
  const handleDelete = async (id: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this appointment?')) return;
    try { const result = await appointmentsApi.delete(user.token, id); showSuccess(result.message); void fetchAppts(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete appointment.'); }
  };

  return <div className="flex flex-col gap-6">
    <PageHeader title="Appointments" description="Keep upcoming checkups and visits easy to find." action={canEdit && <Button size="lg" onClick={handleOpenAdd}><Plus size={21} aria-hidden="true" /> Add appointment</Button>} />
    <section className="card page-hero" aria-label="Appointment overview"><h2 className="text-2xl font-bold">Care visits, all in one place</h2><p className="mt-1 text-lg text-muted">Keep the next visit and care team details close at hand.</p><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Upcoming visits</span><strong className="mt-1 block text-2xl">{appointments.filter((item) => item.status === 'UPCOMING' && new Date(item.scheduledAt).getTime() >= Date.now()).length}</strong></div><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Next visit</span><strong className="mt-1 block truncate text-2xl">{appointments.filter((item) => item.status === 'UPCOMING' && new Date(item.scheduledAt).getTime() >= Date.now()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]?.title ?? 'None scheduled'}</strong></div><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Care profile</span><strong className="mt-1 block truncate text-2xl">{user?.elderName ?? 'Shared care'}</strong></div></div></section>
    {successMsg && <div className="success-box" role="status">{successMsg}</div>}
    {error && <div className="error-box flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><Button variant="secondary" onClick={() => void fetchAppts()}>Try again</Button></div>}
    {user?.role === 'FAMILY' && <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-lg text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">Appointments are read-only for family members.</div>}
    {loading ? <div className="grid gap-4" role="status" aria-label="Loading appointments"><CardSkeleton /><CardSkeleton /></div> : error && appointments.length === 0 ? <EmptyState title="Appointments could not be loaded" description="Check your connection, then try again." action={<Button onClick={() => void fetchAppts()}>Try again</Button>} /> : appointments.length === 0 ? <EmptyState title="No appointments yet" description="Add an upcoming visit so everyone in the care profile can find the details." icon={<CalendarDays size={36} />} action={canEdit ? <Button onClick={handleOpenAdd}><Plus size={20} aria-hidden="true" /> Add appointment</Button> : undefined} /> : <div className="grid gap-4 xl:grid-cols-2">
      {appointments.map((appt) => <Card key={appt.id} className="flex flex-col justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-lg font-semibold text-caresync-900 dark:text-caresync-100"><CalendarDays size={21} aria-hidden="true" />{formatInTimeZone(appt.scheduledAt, user?.timezone, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {formatInTimeZone(appt.scheduledAt, user?.timezone, { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
            <Badge className={appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' : appt.status === 'CANCELLED' ? 'bg-slate-200 text-slate-950 dark:bg-slate-700 dark:text-slate-100' : 'bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100'}>{appt.status}</Badge>
          </div>
          <h2 className="text-2xl font-bold">{appt.title}</h2>
          {appt.doctorName && <p className="mt-2 flex items-center gap-2 text-lg"><Stethoscope size={20} aria-hidden="true" /><strong>Doctor:</strong> {appt.doctorName}</p>}
          {appt.location && <p className="mt-2 flex items-start gap-2 text-lg"><MapPin size={20} aria-hidden="true" /><span><strong>Location:</strong> {appt.location}</span></p>}
          {appt.notes && <p className="mt-3 rounded-xl surface-subtle p-3 text-lg leading-relaxed">{appt.notes}</p>}
        </div>
        {canEdit && <div className="mt-5 flex gap-3 border-t border-token pt-4">
          <Button variant="secondary" className="flex-1" onClick={() => handleOpenEdit(appt)}><Pencil size={20} aria-hidden="true" /> Edit</Button>
          <Button variant="ghost" onClick={() => void handleDelete(appt.id)} aria-label={`Delete ${appt.title}`}><Trash2 size={20} aria-hidden="true" /> Delete</Button>
        </div>}
      </Card>)}
    </div>}
    {isModalOpen && <Modal title={editingAppt ? 'Edit appointment' : 'Add appointment'} onClose={() => { if (!modalLoading) setIsModalOpen(false); }}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <Input label="Appointment title" placeholder="e.g., Cardiology check-up" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} required />
        <Input label="Doctor name" placeholder="e.g., Dr. Priya Sharma" value={formData.doctorName} onChange={(event) => setFormData({ ...formData, doctorName: event.target.value })} />
        <Input label="Hospital or clinic" value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Date" type="date" value={formData.date} onChange={(event) => setFormData({ ...formData, date: event.target.value })} required />
          <Input label="Time" type="time" value={formData.time} onChange={(event) => setFormData({ ...formData, time: event.target.value })} required />
        </div>
        {editingAppt && <label className="flex flex-col gap-2 text-lg font-semibold">Status<select className="input-field" value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value as AppointmentStatus })}><option value="UPCOMING">Upcoming</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label>}
        <Input label="Notes" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
        <div className="mt-3 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={modalLoading}>Cancel</Button><Button type="submit" isLoading={modalLoading}>{editingAppt ? 'Save changes' : 'Schedule visit'}</Button></div>
      </form>
    </Modal>}
  </div>;
}
