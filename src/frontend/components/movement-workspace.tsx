'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Copy,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  Waypoints,
  X,
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
import { useToast } from './toast-provider';
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

type SearchableOption = {
  value: string;
  label: string;
  detail: string;
  searchText?: string;
  scanCode?: string;
};

function SearchableSelect({
  label,
  placeholder,
  emptyMessage,
  helperText,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  label: string;
  placeholder: string;
  emptyMessage: string;
  helperText?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const inputId = useId();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedOption = options.find((option) => option.value === value);
  const inputValue = open ? (query ?? '') : (selectedOption?.label ?? query ?? '');
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.detail} ${option.searchText ?? ''}`
      .toLowerCase()
      .includes((query ?? '').trim().toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  function chooseOption(option: SearchableOption) {
    onChange(option.value);
    setQuery(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!open) {
        setOpen(true);
        setQuery('');
      }
      if (!filteredOptions.length) return;
      event.preventDefault();
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return (current + 1) % filteredOptions.length;
        return current <= 0 ? filteredOptions.length - 1 : current - 1;
      });
      return;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      const normalizedQuery = (query ?? '').trim().toLowerCase();
      const scanMatch = options.find(
        (option) =>
          option.scanCode?.toLowerCase() === normalizedQuery ||
          option.value.toLowerCase() === normalizedQuery
      );
      const option =
        (activeIndex >= 0 ? filteredOptions[activeIndex] : undefined) ??
        scanMatch ??
        (filteredOptions.length === 1 ? filteredOptions[0] : undefined);
      if (option) chooseOption(option);
    }
  }

  return (
    <div className={styles.field}>
      <label className={styles.searchFieldLabel} htmlFor={inputId}>
        {label}
      </label>
      <div
        className={`${styles.searchSelect} ${open ? styles.searchSelectOpen : ''}`}
        ref={containerRef}
      >
        <div className={styles.searchInputWrap}>
          <Search size={14} aria-hidden="true" />
          <input
            id={inputId}
            className={styles.searchInput}
            type="text"
            role="combobox"
            aria-required={required || undefined}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={
              activeIndex >= 0 && filteredOptions[activeIndex]
                ? `${listId}-${activeIndex}`
                : undefined
            }
            autoComplete="off"
            value={inputValue}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => {
              if (query === null) setQuery('');
              setOpen(true);
              setActiveIndex(-1);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
              if (value) onChange('');
            }}
            onKeyDown={handleKeyDown}
          />
          {value && !disabled ? (
            <button
              type="button"
              className={styles.searchClear}
              aria-label={`Clear ${label}`}
              onClick={() => {
                onChange('');
                setQuery(null);
                setOpen(false);
                setActiveIndex(-1);
              }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        {open ? (
          <div className={styles.searchResults} id={listId} role="listbox" aria-label={label}>
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => (
                <button
                  type="button"
                  role="option"
                  id={`${listId}-${index}`}
                  aria-selected={option.value === value}
                  className={`${styles.searchOption} ${activeIndex === index ? styles.searchOptionActive : ''}`}
                  key={option.value}
                  onClick={() => chooseOption(option)}
                >
                  <strong>{option.label}</strong>
                  {option.detail ? <span>{option.detail}</span> : null}
                </button>
              ))
            ) : (
              <p className={styles.searchEmpty}>{emptyMessage}</p>
            )}
          </div>
        ) : null}
        {helperText ? <small>{helperText}</small> : null}
      </div>
    </div>
  );
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
  const showToast = useToast();

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
    try {
      await completeMovement(movement.id, {
        skidIdIn: returnedSkidId || undefined,
        note: note.trim() || undefined,
        forceOverride,
      });
      showToast({ tone: 'success', title: 'Movement completed' });
      await onChanged();
      setAction(null);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Unable to complete movement',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitCancellation() {
    if (!confirmCancel || busy) return;
    setBusy(true);
    try {
      await cancelMovement(movement.id, note.trim() || undefined);
      showToast({ tone: 'success', title: 'Movement cancelled' });
      await onChanged();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Unable to cancel movement',
        description: error instanceof Error ? error.message : 'Try again.',
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
          disabled={busy}
          onClick={() => {
            setAction('complete');
            setConfirmCancel(false);
          }}
        >
          <CheckCircle2 size={14} /> Complete
        </button>
        <button
          type="button"
          className={styles.buttonDanger}
          disabled={busy}
          onClick={() => {
            setAction('cancel');
            setConfirmCancel(false);
          }}
        >
          Cancel
        </button>
      </div>

      {action === 'complete' ? (
        <div className={styles.actionPanel}>
          <h3>Complete movement</h3>
          <p>
            Confirm the truck is at Gastech Plant and the inbound trip is recorded, or apply an
            authorized sensor override.
          </p>
          <SearchableSelect
            label="Returned or replacement skid"
            placeholder="Search or scan skid number"
            emptyMessage="No eligible skids found."
            options={eligibleSkids.map((skid) => ({
              value: skid.id,
              label: skid.skidNum,
              detail: `${skid.currentLoc} · ${skid.status.replaceAll('_', ' ')}`,
              scanCode: skid.skidNum,
            }))}
            value={returnedSkidId}
            onChange={setReturnedSkidId}
            disabled={busy}
          />
          <label className={styles.field}>
            <span>
              {returnedSkidId ? 'Completion notes (optional)' : 'Completion notes (required)'}
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Enter completion notes"
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
            <span>Override missing trip or plant-location confirmation</span>
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
              disabled={busy}
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
          <p>Cancel active trip legs and reset eligible truck and skid statuses.</p>
          <label className={styles.field}>
            <span>Cancellation notes (optional)</span>
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
              disabled={busy}
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
    </article>
  );
}

export default function MovementWorkspace() {
  const [view, setView] = useState<'dispatch' | 'pickup' | 'active'>('dispatch');
  const [options, setOptions] = useState<MovementOptions | null>(null);
  const [activeMovements, setActiveMovements] = useState<ActiveMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshErrorRef = useRef<string | null>(null);
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
  const showToast = useToast();
  const [dispatchResult, setDispatchResult] = useState<DirectDispatchResult | null>(null);
  const [notificationSent, setNotificationSent] = useState(false);
  const [copyingNotice, setCopyingNotice] = useState(false);

  const refresh = useCallback(
    async (showLoading = false) => {
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

      if (failures.length) {
        const message = failures.join(' ');
        if (refreshErrorRef.current !== message) {
          refreshErrorRef.current = message;
          showToast({ tone: 'error', title: 'Movement data unavailable', description: message });
        }
      } else {
        refreshErrorRef.current = null;
      }
      if (showLoading) setLoading(false);
    },
    [showToast]
  );

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
  const truckSearchOptions = useMemo(
    () =>
      (options?.trucks ?? []).map((truck) => ({
        value: truck.id,
        label: truck.truckNum,
        detail: truck.currentLoc,
        searchText: `${truck.driverName ?? ''} ${truck.driverContact ?? ''}`,
        scanCode: truck.truckNum,
      })),
    [options?.trucks]
  );
  const customerSearchOptions = useMemo(
    () =>
      (options?.customers ?? []).map((customer) => ({
        value: customer.id,
        label: customer.name,
        detail: customer.geofenceName ?? 'No geofence assigned',
        searchText: customer.geofenceName ?? '',
        scanCode: customer.name,
      })),
    [options?.customers]
  );
  const pickupSkids = useMemo(
    () =>
      (options?.skids ?? []).filter(
        (skid) =>
          skid.status === 'at_customer' &&
          (pickupOverride ||
            locationMatches(skid.currentLoc, selectedPickupCustomer?.geofenceName ?? null))
      ),
    [options?.skids, pickupOverride, selectedPickupCustomer?.geofenceName]
  );
  const availableSkids = useMemo(
    () => (options?.skids ?? []).filter((skid) => skid.status === 'available'),
    [options?.skids]
  );
  const dispatchSkidSearchOptions = useMemo(
    () =>
      availableSkids.map((skid) => ({
        value: skid.id,
        label: skid.skidNum,
        detail: skid.currentLoc,
        searchText: skid.owner,
        scanCode: skid.skidNum,
      })),
    [availableSkids]
  );
  const pickupSkidSearchOptions = useMemo(
    () =>
      pickupSkids.map((skid) => ({
        value: skid.id,
        label: skid.skidNum,
        detail: skid.currentLoc,
        searchText: skid.owner,
        scanCode: skid.skidNum,
      })),
    [pickupSkids]
  );

  async function submitDispatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dispatchTruckId || !dispatchCustomerId || !dispatchSkidId || busy) return;
    setBusy(true);
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
      showToast({
        tone: 'success',
        title: 'Dispatch recorded',
        description: 'Copy the customer notice and send it through the approved channel.',
      });
      setDispatchNote('');
      await refresh();
    } catch (actionError) {
      showToast({
        tone: 'error',
        title: 'Unable to create dispatch',
        description: actionError instanceof Error ? actionError.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitPickup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pickupTruckId || !pickupCustomerId || busy) return;
    setBusy(true);
    try {
      const result = await createPickup({
        truckId: pickupTruckId,
        customerId: pickupCustomerId,
        skidIdIn: pickupSkidId || undefined,
        note: pickupNote.trim() || undefined,
        forceOverride: pickupOverride,
      });
      showToast({
        tone: 'success',
        title: 'Pickup recorded',
        description: `Movement ${result.movementId} is now active.`,
      });
      setPickupSkidId('');
      setPickupNote('');
      await refresh();
    } catch (actionError) {
      showToast({
        tone: 'error',
        title: 'Unable to create pickup',
        description: actionError instanceof Error ? actionError.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyDispatchNotice(text: string) {
    if (copyingNotice) return;
    setCopyingNotice(true);
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        tone: 'success',
        title: 'Dispatch notice copied',
        description: 'Send it through the approved channel.',
      });
    } catch (copyError) {
      showToast({
        tone: 'error',
        title: 'Unable to copy dispatch notice',
        description: copyError instanceof Error ? copyError.message : 'Try again.',
      });
    } finally {
      setCopyingNotice(false);
    }
  }

  async function confirmDispatchSent(movementId: string) {
    if (busy || notificationSent) return;
    setBusy(true);
    try {
      await markMovementNotified(movementId);
      setNotificationSent(true);
      showToast({ tone: 'success', title: 'Dispatch notice marked as sent' });
    } catch (actionError) {
      showToast({
        tone: 'error',
        title: 'Unable to confirm notice',
        description: actionError instanceof Error ? actionError.message : 'Try again.',
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
            <p>Create dispatches and pickups, then manage active movements.</p>
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
                <h2>Create a dispatch</h2>
                <p>
                  Select an available truck, customer, and skid. Confirm any required location
                  override.
                </p>
              </div>
            </header>
            <form className={styles.formGrid} onSubmit={submitDispatch}>
              <SearchableSelect
                label="Truck number *"
                placeholder="Search or scan a truck number"
                emptyMessage="No available trucks."
                options={truckSearchOptions}
                value={dispatchTruckId}
                onChange={setDispatchTruckId}
                disabled={busy}
                required
                helperText={
                  selectedDispatchTruck?.driverName
                    ? `Driver: ${selectedDispatchTruck.driverName}${
                        selectedDispatchTruck.driverContact
                          ? ` · ${selectedDispatchTruck.driverContact}`
                          : ''
                      }`
                    : undefined
                }
              />
              <SearchableSelect
                label="Customer *"
                placeholder="Search customer name or location"
                emptyMessage="No customers found."
                options={customerSearchOptions}
                value={dispatchCustomerId}
                onChange={setDispatchCustomerId}
                disabled={busy}
                required
              />
              <SearchableSelect
                label="Outbound skid *"
                placeholder="Search or scan a skid number"
                emptyMessage="No available skids."
                options={dispatchSkidSearchOptions}
                value={dispatchSkidId}
                onChange={setDispatchSkidId}
                disabled={busy}
                required
              />
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Movement notes (optional)</span>
                <textarea
                  value={dispatchNote}
                  onChange={(event) => setDispatchNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                  placeholder="Enter movement notes"
                />
              </label>
              <label className={`${styles.checkRow} ${styles.fieldFull}`}>
                <input
                  type="checkbox"
                  checked={dispatchOverride}
                  onChange={(event) => setDispatchOverride(event.target.checked)}
                  disabled={busy}
                />
                <span>Override inaccurate truck or skid location data</span>
              </label>
              <div className={`${styles.formFooter} ${styles.fieldFull}`}>
                <p>
                  Creates the dispatch and outbound trip. No WhatsApp message is sent automatically.
                </p>
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  disabled={busy || !dispatchTruckId || !dispatchCustomerId || !dispatchSkidId}
                >
                  {busy ? 'Creating…' : 'Create dispatch'}
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
                    <h3>Dispatch created</h3>
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
                    disabled={copyingNotice}
                  >
                    <Copy size={13} /> {copyingNotice ? 'Copying…' : 'Copy dispatch message'}
                  </button>
                  <button
                    type="button"
                    className={styles.buttonPrimary}
                    onClick={() => void confirmDispatchSent(dispatchResult.movementId)}
                    disabled={busy || notificationSent}
                  >
                    <CheckCircle2 size={13} />
                    {notificationSent ? 'Marked as sent' : 'Mark message as sent'}
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
                <h2>Create a pickup</h2>
                <p>
                  Create an inbound trip from a customer. Select the skid now or record it when the
                  truck reaches the plant.
                </p>
              </div>
            </header>
            <form className={styles.formGrid} onSubmit={submitPickup}>
              <SearchableSelect
                label="Truck number *"
                placeholder="Search or scan a truck number"
                emptyMessage="No available trucks."
                options={truckSearchOptions}
                value={pickupTruckId}
                onChange={setPickupTruckId}
                disabled={busy}
                required
              />
              <SearchableSelect
                label="Customer *"
                placeholder="Search customer name or location"
                emptyMessage="No customers found."
                options={customerSearchOptions}
                value={pickupCustomerId}
                onChange={(value) => {
                  setPickupCustomerId(value);
                  setPickupSkidId('');
                }}
                disabled={busy}
                required
              />
              <SearchableSelect
                key={pickupCustomerId}
                label="Pickup skid (optional)"
                placeholder="Search or scan a skid number"
                emptyMessage="No eligible pickup skids."
                options={pickupSkidSearchOptions}
                value={pickupSkidId}
                onChange={setPickupSkidId}
                disabled={busy || !pickupCustomerId}
              />
              <label className={styles.field}>
                <span>Pickup notes (optional)</span>
                <textarea
                  value={pickupNote}
                  onChange={(event) => setPickupNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                  placeholder="Enter pickup notes"
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
                <span>Override inaccurate truck or skid location data</span>
              </label>
              <div className={`${styles.formFooter} ${styles.fieldFull}`}>
                <p>Creates an inbound trip and adds it to active movements.</p>
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
                  {activeMovements.length} active movement
                  {activeMovements.length === 1 ? '' : 's'}
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
                <span>Create a dispatch or pickup to start tracking.</span>
              </div>
            )}
          </section>
        )}

        <footer className={styles.footerNote}>
          <MapPin size={13} />
          <span>
            Truck location and direction use live telemetry. Standby, maintenance, and plant status
            are tracked separately.
          </span>
          <Clock3 size={13} />
          <span>Review dispatch reminders in Dispatch.</span>
        </footer>
      </main>
    </div>
  );
}
