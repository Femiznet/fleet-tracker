'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Bell,
  ClipboardList,
  Gauge,
  Inbox,
  MapPinned,
  ShieldCheck,
  Truck,
  Waves,
  X,
} from 'lucide-react';
import { getOfficerAlerts } from '@/frontend/actions/officer-alerts';
import type { OfficerAlert, OfficerAlertRoute } from '@/frontend/types/officer-alert';
import { useToast } from './toast-provider';
import styles from './operations-sidebar.module.css';

const ALERT_REFRESH_INTERVAL_MS = 30_000;

type OperationsRoute =
  'overview' | 'tracker' | 'movements' | 'dispatch' | 'updates' | 'plant-report';

type OperationsSidebarProps = {
  active: OperationsRoute;
};

const navigation: {
  route: OperationsRoute;
  href: string;
  label: string;
  mobileLabel: string;
  icon: ReactNode;
  alertRoute?: OfficerAlertRoute;
}[] = [
  {
    route: 'overview',
    href: '/',
    label: 'Overview',
    mobileLabel: 'Overview',
    icon: <Gauge size={18} />,
  },
  {
    route: 'tracker',
    href: '/tracker',
    label: 'Truck & skid tracker',
    mobileLabel: 'Tracker',
    icon: <MapPinned size={18} />,
    alertRoute: 'tracker',
  },
  {
    route: 'movements',
    href: '/movements',
    label: 'Dispatch & movements',
    mobileLabel: 'Movements',
    icon: <ArrowLeftRight size={18} />,
    alertRoute: 'movements',
  },
  {
    route: 'updates',
    href: '/updates',
    label: 'Customer updates',
    mobileLabel: 'Updates',
    icon: <Waves size={18} />,
    alertRoute: 'updates',
  },
  {
    route: 'plant-report',
    href: '/plant-report',
    label: 'Plant status',
    mobileLabel: 'Plant',
    icon: <ClipboardList size={18} />,
    alertRoute: 'plant-report',
  },
  {
    route: 'dispatch',
    href: '/dispatch',
    label: 'Dispatch review',
    mobileLabel: 'Dispatch',
    icon: <Inbox size={18} />,
    alertRoute: 'dispatch',
  },
];

function AlertRow({ alert, onNavigate }: { alert: OfficerAlert; onNavigate: () => void }) {
  return (
    <Link
      className={`${styles.alertRow} ${styles[`alert_${alert.severity}`]}`}
      href={alert.href}
      onClick={() => {
        onNavigate();
        window.dispatchEvent(new CustomEvent('officer-alert-navigate', { detail: alert }));
      }}
    >
      <span className={styles.alertIcon} aria-hidden="true" />
      <span className={styles.alertCopy}>
        <strong>{alert.title}</strong>
        <small>{alert.description}</small>
      </span>
      <span className={styles.alertCount}>{alert.count}</span>
    </Link>
  );
}

function AlertCenter({ alerts, total }: { alerts: OfficerAlert[]; total: number }) {
  const [open, setOpen] = useState(false);
  const alertCenterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !alertCenterRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <div className={styles.alertCenter} ref={alertCenterRef}>
      <button
        type="button"
        className={`${styles.notificationButton} ${open ? styles.notificationButtonActive : ''}`}
        aria-label={total ? `Open ${total} officer alerts` : 'Open officer alerts'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} />
        <span className={styles.notificationLabel}>Officer alerts</span>
        {total ? (
          <span className={styles.notificationCount}>{total > 99 ? '99+' : total}</span>
        ) : null}
      </button>
      {open ? (
        <section className={styles.alertPanel} role="dialog" aria-label="Officer alerts">
          <header className={styles.alertPanelHeader}>
            <div>
              <span className={styles.alertPanelEyebrow}>Pending actions</span>
              <h2>Officer alerts</h2>
            </div>
            <button
              type="button"
              className={styles.alertPanelClose}
              aria-label="Close alerts"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </header>
          {alerts.length ? (
            <div className={styles.alertList}>
              {alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          ) : (
            <div className={styles.noAlerts}>
              <ShieldCheck size={20} />
              <strong>No pending actions</strong>
              <span>All officer actions are resolved.</span>
            </div>
          )}
          <p className={styles.alertPanelFooter}>Alerts clear when the related work is resolved.</p>
        </section>
      ) : null}
    </div>
  );
}

function NavigationItems({
  active,
  routeCounts,
}: {
  active: OperationsRoute;
  routeCounts: Partial<Record<OfficerAlertRoute, number>>;
}) {
  return (
    <>
      {navigation.map((item) => {
        const count = item.alertRoute ? (routeCounts[item.alertRoute] ?? 0) : 0;
        return (
          <Link
            className={`${styles.navItem} ${active === item.route ? styles.navItemActive : ''}`}
            href={item.href}
            aria-current={active === item.route ? 'page' : undefined}
            aria-label={count ? `${item.label}, ${count} alerts to check` : item.label}
            title={count ? `${count} items need attention` : undefined}
            key={item.route}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navText}>
              <span className={styles.navFullLabel}>{item.label}</span>
              <span className={styles.navMobileLabel}>{item.mobileLabel}</span>
            </span>
            {count ? <span className={styles.navAlertDot} aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </>
  );
}

export default function OperationsSidebar({ active }: OperationsSidebarProps) {
  const [routeCounts, setRouteCounts] = useState<Partial<Record<OfficerAlertRoute, number>>>({});
  const [alerts, setAlerts] = useState<OfficerAlert[]>([]);
  const [total, setTotal] = useState(0);
  const showToast = useToast();
  const errorNotified = useRef(false);

  useEffect(() => {
    let activeRequest = true;
    const refresh = async () => {
      try {
        const result = await getOfficerAlerts();
        if (!activeRequest) return;
        setAlerts(result.alerts);
        setTotal(result.total);
        setRouteCounts(result.routeCounts);
        errorNotified.current = false;
      } catch (error) {
        if (!activeRequest || errorNotified.current) return;
        errorNotified.current = true;
        showToast({
          tone: 'error',
          title: 'Route indicators unavailable',
          description: error instanceof Error ? error.message : 'Unable to refresh route alerts.',
        });
      }
    };

    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), ALERT_REFRESH_INTERVAL_MS);
    return () => {
      activeRequest = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [showToast]);

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark}>
              <Truck size={19} />
            </span>
            <span className={styles.brandCopy}>
              <span className={styles.brandName}>GasTech Fleet</span>
              <span className={styles.brandCaption}>Fleet operations</span>
            </span>
          </Link>
          <div className={styles.mobileAlertCenter}>
            <AlertCenter alerts={alerts} total={total} />
          </div>
        </div>
        <div className={styles.desktopAlertCenter}>
          <AlertCenter alerts={alerts} total={total} />
        </div>
        <div className={styles.navSection}>
          <p className={styles.navLabel}>Operations</p>
          <nav className={styles.navigation} aria-label="Main navigation">
            <NavigationItems active={active} routeCounts={routeCounts} />
          </nav>
        </div>
        <div className={styles.sidebarNote}>
          <p className={styles.sidebarNoteTitle}>
            <ShieldCheck size={14} /> Officer review required
          </p>
          <p>Review and approve dispatch requests. Send customer notices manually.</p>
        </div>
      </aside>
      <nav
        className={`${styles.navigation} ${styles.mobileNavigation}`}
        aria-label="Mobile navigation"
      >
        <NavigationItems active={active} routeCounts={routeCounts} />
      </nav>
    </>
  );
}
