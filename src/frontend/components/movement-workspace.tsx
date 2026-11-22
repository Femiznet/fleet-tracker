'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Copy,
  MapPin,
  RefreshCw,
  Truck,
  Waypoints,
} from 'lucide-react';
import {
  cancelMovement,
  completeMovement,
  createDirectDispatch,
  createPickup,
  getMovementOptions,
  listActiveMovements,
  markMovementNotified,
} from '@/frontend/actions/movements';
import type {
  ActiveMovement,
  DirectDispatchResult,
  MovementOptions,
} from '@/frontend/types/movement';
import OperationsSidebar from './operations-sidebar';
import styles from './movement-workspace.module.css';

const REFRESH_INTERVAL_MS = 30_000;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function locationMatches(left: string, right: string | null) {
  return left.trim().toLowerCase() === (right ?? '').trim().toLowerCase();
}

function MovementActionCard({
  movement,
  skids,
  onChanged,
}: {
  movement: ActiveMovement;
  skids: MovementOptions['skids'];
  onChanged: () => Promise<void>;
}) {
  const [action, setAction] = useState<'complete' | 'cancel' | null>(null);
  const [returnedSkidId, setReturnedSkidId] = useState(movement.skidIdIn ?? '');
  const [note, setNote] = useState('');
  const [forceOverride, setForceOverride] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null
  );

  const eligibleSkids = useMemo(
    () =>
      skids.filter(
        (skid) =>
          skid.id === movement.skidIdOut ||
          skid.id === movement.skidIdIn ||
          (skid.status === 'at_customer' &&
            (forceOverride || locationMatches(skid.currentLoc, movement.customerGeofence)))
      ),
    [forceOverride, movement.customerGeofence, movement.skidIdIn, movement.skidIdOut, skids]
  );
  const needsInboundLeg =
    movement.type === 'dispatch' && movement.inboundTripStatus === null && !forceOverride;
  const needsPlantConfirmation = !movement.truckAtPlant && !forceOverride;
  const needsReturnNote = !returnedSkidId && !note.trim();
  const canComplete = !needsInboundLeg && !needsPlantConfirmation && !needsReturnNote;
  const movementLabel =
    movement.type === 'pickup'
      ? 'Pickup'
      : movement.currentDirection === 'inbound'
        ? 'Returning dispatch'
        : 'Outbound dispatch';

  async function submitCompletion() {
    if (!canComplete || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await completeMovement(movement.id, {
        skidIdIn: returnedSkidId || undefined,
        note: note.trim() || undefined,
        forceOverride,
      });
      setFeedback({ tone: 'success', text: 'Movement completed and fleet status updated.' });
      await onChanged();
      setAction(null);
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to complete this movement.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitCancellation() {
    if (!confirmCancel || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await cancelMovement(movement.id, note.trim() || undefined);
      setFeedback({ tone: 'success', text: 'Movement cancelled.' });
      await onChanged();
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to cancel this movement.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.movementCard}>
      <header className={styles.movementCardHeader}>
        <div className={styles.movementIcon}>
          {movement.currentDirection === 'inbound' ? (
            <ArrowDownLeft size={17} />
          ) : (
            <ArrowUpRight size={17} />
          )}
        </div>
        <div className={styles.movementHeading}>
          <strong>{movementLabel}</strong>
          <span>
            {movement.truckNum} · {movement.customerName ?? 'Customer unavailable'}
          </span>
        </div>
        <span
          className={`${styles.phaseBadge} ${movement.currentDirection === 'inbound' ? styles.phaseReturning : styles.phaseOutbound}`}
        >
          {movement.currentDirection === 'inbound' ? 'Returning' : 'Outbound / in transit'}
        </span>
      </header>

      <div className={styles.movementFacts}>
        <div>
          <span>Started</span>
          <strong>{formatDate(movement.startedAt)}</strong>
        </div>
        <div>
          <span>Truck location</span>
          <strong>{movement.truckCurrentLoc}</strong>
        </div>
        <div>
          <span>Trip state</span>
          <strong>{movement.currentTripStatus?.replaceAll('_', ' ') ?? 'Trip not detected'}</strong>
        </div>
        <div>
          <span>Outgoing skid</span>
          <strong>{movement.skidNumOut ?? 'None recorded'}</strong>
        </div>
        {movement.skidIdIn ? (
          <div>
            <span>Pickup skid</span>
            <strong>
              {skids.find((skid) => skid.id === movement.skidIdIn)?.skidNum ?? 'Already assigned'}
            </strong>
          </div>
        ) : null}
      </div>

      {movement.note ? <p className={styles.movementNote}>{movement.note}</p> : null}

      <div className={styles.movementActions}>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={() => {
            setAction('complete');
            setConfirmCancel(false);
            setFeedback(null);
          }}
        >
          <CheckCircle2 size={14} /> Complete
        </button>
        <button
          type="button"
          className={styles.buttonDanger}
          onClick={() => {
            setAction('cancel');
            setConfirmCancel(false);
            setFeedback(null);
          }}
        >
          Cancel
        </button>
      </div>

      {action === 'complete' ? (
        <div className={styles.actionPanel}>
          <h3>Confirm return and complete movement</h3>
          <p>
            The truck must be at Gastech Plant. A dispatch also needs a recorded inbound trip unless
            a sensor override is confirmed.
          </p>
          <label className={styles.field}>
            <span>Returned or replacement skid</span>
            <select
              value={returnedSkidId}
              onChange={(event) => setReturnedSkidId(event.target.value)}
              disabled={busy}
            >
              <option value="">No skid returned</option>
              {eligibleSkids.map((skid) => (
                <option value={skid.id} key={skid.id}>
                  {skid.skidNum} · {skid.currentLoc} · {skid.status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>
              {returnedSkidId ? 'Completion note (optional)' : 'Completion note (required)'}
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Record why no skid is returning, or add completion details"
              disabled={busy}
            />
          </label>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={forceOverride}
              onChange={(event) => setForceOverride(event.target.checked)}
              disabled={busy}
            />
            <span>Override missing inbound or plant-location sensor confirmation</span>
          </label>
          {needsInboundLeg || needsPlantConfirmation || needsReturnNote ? (
            <p className={styles.inlineHint}>
              {needsReturnNote
                ? 'Select a returned skid or enter a completion note.'
                : needsPlantConfirmation
                  ? 'Confirm the truck is at Gastech Plant or use the manual override.'
                  : 'Wait for the inbound trip to be detected or use the manual override.'}
            </p>
          ) : null}
          <div className={styles.actionButtons}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => setAction(null)}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={() => void submitCompletion()}
              disabled={!canComplete || busy}
            >
              {busy ? 'Completing…' : 'Confirm completion'}
            </button>
          </div>
        </div>
      ) : null}

      {action === 'cancel' ? (
        <div className={styles.actionPanel}>
          <h3>Cancel movement</h3>
          <p>Active trip legs will be cancelled and eligible truck/skid states reset.</p>
          <label className={styles.field}>
            <span>Cancellation note (optional)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={2000}
              disabled={busy}
            />
          </label>
          {confirmCancel ? (
            <div className={styles.inlineWarning}>
              <AlertTriangle size={14} /> This action cannot be undone.
            </div>
          ) : null}
          <div className={styles.actionButtons}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => setAction(null)}
            >
              Keep movement
            </button>
            <button
              type="button"
              className={styles.buttonDanger}
              onClick={() => {
                if (confirmCancel) void submitCancellation();
                else setConfirmCancel(true);
              }}
              disabled={busy}
            >
              {busy ? 'Cancelling…' : confirmCancel ? 'Confirm cancellation' : 'Cancel movement'}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div className={feedback.tone === 'error' ? styles.errorNotice : styles.successNotice}>
          {feedback.text}
        </div>
      ) : null}
    </article>
  );
}

export default function MovementWorkspace() {
  const [view, setView] = useState<'dispatch' | 'pickup' | 'active'>('dispatch');
  const [options, setOptions] = useState<MovementOptions | null>(null);
  const [activeMovements, setActiveMovements] = useState<ActiveMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatchTruckId, setDispatchTruckId] = useState('');
  const [dispatchCustomerId, setDispatchCustomerId] = useState('');
  const [dispatchSkidId, setDispatchSkidId] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [dispatchOverride, setDispatchOverride] = useState(false);
  const [pickupTruckId, setPickupTruckId] = useState('');
  const [pickupCustomerId, setPickupCustomerId] = useState('');
  const [pickupSkidId, setPickupSkidId] = useState('');
  const [pickupNote, setPickupNote] = useState('');
  const [pickupOverride, setPickupOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null
  );
  const [dispatchResult, setDispatchResult] = useState<DirectDispatchResult | null>(null);
  const [notificationSent, setNotificationSent] = useState(false);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [optionResult, movementResult] = await Promise.allSettled([
      getMovementOptions(),
      listActiveMovements(),
    ]);

    const failures: string[] = [];
    if (optionResult.status === 'fulfilled') setOptions(optionResult.value);
    else {
      failures.push(
        optionResult.reason instanceof Error
          ? optionResult.reason.message
          : 'Unable to load dispatch options.'
      );
    }

    if (movementResult.status === 'fulfilled') setActiveMovements(movementResult.value);
    else {
      failures.push(
        movementResult.reason instanceof Error
          ? movementResult.reason.message
          : 'Unable to load active movements.'
      );
    }

    setError(failures.length ? failures.join(' ') : null);
    if (showLoading) setLoading(false);
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(true), 0);
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refresh]);

  const selectedDispatchTruck = options?.trucks.find((truck) => truck.id === dispatchTruckId);
  const selectedPickupCustomer = options?.customers.find(
    (customer) => customer.id === pickupCustomerId
  );
  const pickupSkids = (options?.skids ?? []).filter(
    (skid) =>
      skid.status === 'at_customer' &&
      (pickupOverride ||
        locationMatches(skid.currentLoc, selectedPickupCustomer?.geofenceName ?? null))
  );
  const availableSkids = (options?.skids ?? []).filter((skid) => skid.status === 'available');

  async function submitDispatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dispatchTruckId || !dispatchCustomerId || !dispatchSkidId || busy) return;
    setBusy(true);
    setFeedback(null);
    setDispatchResult(null);
    setNotificationSent(false);
    try {
      const result = await createDirectDispatch({
        truckId: dispatchTruckId,
        customerId: dispatchCustomerId,
        skidIdOut: dispatchSkidId,
        note: dispatchNote.trim() || undefined,
        forceOverride: dispatchOverride,
      });
      setDispatchResult(result);
      setFeedback({
        tone: 'success',
        text: 'Dispatch created. Copy the notice to send it manually; no message was sent automatically.',
      });
      setDispatchNote('');
      await refresh();
    } catch (actionError) {
      setFeedback({
        tone: 'error',
        text: actionError instanceof Error ? actionError.message : 'Unable to create dispatch.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitPickup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pickupTruckId || !pickupCustomerId || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await createPickup({
        truckId: pickupTruckId,
        customerId: pickupCustomerId,
        skidIdIn: pickupSkidId || undefined,
        note: pickupNote.trim() || undefined,
        forceOverride: pickupOverride,
      });
      setFeedback({
        tone: 'success',
        text: `Pickup created as movement ${result.movementId}.`,
      });
      setPickupSkidId('');
      setPickupNote('');
      await refresh();
    } catch (actionError) {
      setFeedback({
        tone: 'error',
        text: actionError instanceof Error ? actionError.message : 'Unable to create pickup.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyDispatchNotice(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({
        tone: 'success',
        text: 'Dispatch notice copied. Send it through the approved channel.',
      });
    } catch (copyError) {
      setFeedback({
        tone: 'error',
        text:
          copyError instanceof Error ? copyError.message : 'Unable to copy the dispatch notice.',
      });
    }
  }

  async function confirmDispatchSent(movementId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await markMovementNotified(movementId);
      setNotificationSent(true);
      setFeedback({ tone: 'success', text: 'Dispatch notice marked as sent.' });
    } catch (actionError) {
      setFeedback({
        tone: 'error',
        text: actionError instanceof Error ? actionError.message : 'Unable to confirm the notice.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <OperationsSidebar active="movements" />
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>Operations</span>
            <span>/</span>
            <strong>Dispatch & movements</strong>
          </div>
          <span className={styles.refreshLabel}>
            <span className={styles.liveDot} /> Worklist refreshes every 30 seconds
          </span>
        </div>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Fleet operations</p>
            <h1>Dispatch & movements</h1>
            <p>Create direct dispatches or pickups and manage active truck movements.</p>
          </div>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => void refresh(true)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
        </header>

        {error ? <div className={styles.errorNotice}>{error}</div> : null}
        {feedback ? (
          <div className={feedback.tone === 'error' ? styles.errorNotice : styles.successNotice}>
            {feedback.text}
          </div>
        ) : null}

        <nav className={styles.tabs} aria-label="Dispatch and movement actions">
          <button
            type="button"
            className={view === 'dispatch' ? styles.tabActive : styles.tab}
            aria-current={view === 'dispatch' ? 'page' : undefined}
            onClick={() => setView('dispatch')}
          >
            <ArrowUpRight size={14} /> New dispatch
          </button>
          <button
            type="button"
            className={view === 'pickup' ? styles.tabActive : styles.tab}
            aria-current={view === 'pickup' ? 'page' : undefined}
            onClick={() => setView('pickup')}
          >
            <ArrowDownLeft size={14} /> Create pickup
          </button>
          <button
            type="button"
            className={view === 'active' ? styles.tabActive : styles.tab}
            aria-current={view === 'active' ? 'page' : undefined}
            onClick={() => setView('active')}
          >
            <Waypoints size={14} /> Active movements
            {activeMovements.length ? (
              <span className={styles.tabCount}>{activeMovements.length}</span>
            ) : null}
          </button>
        </nav>

        {loading && !options ? (
          <div className={styles.loadingState}>
            <RefreshCw size={17} className="animate-spin" /> Loading fleet options…
          </div>
        ) : !options ? (
          <div className={styles.emptyState}>Dispatch options are unavailable.</div>
        ) : view === 'dispatch' ? (
          <section className={styles.formCard}>
            <header className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>
                <Truck size={16} />
              </span>
              <div>
                <h2>Record a direct dispatch</h2>
                <p>
                  Choose an available truck and outgoing skid. Sensor mismatches require a recorded
                  override.
                </p>
              </div>
            </header>
            <form className={styles.formGrid} onSubmit={submitDispatch}>
              <label className={styles.field}>
                <span>Truck *</span>
                <select
                  required
                  value={dispatchTruckId}
                  onChange={(event) => setDispatchTruckId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Select an available truck</option>
                  {options.trucks.map((truck) => (
                    <option value={truck.id} key={truck.id}>
                      {truck.truckNum} · {truck.currentLoc}
                    </option>
                  ))}
                </select>
                {selectedDispatchTruck?.driverName ? (
                  <small>
                    Driver: {selectedDispatchTruck.driverName}
                    {selectedDispatchTruck.driverContact
                      ? ` · ${selectedDispatchTruck.driverContact}`
                      : ''}
                  </small>
                ) : null}
              </label>
              <label className={styles.field}>
                <span>Customer *</span>
                <select
                  required
                  value={dispatchCustomerId}
                  onChange={(event) => setDispatchCustomerId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Select a customer</option>
                  {options.customers.map((customer) => (
                    <option value={customer.id} key={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Outgoing skid *</span>
                <select
                  required
                  value={dispatchSkidId}
                  onChange={(event) => setDispatchSkidId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Select an available skid</option>
                  {availableSkids.map((skid) => (
                    <option value={skid.id} key={skid.id}>
                      {skid.skidNum} · {skid.currentLoc}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Movement note (optional)</span>
                <textarea
                  value={dispatchNote}
                  onChange={(event) => setDispatchNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                  placeholder="Add dispatch context for the operations team"
                />
              </label>
              <label className={`${styles.checkRow} ${styles.fieldFull}`}>
                <input
                  type="checkbox"
                  checked={dispatchOverride}
                  onChange={(event) => setDispatchOverride(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  Manual sensor override — use only when the displayed truck or skid location is
                  inaccurate
                </span>
              </label>
              <div className={`${styles.formFooter} ${styles.fieldFull}`}>
                <p>
                  Creates the movement and outbound trip together. WhatsApp is never sent
                  automatically.
                </p>
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  disabled={busy || !dispatchTruckId || !dispatchCustomerId || !dispatchSkidId}
                >
                  {busy ? 'Recording…' : 'Record dispatch'}
                </button>
              </div>
            </form>

            {dispatchResult ? (
              <section className={styles.dispatchReceipt} aria-label="Created dispatch notice">
                <div className={styles.receiptHeader}>
                  <span className={styles.receiptIcon}>
                    <CheckCircle2 size={16} />
                  </span>
                  <div>
                    <h3>Dispatch movement recorded</h3>
                    <p>
                      Movement {dispatchResult.movementId} · Reminder due{' '}
                      {formatDate(dispatchResult.notificationDueAt)}
                    </p>
                  </div>
                </div>
                <pre>{dispatchResult.notificationText}</pre>
                <div className={styles.receiptActions}>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => void copyDispatchNotice(dispatchResult.notificationText)}
                  >
                    <Copy size={13} /> Copy dispatch notice
                  </button>
                  <button
                    type="button"
                    className={styles.buttonPrimary}
                    onClick={() => void confirmDispatchSent(dispatchResult.movementId)}
                    disabled={busy || notificationSent}
                  >
                    <CheckCircle2 size={13} />
                    {notificationSent ? 'Marked as sent' : 'Confirm notice sent'}
                  </button>
                </div>
              </section>
            ) : null}
          </section>
        ) : view === 'pickup' ? (
          <section className={styles.formCard}>
            <header className={styles.sectionHeader}>
              <span className={`${styles.sectionIcon} ${styles.sectionIconBlue}`}>
                <ArrowDownLeft size={16} />
              </span>
              <div>
                <h2>Create a skid pickup</h2>
                <p>
                  Start an inbound trip from a customer. A skid may be selected now or recorded when
                  the truck reaches the plant.
                </p>
              </div>
            </header>
            <form className={styles.formGrid} onSubmit={submitPickup}>
              <label className={styles.field}>
                <span>Available truck *</span>
                <select
                  required
                  value={pickupTruckId}
                  onChange={(event) => setPickupTruckId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Select an available truck</option>
                  {options.trucks.map((truck) => (
                    <option value={truck.id} key={truck.id}>
                      {truck.truckNum} · {truck.currentLoc}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Customer *</span>
                <select
                  required
                  value={pickupCustomerId}
                  onChange={(event) => {
                    setPickupCustomerId(event.target.value);
                    setPickupSkidId('');
                  }}
                  disabled={busy}
                >
                  <option value="">Select a customer</option>
                  {options.customers.map((customer) => (
                    <option value={customer.id} key={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Known pickup skid (optional)</span>
                <select
                  value={pickupSkidId}
                  onChange={(event) => setPickupSkidId(event.target.value)}
                  disabled={busy || !pickupCustomerId}
                >
                  <option value="">Record skid at plant</option>
                  {pickupSkids.map((skid) => (
                    <option value={skid.id} key={skid.id}>
                      {skid.skidNum} · {skid.currentLoc}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Pickup note (optional)</span>
                <textarea
                  value={pickupNote}
                  onChange={(event) => setPickupNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                />
              </label>
              <label className={`${styles.checkRow} ${styles.fieldFull}`}>
                <input
                  type="checkbox"
                  checked={pickupOverride}
                  onChange={(event) => {
                    setPickupOverride(event.target.checked);
                    setPickupSkidId('');
                  }}
                  disabled={busy}
                />
                <span>Force override for an inaccurate truck or skid location sensor</span>
              </label>
              <div className={`${styles.formFooter} ${styles.fieldFull}`}>
                <p>A pickup creates an inbound trip and appears in the active movement worklist.</p>
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  disabled={busy || !pickupTruckId || !pickupCustomerId}
                >
                  {busy ? 'Creating…' : 'Create pickup'}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className={styles.activeSection}>
            <header className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>
                <Waypoints size={16} />
              </span>
              <div>
                <h2>Active movements</h2>
                <p>
                  {activeMovements.length} in progress · Dispatches change to returning after the
                  inbound leg is detected.
                </p>
              </div>
            </header>
            {activeMovements.length ? (
              <div className={styles.movementList}>
                {activeMovements.map((movement) => (
                  <MovementActionCard
                    movement={movement}
                    skids={options.skids}
                    key={movement.id}
                    onChanged={() => refresh()}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <CheckCircle2 size={19} />
                <strong>No active movements</strong>
                <span>New dispatches and pickups will appear here.</span>
              </div>
            )}
          </section>
        )}

        <footer className={styles.footerNote}>
          <MapPin size={13} />
          <span>
            Truck location and trip direction come from telemetry. Standby, maintenance, and
            on-ground records remain separate from movement progress.
          </span>
          <Clock3 size={13} />
          <span>Dispatch reminders are managed in Dispatch review.</span>
        </footer>
      </main>
    </div>
  );
}
