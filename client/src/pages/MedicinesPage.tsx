import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  medicationsApi,
  type Medication,
  type MedicationProposal,
} from '../api/medications';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';

export function MedicinesPage() {
  const { user } = useAuth();
  const [activeMeds, setActiveMeds] = useState<Medication[]>([]);
  const [pendingNew, setPendingNew] = useState<Medication[]>([]);
  const [pendingChanges, setPendingChanges] = useState<MedicationProposal[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    instructions: '',
    timesStr: '08:00',
    stockCount: 30,
    pillsPerDose: 1,
  });
  const [modalLoading, setModalLoading] = useState(false);

  const fetchMeds = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const data = await medicationsApi.getAll(user.token);
      setActiveMeds(data.active);
      setPendingNew(data.pendingNew);
      setPendingChanges(data.pendingChanges);
      setCanApprove(data.canApprove);
      setCanEdit(data.canEdit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load medicines.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMeds();
  }, [fetchMeds]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleOpenAdd = () => {
    setEditingMed(null);
    setFormData({
      name: '',
      dosage: '',
      instructions: '',
      timesStr: '08:00',
      stockCount: 30,
      pillsPerDose: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingMed(med);
    setFormData({
      name: med.name,
      dosage: med.dosage,
      instructions: med.instructions ?? '',
      timesStr: med.times.join(', '),
      stockCount: med.stockCount,
      pillsPerDose: med.pillsPerDose,
    });
    setIsModalOpen(true);
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const times = formData.timesStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (times.length === 0) {
      setError('Please provide at least one scheduled time (e.g. 08:00).');
      return;
    }

    setModalLoading(true);
    setError('');

    try {
      const payload = {
        name: formData.name,
        dosage: formData.dosage,
        instructions: formData.instructions || null,
        times,
        stockCount: Number(formData.stockCount),
        pillsPerDose: Number(formData.pillsPerDose),
      };

      if (editingMed) {
        const res = await medicationsApi.update(user.token, editingMed.id, payload);
        showSuccess(res.message);
      } else {
        const res = await medicationsApi.create(user.token, payload);
        showSuccess(res.message);
      }

      setIsModalOpen(false);
      fetchMeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save medication.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleApproveNew = async (id: string) => {
    if (!user) return;
    try {
      const res = await medicationsApi.approve(user.token, id);
      showSuccess(res.message);
      fetchMeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve medication.');
    }
  };

  const handleDeclineNew = async (id: string) => {
    if (!user) return;
    try {
      const res = await medicationsApi.decline(user.token, id);
      showSuccess(res.message);
      fetchMeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline medication.');
    }
  };

  const handleApproveProposal = async (proposal: MedicationProposal) => {
    if (!user) return;
    try {
      const res = await medicationsApi.approve(user.token, proposal.medicationId, proposal.id);
      showSuccess(res.message);
      fetchMeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve proposal.');
    }
  };

  const handleDeclineProposal = async (proposal: MedicationProposal) => {
    if (!user) return;
    try {
      const res = await medicationsApi.decline(user.token, proposal.medicationId, proposal.id);
      showSuccess(res.message);
      fetchMeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline proposal.');
    }
  };

  const handleArchive = async (id: string) => {
    if (!user || !window.confirm('Are you sure you want to archive this medication?')) return;
    try {
      const res = await medicationsApi.delete(user.token, id);
      showSuccess(res.message);
      fetchMeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive medication.');
    }
  };

  const totalPending = pendingNew.length + pendingChanges.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Medication Schedule
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 mt-1">
            Active prescriptions and daily dosage routines
          </p>
        </div>

        {canEdit && (
          <Button onClick={handleOpenAdd} size="lg" className="shrink-0 gap-2 font-bold">
            <span className="text-2xl">+</span> Add Medication
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

      {/* Caretaker info notice */}
      {user?.role === 'CARETAKER' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-4 text-amber-800 dark:text-amber-200 text-lg flex items-center gap-3">
          <span className="text-2xl">ℹ️</span>
          <span>
            As a caretaker, when you add or edit medications, they will be saved as <strong>Pending Approval</strong> until confirmed by the elder.
          </span>
        </div>
      )}

      {/* AWAITING APPROVAL BANNER (High Visibility) */}
      {totalPending > 0 && (
        <div className="border-4 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-6 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h2 className="text-2xl font-extrabold text-amber-900 dark:text-amber-100">
                Awaiting Approval ({totalPending})
              </h2>
              <p className="text-lg text-amber-800 dark:text-amber-200">
                {canApprove
                  ? 'Your caretaker proposed the following changes. You are in full control — please review and approve or decline.'
                  : 'The elder must review and approve these items before they are added to the daily schedule.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 mt-4">
            {/* Pending New Medications */}
            {pendingNew.map((med) => (
              <div
                key={med.id}
                className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-amber-300 dark:border-amber-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <span className="inline-block px-2.5 py-1 text-sm font-bold bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded-md mb-2">
                    PROPOSED NEW MEDICINE
                  </span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {med.name} ({med.dosage})
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                    Times: {med.times.join(', ')} • Stock: {med.stockCount} pills
                  </p>
                  {med.instructions && (
                    <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5">
                      Notes: {med.instructions}
                    </p>
                  )}
                </div>

                {canApprove && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveNew(med.id)}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineNew(med.id)}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors"
                    >
                      ✕ Decline
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Pending Changes */}
            {pendingChanges.map((prop) => (
              <div
                key={prop.id}
                className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-amber-300 dark:border-amber-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <span className="inline-block px-2.5 py-1 text-sm font-bold bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-md mb-2">
                    PROPOSED CHANGE TO {prop.medication.name.toUpperCase()}
                  </span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {prop.proposedChanges.name ?? prop.medication.name} (
                    {prop.proposedChanges.dosage ?? prop.medication.dosage})
                  </h3>
                  <div className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                    <strong>New Schedule:</strong>{' '}
                    {prop.proposedChanges.times?.join(', ') ?? prop.medication.times.join(', ')}
                  </div>
                </div>

                {canApprove && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveProposal(prop)}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                    >
                      ✓ Approve Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineProposal(prop)}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors"
                    >
                      ✕ Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Medications List */}
      {loading ? (
        <div className="text-center py-12 text-xl text-gray-500">Loading medicines…</div>
      ) : activeMeds.length === 0 ? (
        <Card className="text-center py-12">
          <span className="text-6xl block mb-3">💊</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No active medications yet</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">
            Click "Add Medication" above to set up daily prescriptions and timings.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activeMeds.map((med) => (
            <div
              key={med.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {med.name}
                  </h3>
                  <span className="px-3 py-1 bg-kindred-100 dark:bg-kindred-900/50 text-kindred-800 dark:text-kindred-200 font-bold rounded-lg text-base shrink-0">
                    {med.dosage}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-lg text-gray-700 dark:text-gray-300">
                    ⏰ <strong>Daily at:</strong>{' '}
                    <span className="font-semibold text-kindred-600 dark:text-kindred-400">
                      {med.times.join('  •  ')}
                    </span>
                  </div>

                  <div className="text-lg text-gray-700 dark:text-gray-300">
                    📦 <strong>Stock:</strong>{' '}
                    <span className={med.stockCount <= 5 ? 'text-red-600 font-bold' : 'font-semibold'}>
                      {med.stockCount} pills remaining
                    </span>
                  </div>

                  {med.instructions && (
                    <div className="text-base text-gray-500 dark:text-gray-400 mt-1 italic">
                      “{med.instructions}”
                    </div>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(med)}
                    className="min-h-[48px] px-4 py-2 rounded-xl text-lg font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors flex-1"
                  >
                    ✏️ Edit
                  </button>

                  {user?.role === 'ELDER' && (
                    <button
                      type="button"
                      onClick={() => handleArchive(med.id)}
                      className="min-h-[48px] px-4 py-2 rounded-xl text-lg font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Archive medication"
                    >
                      Archive
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for Add / Edit Medication */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {editingMed ? 'Edit Medication' : 'Add Medication'}
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">
              {user?.role === 'CARETAKER'
                ? 'Your entry will be sent to the elder for approval.'
                : 'Will take effect immediately on your daily schedule.'}
            </p>

            <form onSubmit={handleSaveMedication} className="flex flex-col gap-4">
              <Input
                label="Medication Name"
                placeholder="e.g., Metformin"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <Input
                label="Dosage"
                placeholder="e.g., 500mg or 1 tablet"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                required
              />

              <Input
                label="Times Per Day (24-hour format, comma-separated)"
                hint="e.g. 08:00, 20:00"
                placeholder="08:00, 20:00"
                value={formData.timesStr}
                onChange={(e) => setFormData({ ...formData, timesStr: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Pills in Stock"
                  type="number"
                  min="0"
                  value={formData.stockCount}
                  onChange={(e) => setFormData({ ...formData, stockCount: Number(e.target.value) })}
                  required
                />
                <Input
                  label="Pills per Dose"
                  type="number"
                  min="1"
                  value={formData.pillsPerDose}
                  onChange={(e) => setFormData({ ...formData, pillsPerDose: Number(e.target.value) })}
                  required
                />
              </div>

              <Input
                label="Instructions / Doctor Notes (Optional)"
                placeholder="e.g., Take with food. Do not chew."
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
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
                  {editingMed ? 'Save Changes' : 'Add Medication'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

