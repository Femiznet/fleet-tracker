'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import styles from './toast-provider.module.css';

type ToastTone = 'success' | 'error' | 'info';

type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

type ToastInput = {
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
};

type ToastEntry = ToastInput & { id: number };

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') return <CheckCircle2 size={18} />;
  if (tone === 'error') return <AlertCircle size={18} />;
  return <Info size={18} />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), 6000)
      );
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
    },
    []
  );

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={styles.viewport} aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className={`${styles.toast} ${styles[`toast_${toast.tone}`]}`}
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span className={styles.icon}>
              <ToastIcon tone={toast.tone} />
            </span>
            <div className={styles.content}>
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
              {toast.action ? (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    void toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.dismiss}
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context.showToast;
}
