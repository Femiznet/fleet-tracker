'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Inbox,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  approveDispatchMessage,
  listDispatchMessages,
  listDispatchNotifications,
  rejectDispatchMessage,
} from '@/frontend/actions/dispatch-review';
import type {
  DispatchDetails,
  DispatchMessage,
  DispatchNotification,
  PaginationMeta,
  ReviewStatus,
} from '@/frontend/types/dispatch-review';
import OperationsSidebar from './operations-sidebar';
import styles from './dispatch-inbox.module.css';

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 30_000;

const EMPTY_DETAILS: DispatchDetails = {
  truckNumber: null,
  skidNumber: null,
  driverName: null,
  customerName: null,
  dateOut: null,
  timeOut: null,
  driverContact: null,
};

type StatusFilter = ReviewStatus | 'all';
type Feedback = { tone: 'success' | 'error'; text: string; copyText?: string };

function displayDate(value: string | null, includeTime = false) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

function statusClass(status: string | null) {
  switch (status) {
    case 'pending': return styles.badgePending;
    case 'approved': return styles.badgeApproved;
    case 'rejected': return styles.badgeRejected;
    case 'duplicate': return styles.badgeDuplicate;
    default: return '';
  }
}

function statusLabel(status: string | null) {
  return status ?? 'unreviewed';
}

function setDetailField(
  field: keyof DispatchDetails,
  event: ChangeEvent<HTMLInputElement>,
  setDetails: Dispatch<SetStateAction<DispatchDetails>>
) {
  const value = event.target.value.trim() ? event.target.value : null;
  setDetails((current) => ({ ...current, [field]: value }));
}

export default function DispatchInbox() {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<DispatchMessage[]>([]);
  const [notifications, setNotifications] = useState<DispatchNotification[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<DispatchDetails>(EMPTY_DETAILS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyAction, setBusyAction] = useState<'approve' | 'reject' | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [inboxResult, reminderResult] = await Promise.allSettled([
      listDispatchMessages({ reviewStatus: filter, page, limit: PAGE_SIZE }),
      listDispatchNotifications(),
    ]);

    if (inboxResult.status === 'fulfilled') {
      setMessages(inboxResult.value.messages);
      setPagination(inboxResult.value.pagination);
      setLoadError(null);

      const selected = inboxResult.value.messages.find(
        (message) => message.id === selectedIdRef.current
      ) ?? inboxResult.value.messages[0] ?? null;
      if (selected?.id !== selectedIdRef.current) {
        selectedIdRef.current = selected?.id ?? null;
        setSelectedId(selected?.id ?? null);
        setDetails(selected?.parsedData ?? EMPTY_DETAILS);
      }
    } else {
      setLoadError(inboxResult.reason instanceof Error
        ? inboxResult.reason.message
        : 'Unable to load dispatch messages.');
    }

    if (reminderResult.status === 'fulfilled') {
      setNotifications(reminderResult.value);
      setReminderError(null);
    } else {
      setReminderError(reminderResult.reason instanceof Error
        ? reminderResult.reason.message
        : 'Unable to load dispatch reminders.');
    }
    if (showLoading) setLoading(false);
  }, [filter, page]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const selectedMessage = messages.find((message) => message.id === selectedId) ?? null;
  const overdueCount = notifications.filter((notification) => notification.overdue).length;
  const canApprove = Boolean(
    details.truckNumber?.trim()
    && details.skidNumber?.trim()
    && details.dateOut?.trim()
  );
  const canReview = selectedMessage?.reviewStatus === 'pending';

  function selectMessage(message: DispatchMessage) {
    selectedIdRef.current = message.id;
    setSelectedId(message.id);
    setDetails(message.parsedData ?? EMPTY_DETAILS);
    setFeedback(null);
  }

  function updateField(field: keyof DispatchDetails) {
    return (event: ChangeEvent<HTMLInputElement>) => setDetailField(field, event, setDetails);
  }

  async function handleApprove() {
    if (!selectedMessage || !canReview || !canApprove) return;
    setBusyAction('approve');
    setFeedback(null);
    try {
      const result = await approveDispatchMessage(selectedMessage.id, details);
      if (result.status === 'duplicate') {
        setFeedback({
          tone: 'error',
          text: `This dispatch duplicates an approved message (${result.duplicateOfMessageId}).`,
        });
      } else {
        setFeedback({
          tone: 'success',
          text: 'Dispatch approved. Copy the notice to send it manually; this app will not send it.',
          copyText: result.notificationText,
        });
      }
      await refresh();
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to approve this dispatch.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    if (!selectedMessage || !canReview) return;
    setBusyAction('reject');
    setFeedback(null);
    try {
      await rejectDispatchMessage(selectedMessage.id);
      setFeedback({ tone: 'success', text: 'Dispatch rejected.' });
      await refresh();
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to reject this dispatch.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function copyNotice(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ tone: 'success', text: 'Dispatch notice copied to clipboard.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to copy the dispatch notice.',
      });
    }
  }

  function changeFilter(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (
      value !== 'pending'
      && value !== 'duplicate'
      && value !== 'approved'
      && value !== 'rejected'
      && value !== 'all'
    ) return;
    setFilter(value);
    setPage(1);
    selectedIdRef.current = null;
    setSelectedId(null);
    setDetails(EMPTY_DETAILS);
    setFeedback(null);
  }

  return (
    <div className={styles.shell}>
      <OperationsSidebar
        active="dispatch"
        pendingDispatchCount={filter === 'pending' ? pagination?.total : undefined}
      />

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumb}><span>Operations</span><span>/</span><strong>Dispatch</strong></div>
          <div className={styles.topbarRight}><span className={styles.liveDot} /> Inbox refreshes every 30 seconds</div>
        </div>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Operations / Messaging</p>
            <h1 className={styles.title}>Dispatch review</h1>
            <p className={styles.subtitle}>Review incoming dispatch details before they change fleet movements.</p>
          </div>
          <div className={styles.headingActions}>
            <button className={styles.buttonSecondary} type="button" onClick={() => void refresh(true)} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
              Refresh
            </button>
          </div>
        </header>

        {loadError ? <div className={styles.errorBanner} role="alert">{loadError}</div> : null}
        {feedback ? (
          <div className={`${styles.feedback} ${feedback.tone === 'error' ? styles.feedbackError : ''}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
            <span>{feedback.text}</span>
            {feedback.copyText ? (
              <button className={styles.copyButton} type="button" onClick={() => void copyNotice(feedback.copyText ?? '')}>
                <Copy size={12} /> Copy notice
              </button>
            ) : null}
          </div>
        ) : null}

        <section className={styles.stats} aria-label="Dispatch inbox summary">
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Inbox size={17} /></div>
            <div><p className={styles.statLabel}>Messages in this view</p><p className={styles.statValue}>{pagination?.total ?? '—'}</p></div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconAmber}`}><BellRing size={17} /></div>
            <div><p className={styles.statLabel}>Reminders waiting</p><p className={styles.statValue}>{notifications.length}</p></div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconRed}`}><Clock3 size={17} /></div>
            <div><p className={styles.statLabel}>Overdue reminders</p><p className={styles.statValue}>{overdueCount}</p></div>
          </div>
        </section>

        <section className={styles.reminders} aria-labelledby="reminders-title">
          <div className={styles.remindersHeader}>
            <h2 className={styles.remindersHeading} id="reminders-title"><BellRing size={15} /> Dispatch reminders</h2>
            <span className={styles.remindersHint}>A matching message from the connected phone or customer group clears a reminder.</span>
          </div>
          {reminderError ? <div className={styles.errorBanner} role="alert">{reminderError}</div> : null}
          {notifications.length === 0 ? (
            <div className={styles.emptyReminders}><CheckCircle2 size={15} /> No dispatch reminders waiting.</div>
          ) : (
            <div className={styles.reminderList}>
              {notifications.map((notification) => (
                <article
                  className={`${styles.reminderCard} ${notification.overdue ? styles.reminderCardOverdue : ''}`}
                  key={notification.messageId}
                >
                  <div>
                    <p className={styles.reminderCustomer}>{notification.customerName}</p>
                    <p className={`${styles.reminderMeta} ${notification.overdue ? styles.reminderOverdue : ''}`}>
                      <Clock3 size={12} />
                      {notification.overdue ? 'Overdue · ' : 'Due · '}
                      {displayDate(notification.dueAt, true)}
                    </p>
                  </div>
                  {notification.notificationText ? (
                    <button
                      className={styles.copyButton}
                      type="button"
                      onClick={() => void copyNotice(notification.notificationText ?? '')}
                      aria-label={`Copy dispatch notice for ${notification.customerName}`}
                    >
                      <Copy size={12} /> Copy notice
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.workspace} aria-label="Dispatch message review">
          <div className={styles.inbox}>
            <div className={styles.inboxToolbar}>
              <div>
                <h2 className={styles.inboxTitle}>Message inbox</h2>
                <p className={styles.resultCount}>{pagination?.total ?? 0} dispatch messages</p>
              </div>
              <label>
                <span className="sr-only">Filter messages by review status</span>
                <select className={styles.filter} value={filter} onChange={changeFilter}>
                  <option value="pending">Pending</option>
                  <option value="duplicate">Duplicates</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All messages</option>
                </select>
              </label>
            </div>

            <div className={styles.messageList}>
              {loading ? (
                <div className={styles.centerState}><RefreshCw size={18} className="animate-spin" /><span>Loading dispatch messages…</span></div>
              ) : messages.length === 0 ? (
                <div className={styles.centerState}>
                  <CheckCircle2 size={19} />
                  <strong>Queue is clear</strong>
                  <span>No {filter === 'all' ? '' : `${filter} `}dispatch messages to show.</span>
                </div>
              ) : messages.map((message) => (
                <button
                  className={`${styles.messageRow} ${message.id === selectedId ? styles.messageRowSelected : ''}`}
                  key={message.id}
                  type="button"
                  onClick={() => selectMessage(message)}
                  aria-pressed={message.id === selectedId}
                >
                  <span className={styles.messageRowTop}>
                    <span className={styles.messageCustomer}>{message.customerName}</span>
                    <span className={styles.messageTime}>{displayDate(message.createdAt, true)}</span>
                  </span>
                  <span className={styles.messagePreview}>{message.text}</span>
                  <span className={styles.messageRowBottom}>
                    <span className={`${styles.badge} ${statusClass(message.reviewStatus)}`}>{statusLabel(message.reviewStatus)}</span>
                    {message.parsedData?.truckNumber ? <span className={styles.messageTime}>{message.parsedData.truckNumber}</span> : null}
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.inboxFooter}>
              <span>
                {pagination?.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, pagination.total)} of ${pagination.total}` : 'No results'}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  className={styles.iconButton}
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={!pagination?.hasPrevious || loading}
                  aria-label="Previous page"
                ><ChevronLeft size={15} /></button>
                <button
                  className={styles.iconButton}
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pagination?.hasNext || loading}
                  aria-label="Next page"
                ><ChevronRight size={15} /></button>
              </div>
            </div>
          </div>

          <div className={styles.detail}>
            {!selectedMessage ? (
              <div className={styles.emptyDetail}>
                <div className={styles.emptyDetailIcon}><ClipboardCheck size={21} /></div>
                <h2>Select a dispatch message</h2>
                <p>Parsed details and review actions will appear here. New messages are checked automatically.</p>
              </div>
            ) : (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <p className={styles.eyebrow}>Dispatch details</p>
                    <h2 className={styles.detailTitle}>{selectedMessage.customerName}</h2>
                    <p className={styles.detailMeta}>Received {displayDate(selectedMessage.createdAt, true)}</p>
                  </div>
                  <span className={`${styles.badge} ${statusClass(selectedMessage.reviewStatus)}`}>
                    {statusLabel(selectedMessage.reviewStatus)}
                  </span>
                </div>

                {selectedMessage.warnings?.length ? (
                  <div className={styles.warnings} role="note">
                    <p className={styles.warningsTitle}><AlertTriangle size={14} /> Check these parser warnings</p>
                    <ul className={styles.warningList}>
                      {selectedMessage.warnings.map((warning) => <li key={warning}>{warning.replaceAll('_', ' ')}</li>)}
                    </ul>
                  </div>
                ) : null}

                <div className={styles.originalMessage}>
                  <p className={styles.originalLabel}><MessageSquareText size={13} /> Original WhatsApp message</p>
                  <p className={styles.originalText}>{selectedMessage.text}</p>
                </div>

                <h3 className={styles.formTitle}>Confirm or correct the parsed details</h3>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="truck-number">Truck number *</label>
                    <input id="truck-number" value={details.truckNumber ?? ''} onChange={updateField('truckNumber')} disabled={!canReview || busyAction !== null} autoComplete="off" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="skid-number">Skid number *</label>
                    <input id="skid-number" value={details.skidNumber ?? ''} onChange={updateField('skidNumber')} disabled={!canReview || busyAction !== null} autoComplete="off" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="driver-name">Driver name</label>
                    <input id="driver-name" value={details.driverName ?? ''} onChange={updateField('driverName')} disabled={!canReview || busyAction !== null} autoComplete="name" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="driver-contact">Driver contact</label>
                    <input id="driver-contact" type="tel" value={details.driverContact ?? ''} onChange={updateField('driverContact')} disabled={!canReview || busyAction !== null} autoComplete="tel" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="date-out">Date out *</label>
                    <input id="date-out" type="date" value={details.dateOut ?? ''} onChange={updateField('dateOut')} disabled={!canReview || busyAction !== null} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="time-out">Time out</label>
                    <input id="time-out" type="time" value={details.timeOut ?? ''} onChange={updateField('timeOut')} disabled={!canReview || busyAction !== null} />
                  </div>
                </div>

                <p className={styles.approvalNote}>
                  <ShieldCheck size={14} />
                  Approval records the dispatch and schedules an in-app reminder for 10 minutes later. WhatsApp is never sent automatically.
                </p>

                {canReview ? (
                  <div className={styles.detailActions}>
                    <button className={styles.buttonDanger} type="button" onClick={() => void handleReject()} disabled={busyAction !== null}>
                      <X size={14} /> {busyAction === 'reject' ? 'Rejecting…' : 'Reject'}
                    </button>
                    <button className={styles.button} type="button" onClick={() => void handleApprove()} disabled={!canApprove || busyAction !== null}>
                      <Check size={14} /> {busyAction === 'approve' ? 'Approving…' : 'Approve dispatch'}
                    </button>
                  </div>
                ) : selectedMessage.reviewStatus === 'duplicate' ? (
                  <div className={styles.approvalNote}><AlertTriangle size={14} /> This message is marked as a duplicate and cannot create another movement.</div>
                ) : selectedMessage.reviewStatus === 'approved' ? (
                  <div className={styles.approvalNote}><CheckCircle2 size={14} /> Dispatch approved; the reminder clears when a matching group or phone message is observed.</div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
