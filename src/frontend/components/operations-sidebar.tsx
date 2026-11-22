import Link from 'next/link';
import { ClipboardList, Gauge, Inbox, MapPinned, ShieldCheck, Truck, Waves } from 'lucide-react';
import styles from './operations-sidebar.module.css';

type OperationsSidebarProps = {
  active: 'overview' | 'tracker' | 'dispatch' | 'updates' | 'plant-report';
  pendingDispatchCount?: number;
};

export default function OperationsSidebar({
  active,
  pendingDispatchCount,
}: OperationsSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/">
        <span className={styles.brandMark}>
          <Truck size={19} />
        </span>
        <span>
          <span className={styles.brandName}>GasTech Fleet</span>
          <span className={styles.brandCaption}>Operations workspace</span>
        </span>
      </Link>
      <div>
        <p className={styles.navLabel}>Operations</p>
        <nav className={styles.navigation} aria-label="Main navigation">
          <Link
            className={`${styles.navItem} ${active === 'overview' ? styles.navItemActive : ''}`}
            href="/"
            aria-current={active === 'overview' ? 'page' : undefined}
          >
            <Gauge size={16} />
            <span>Overview</span>
          </Link>
          <Link
            className={`${styles.navItem} ${active === 'tracker' ? styles.navItemActive : ''}`}
            href="/tracker"
            aria-current={active === 'tracker' ? 'page' : undefined}
          >
            <MapPinned size={16} />
            <span>Truck & skid tracker</span>
          </Link>
          <Link
            className={`${styles.navItem} ${active === 'updates' ? styles.navItemActive : ''}`}
            href="/updates"
            aria-current={active === 'updates' ? 'page' : undefined}
          >
            <Waves size={16} />
            <span>Customer updates</span>
          </Link>
          <Link
            className={`${styles.navItem} ${active === 'plant-report' ? styles.navItemActive : ''}`}
            href="/plant-report"
            aria-current={active === 'plant-report' ? 'page' : undefined}
          >
            <ClipboardList size={16} />
            <span>Plant report</span>
          </Link>
          <Link
            className={`${styles.navItem} ${active === 'dispatch' ? styles.navItemActive : ''}`}
            href="/dispatch"
            aria-current={active === 'dispatch' ? 'page' : undefined}
          >
            <Inbox size={16} />
            <span>Dispatch review</span>
            {pendingDispatchCount ? (
              <span className={styles.navCount}>{pendingDispatchCount}</span>
            ) : null}
          </Link>
        </nav>
      </div>
      <div className={styles.sidebarNote}>
        <p className={styles.sidebarNoteTitle}>
          <ShieldCheck size={14} /> Human-reviewed operations
        </p>
        <p>
          Dispatch approvals are reviewed by an officer. WhatsApp notices are copied and sent
          manually.
        </p>
      </div>
    </aside>
  );
}
