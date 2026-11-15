import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  appointmentsApi,
  type Appointment,
  type AppointmentStatus,
} from '../api/appointments';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';

function formatApptDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatApptTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    doctorName: '',
    location: '',
    date: '',
    time: '10:00',
    notes: '',
    status: 'UPCOMING' as AppointmentStatus,
  });
  const [modalLoading, setModalLoading] = useState(false);

  const fetchAppts = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const data = await appointmentsApi.getAll(user.token);
      setAppointments(data.appointments);
      setCanEdit(data.canEdit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAppts();
  }, [fetchAppts]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleOpenAdd = () => {
    setEditingAppt(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormData({
      title: '',
      doctorName: '',
      location: '',
      date: tomorrow.toISOString().split('T')[0],
      time: '10:00',
      notes: '',
      status: 'UPCOMING',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    const d = new Date(appt.scheduledAt);
    setFormData({
      title: appt.title,
      doctorName: appt.doctorName ?? '',
      location: appt.location ?? '',
      date: d.toISOString().split('T')[0],
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      notes: appt.notes ?? '',
      status: appt.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setModalLoading(true);
    setError('');

    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00.000Z`).toISOString();
      const payload = {
        title: formData.title,
        doctorName: formData.doctorName || null,
        location: formData.location || null,
        scheduledAt,
        notes: formData.notes || null,
        status: formData.status,
      };

      if (editingAppt) {
        const res = await appointmentsApi.update(user.token, editingAppt.id, payload);
        showSuccess(res.message);
      } else {
        const res = await appointmentsApi.create(user.token, payload);
        showSuccess(res.message);
      }

      setIsModalOpen(false);
      fetchAppts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save appointment.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this appointment?')) return;
    try {
      const res = await appointmentsApi.delete(user.token, id);
      showSuccess(res.message);
      fetchAppts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete appointment.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Doctor Appointments
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 mt-1">
            Checkups, routine visits, and consultations
          </p>
        </div>

        {canEdit && (
          <Button onClick={handleOpenAdd} size="lg" className="shrink-0 gap-2 font-bold">
            <span className="text-2xl">+</span> Add Appointment
          </Button>
        )}
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="success-box" role="status">
          <strong>✅ </strong>{successMsg}
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          <strong>⚠️ </strong>{error}
        </div>
      )}

      {/* Family Notice */}
      {user?.role === 'FAMILY' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-4 text-blue-800 dark:text-blue-200 text-lg flex items-center gap-3">
          <span className="text-2xl">👨‍👩‍👧</span>
          <span>You are viewing appointments in read-only mode.</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-xl text-gray-500">Loading appointments…</div>
      ) : appointments.length === 0 ? (
        <Card className="text-center py-12">
          <span className="text-6xl block mb-3">📅</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No appointments scheduled</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">
            Add upcoming doctor appointments to track checkups and consultation visits.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {appointments.map((appt) => {
            const isCompleted = appt.status === 'COMPLETED';
            const isCancelled = appt.status === 'CANCELLED';

            return (
              <div
                key={appt.id}
                className={`
                  p-6 rounded-2xl border-2 transition-all shadow-sm
                  ${isCompleted
                    ? 'bg-gray-50 dark:bg-gray-800/40 border-gray-300 dark:border-gray-700 opacity-80'
                    : isCancelled
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 opacity-70'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }
                `}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xl md:text-2xl font-extrabold text-kindred-600 dark:text-kindred-400">
                        🗓️ {formatApptDate(appt.scheduledAt)} at {formatApptTime(appt.scheduledAt)}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-base font-bold ${
                          isCompleted
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : isCancelled
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {appt.title}
                    </h2>

                    {appt.doctorName && (
                      <p className="text-lg font-medium text-gray-700 dark:text-gray-200 mt-1">
                        👨‍⚕️ <strong>Doctor:</strong> {appt.doctorName}
                      </p>
                    )}

                    {appt.location && (
                      <p className="text-lg text-gray-600 dark:text-gray-300 mt-0.5">
                        📍 <strong>Location:</strong> {appt.location}
                      </p>
                    )}

                    {appt.notes && (
                      <p className="text-base text-gray-500 dark:text-gray-400 mt-2 italic bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl">
                        📝 “{appt.notes}”
                      </p>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(appt)}
                        className="min-h-[48px] px-4 py-2 rounded-xl text-lg font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(appt.id)}
                        className="min-h-[48px] px-4 py-2 rounded-xl text-lg font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {editingAppt ? 'Edit Appointment' : 'Add Appointment'}
            </h2>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <Input
                label="Appointment Title"
                placeholder="e.g., Cardiology Check-up"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <Input
                label="Doctor Name"
                placeholder="e.g., Dr. Priya Sharma"
                value={formData.doctorName}
                onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
              />

              <Input
                label="Hospital / Clinic Location"
                placeholder="e.g., Apollo Hospital, Bangalore Room 304"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
                <Input
                  label="Time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>

              {editingAppt && (
                <div className="flex flex-col gap-2">
                  <label className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Status
                  </label>
                  <select
                    className="input-field"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AppointmentStatus })}
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              )}

              <Input
                label="Notes / Instructions"
                placeholder="e.g., Fasting required for blood work."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />

              <div className="flex items-center justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={modalLoading}>
                  {editingAppt ? 'Save Changes' : 'Schedule Visit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

