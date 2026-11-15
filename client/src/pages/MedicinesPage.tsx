import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Archive, Check, Clock3, FileImage, Info, PackageCheck, Pencil, Plus, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  medicationsApi,
  type Medication,
  type MedicationProposal,
} from '../api/medications';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { aiApi, type PrescriptionDraft, type PrescriptionFailureReason } from '../api/ai';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { CardSkeleton } from '../components/Skeleton';
import { Badge, StatusChip } from '../components/StatusChip';
import { Modal } from '../components/Modal';

type EditablePrescriptionDraft = PrescriptionDraft & { timesText: string; stockCount: number; pillsPerDose: number; saved: boolean };

function prescriptionFailureMessage(reason?: PrescriptionFailureReason, statusCode?: number): string {
  const details: Record<PrescriptionFailureReason, string> = {
    UNAVAILABLE: 'AI extraction is unavailable', DAILY_CAP: 'the daily AI request limit was reached',
    DATABASE_ERROR: 'the AI request could not be recorded', TIMEOUT: 'the request timed out',
    HTTP_ERROR: `the model request failed${statusCode ? ` (HTTP ${statusCode})` : ''}`,
    TOKEN_LIMIT: 'the model response was cut off', INCOMPLETE: 'the model response was incomplete',
    INVALID_JSON: 'the model response was not valid JSON', TRUNCATED_JSON: 'the model response was truncated',
    INVALID_OUTPUT: 'the model response did not match the expected fields', PROVIDER_ERROR: 'the model request failed',
  };
  return `Couldn't read the prescription (${reason ? details[reason] : 'request failed'}). You can try again or enter it manually.`;
}

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
  const [aiPhotoBusy, setAiPhotoBusy] = useState(false);
  const [aiReview, setAiReview] = useState(false);
  const [aiReviewDrafts, setAiReviewDrafts] = useState<EditablePrescriptionDraft[]>([]);
  const [aiReviewError, setAiReviewError] = useState('');
  const [aiPhotoError, setAiPhotoError] = useState('');
  const [lastPrescriptionFile, setLastPrescriptionFile] = useState<File | null>(null);

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
    setAiReview(false);
    setAiReviewDrafts([]);
    setAiReviewError('');
    setAiPhotoError('');
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

  const handlePrescriptionPhoto = async (file?: File) => {
    if (!user || !file) return;
    setLastPrescriptionFile(file);
    setAiPhotoError('');
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setAiPhotoError('Choose a JPG or PNG photo no larger than 5 MB. You can enter the medicine manually.');
      return;
    }
    setAiPhotoBusy(true);
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read that photo.'));
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.readAsDataURL(file);
      });
      const result = await aiApi.prescriptionDraft(user.token, file.type, imageBase64);
      if (!result.drafts?.length) {
        setAiPhotoError(prescriptionFailureMessage(result.reason, result.statusCode));
        return;
      }
      setEditingMed(null);
      setAiReviewDrafts(result.drafts.map((draft) => ({
        ...draft, timesText: draft.times.join(', '), stockCount: 30, pillsPerDose: 1, saved: false,
      })));
      setAiReview(true);
      setIsModalOpen(true);
    } catch {
      setAiPhotoError(prescriptionFailureMessage());
    } finally {
      setAiPhotoBusy(false);
    }
  };

  const updateAIReviewDraft = (index: number, values: Partial<EditablePrescriptionDraft>) => {
    setAiReviewDrafts((current) => current.map((draft, itemIndex) => itemIndex === index ? { ...draft, ...values } : draft));
  };

  const handleConfirmAIReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const invalidIndex = aiReviewDrafts.findIndex((draft) => !draft.name.trim() || !draft.dosage.trim() || !draft.timesText.trim());
    if (invalidIndex >= 0) {
      setAiReviewError(`Medicine ${invalidIndex + 1} needs a name, dose, and at least one scheduled time before saving.`);
      return;
    }
    const invalidTimesIndex = aiReviewDrafts.findIndex((draft) => draft.timesText.split(',').some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())));
    if (invalidTimesIndex >= 0) {
      setAiReviewError(`Check the 24-hour times for medicine ${invalidTimesIndex + 1}, for example 08:00.`);
      return;
    }
    setModalLoading(true);
    setAiReviewError('');
    const nextDrafts = [...aiReviewDrafts];
    try {
      for (let index = 0; index < nextDrafts.length; index++) {
        const draft = nextDrafts[index];
        if (draft.saved) continue;
        const frequencyNote = draft.frequency.trim() ? `Frequency: ${draft.frequency.trim()}` : '';
        const instructions = [draft.instructions.trim(), frequencyNote].filter(Boolean).join('\n');
        try {
          await medicationsApi.create(user.token, {
            name: draft.name.trim(), dosage: draft.dosage.trim(),
            instructions: instructions || null,
            times: draft.timesText.split(',').map((time) => time.trim()),
            stockCount: Number(draft.stockCount), pillsPerDose: Number(draft.pillsPerDose),
          });
          nextDrafts[index] = { ...draft, saved: true };
          setAiReviewDrafts([...nextDrafts]);
        } catch {
          const savedCount = nextDrafts.filter((item) => item.saved).length;
          setAiReviewError(`Couldn't save medicine ${index + 1}. ${savedCount} of ${nextDrafts.length} were saved; the remaining drafts are still here to review and try again.`);
          return;
        }
      }
      setIsModalOpen(false);
      setAiReview(false);
      setAiReviewDrafts([]);
      showSuccess(`Confirmed and saved ${nextDrafts.length} medicine drafts.`);
      void fetchMeds();
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingMed(med);
    setAiReview(false);
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
    <div className="flex flex-col gap-6">
        <PageHeader title="Medicines" description="Your active prescriptions, schedules, and refill status." action={canEdit && <Button onClick={handleOpenAdd} size="lg"><Plus size={22} aria-hidden="true" /> Add medicine</Button>} />
        <section className="card page-hero" aria-label="Medicine overview"><h2 className="text-2xl font-bold">Your medicine cabinet</h2><p className="mt-1 text-lg text-muted">A clear view of what is scheduled and what may need attention.</p><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Active medicines</span><strong className="mt-1 block text-2xl">{activeMeds.length}</strong></div><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Needs a refill</span><strong className="mt-1 block text-2xl">{activeMeds.filter((med) => Math.floor(med.stockCount / (Math.max(1, med.pillsPerDose) * Math.max(1, med.times.length))) <= 5).length}</strong></div><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Awaiting review</span><strong className="mt-1 block text-2xl">{pendingNew.length + pendingChanges.length}</strong></div></div></section>

      {/* Messages */}
      {successMsg && (
        <div className="success-box" role="status">
          <Check className="mr-2 inline-block" aria-hidden="true" />{successMsg}
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          <AlertTriangle className="mr-2 inline-block" aria-hidden="true" />{error} <Button variant="secondary" className="ml-2" onClick={fetchMeds}>Try again</Button>
        </div>
      )}

      {/* Caretaker info notice */}
      {user?.role === 'CARETAKER' && (
        <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-lg text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 flex items-center gap-3">
          <Info aria-hidden="true" />
          <span>
            As a caretaker, when you add or edit medications, they will be saved as <strong>Pending Approval</strong> until confirmed by the elder.
          </span>
        </div>
      )}

      {canEdit && <div className="rounded-2xl border border-dashed border-caresync-600 bg-caresync-50/70 p-5 dark:border-caresync-400 dark:bg-caresync-950/30">
        <div className="mb-3 flex items-start gap-3"><FileImage className="mt-1 text-caresync-800 dark:text-caresync-200" size={26} aria-hidden="true" /><div><h2 className="text-xl font-bold">Start from a prescription photo <span className="text-muted">(optional)</span></h2><p className="mt-1 text-lg text-muted">JPG or PNG, up to 5 MB. The image is processed in memory and not saved.</p></div></div>
        <label className="flex min-h-14 flex-wrap items-center gap-3 rounded-xl border border-token bg-white px-4 py-3 text-lg font-semibold dark:bg-slate-900" htmlFor="prescription-photo">
          <Upload size={22} aria-hidden="true" /> Choose a prescription image
          <input id="prescription-photo" className="w-full text-lg file:mr-3 file:min-h-12 file:rounded-lg file:border-0 file:bg-caresync-700 file:px-4 file:font-semibold file:text-white" type="file" accept="image/jpeg,image/png" disabled={aiPhotoBusy} onChange={e => { void handlePrescriptionPhoto(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        </label>
        {aiPhotoBusy && <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-4 text-lg dark:bg-slate-900" role="status"><span className="skeleton h-6 w-6 rounded-full" /> Reading your photo. This can take a few seconds…</div>}
        {aiPhotoError && <div className="error-box mt-3" role="alert">
          <p>{aiPhotoError}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <Button variant="secondary" disabled={aiPhotoBusy || !lastPrescriptionFile} onClick={() => void handlePrescriptionPhoto(lastPrescriptionFile ?? undefined)}>Try again</Button>
            <Button onClick={handleOpenAdd}>Enter manually</Button>
          </div>
        </div>}
      </div>}

      {/* AWAITING APPROVAL BANNER (High Visibility) */}
      {totalPending > 0 && (
        <div className="card border-l-4 border-l-amber-600">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={28} className="shrink-0 text-amber-800 dark:text-amber-200" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-bold">
                Awaiting Approval ({totalPending})
              </h2>
              <p className="text-lg text-muted">
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
                  className="rounded-xl border border-token p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <span className="inline-block px-2.5 py-1 text-lg font-bold bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100 rounded-md mb-2">
                    PROPOSED NEW MEDICINE
                  </span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {med.name} ({med.dosage})
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                    Times: {med.times.join(', ')} • Stock: {med.stockCount} pills
                  </p>
                  {med.instructions && (
                    <p className="text-lg text-muted mt-0.5">
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
                      <Check size={20} aria-hidden="true" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineNew(med.id)}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors"
                    >
                      <X size={20} aria-hidden="true" /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Pending Changes */}
            {pendingChanges.map((prop) => (
              <div
                key={prop.id}
                  className="rounded-xl border border-token p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <span className="inline-block px-2.5 py-1 text-lg font-bold bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 rounded-md mb-2">
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
                      <Check size={20} aria-hidden="true" /> Approve changes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineProposal(prop)}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors"
                    >
                      <X size={20} aria-hidden="true" /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading medicines"><CardSkeleton /><CardSkeleton /></div> : error && activeMeds.length === 0 ? <EmptyState title="Medicines could not be loaded" description="Check your connection, then try loading the medicine list again." action={<Button onClick={fetchMeds}>Try again</Button>} /> : activeMeds.length === 0 ? <EmptyState title="No active medicines" description="Add a medicine to create a schedule and track its stock." icon={<PackageCheck size={36} />} action={canEdit ? <Button onClick={handleOpenAdd}><Plus size={20} aria-hidden="true" /> Add medicine</Button> : undefined} /> : <>
        <section className="flex flex-col gap-3" aria-label="Refill alerts">
          {activeMeds.filter((med) => Math.floor(med.stockCount / (Math.max(1, med.pillsPerDose) * Math.max(1, med.times.length))) <= 5).map((med) => {
            const days = Math.floor(med.stockCount / (Math.max(1, med.pillsPerDose) * Math.max(1, med.times.length)));
            const critical = days <= 2;
            return <div key={med.id} role="status" className={`flex items-center gap-3 rounded-xl border p-4 text-lg font-semibold ${critical ? 'border-rose-600 bg-rose-50 text-rose-950 dark:bg-rose-950 dark:text-rose-100' : 'border-amber-600 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}`}>
              <AlertTriangle aria-hidden="true" /><span>{critical ? 'Refill needed' : 'Refill soon'}: {med.name} has about {days} days of supply left.</span>
            </div>;
          })}
        </section>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {activeMeds.map((med) => {
            const dosesPerDay = Math.max(1, med.pillsPerDose * med.times.length);
            const daysLeft = Math.floor(med.stockCount / dosesPerDay);
            const stockPercent = Math.max(0, Math.min(100, Math.round(daysLeft / 30 * 100)));
            return <Card key={med.id} className="flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-2xl font-bold">{med.name}</h3>
                  <Badge className="bg-caresync-100 text-caresync-950 dark:bg-caresync-900 dark:text-caresync-100">{med.dosage}</Badge>
                </div>
                <p className="mt-4 flex flex-wrap items-center gap-2 text-lg"><Clock3 size={21} aria-hidden="true" /><strong>Scheduled times:</strong> {med.times.join(', ')}</p>
                <p className="mt-2 flex items-center gap-2 text-lg"><PackageCheck size={21} aria-hidden="true" /><strong>Stock:</strong> {med.stockCount} pills</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {daysLeft <= 2 ? <StatusChip status="MISSED" label={`Refill soon - about ${daysLeft} days left`} icon={<AlertTriangle size={18} aria-hidden="true" />} /> : daysLeft <= 5 ? <StatusChip status="DUE" label={`Refill soon - about ${daysLeft} days left`} icon={<AlertTriangle size={18} aria-hidden="true" />} /> : <Badge className="bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">Stock level OK - about {daysLeft} days</Badge>}
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="meter" aria-label={`Estimated supply for ${med.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stockPercent} aria-valuetext={`About ${daysLeft} days of supply`}>
                  <div className={`h-full rounded-full ${daysLeft <= 2 ? 'bg-rose-700 dark:bg-rose-400' : daysLeft <= 5 ? 'bg-amber-700 dark:bg-amber-400' : 'bg-emerald-700 dark:bg-emerald-400'}`} style={{ width: `${stockPercent}%` }} />
                </div>
                {med.instructions && <p className="mt-3 text-lg leading-relaxed text-muted">{med.instructions}</p>}
              </div>
              {canEdit && <div className="mt-6 flex gap-3 border-t border-token pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => handleOpenEdit(med)}><Pencil size={20} aria-hidden="true" /> Edit</Button>
                {user?.role === 'ELDER' && <Button variant="ghost" onClick={() => handleArchive(med.id)} aria-label={`Archive ${med.name}`}><Archive size={20} aria-hidden="true" /> Archive</Button>}
              </div>}
            </Card>;
          })}
        </div>
      </>}

      {/* Modal for Add / Edit Medication */}
      {isModalOpen && (
        <Modal title={aiReview ? `Review ${aiReviewDrafts.length} prescription medicines` : editingMed ? 'Edit medicine' : 'Add medicine'} onClose={() => { if (!modalLoading) setIsModalOpen(false); }}>
          <div className="flex flex-col gap-4">
            {!aiReview && <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">
              {user?.role === 'CARETAKER'
                ? 'Your entry will be sent to the elder for approval.'
                : 'Will take effect immediately on your daily schedule.'}
            </p>}

            {aiReview ? <form onSubmit={handleConfirmAIReview} className="flex flex-col gap-4">
              <div className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 rounded-xl p-4 text-lg font-bold" role="note">
                AI-extracted. Please check against your prescription. Review and edit every field. Nothing is saved until you confirm.
              </div>
              {aiReviewDrafts.map((draft, index) => <section key={index} className="border-2 border-gray-300 dark:border-gray-600 rounded-xl p-4 flex flex-col gap-3" aria-label={`Medicine draft ${index + 1}`}>
                <h3 className="text-2xl font-bold">Medicine {index + 1}{draft.saved ? ' — Saved' : ''}</h3>
                <Input label="Medicine name" value={draft.name} onChange={(event) => updateAIReviewDraft(index, { name: event.target.value })} required disabled={draft.saved} />
                <Input label="Dose" value={draft.dosage} onChange={(event) => updateAIReviewDraft(index, { dosage: event.target.value })} required disabled={draft.saved} />
                <Input label="Frequency as written" value={draft.frequency} onChange={(event) => updateAIReviewDraft(index, { frequency: event.target.value })} disabled={draft.saved} />
                <Input label="Scheduled times (24-hour, comma-separated)" hint="For example: 08:00, 20:00" value={draft.timesText} onChange={(event) => updateAIReviewDraft(index, { timesText: event.target.value })} required disabled={draft.saved} />
                <Input label="Instructions / notes" value={draft.instructions} onChange={(event) => updateAIReviewDraft(index, { instructions: event.target.value })} disabled={draft.saved} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Pills in stock (estimate)" type="number" min="0" value={draft.stockCount} onChange={(event) => updateAIReviewDraft(index, { stockCount: Number(event.target.value) })} required disabled={draft.saved} />
                  <Input label="Pills per dose" type="number" min="1" value={draft.pillsPerDose} onChange={(event) => updateAIReviewDraft(index, { pillsPerDose: Number(event.target.value) })} required disabled={draft.saved} />
                </div>
              </section>)}
              <p className="text-lg text-muted">Frequency is retained with the saved instruction notes; the schedule uses the times field above.</p>
              {user?.role === 'CARETAKER' && <p className="text-lg">After confirmation, each medicine still needs the elder’s approval.</p>}
              {aiReviewError && <div className="error-box" role="alert">{aiReviewError}</div>}
              <div className="flex items-center justify-end gap-3 mt-3">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={modalLoading}>Cancel</Button>
                <Button type="submit" isLoading={modalLoading} disabled={aiReviewDrafts.every((draft) => draft.saved)}>
                  Confirm and save {aiReviewDrafts.filter((draft) => !draft.saved).length} drafts
                </Button>
              </div>
            </form> : <form onSubmit={handleSaveMedication} className="flex flex-col gap-4">
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
            </form>}
          </div>
        </Modal>
      )}
    </div>
  );
}

