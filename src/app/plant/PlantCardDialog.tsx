"use client";

import { useId, useRef, type MouseEvent, type ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  detail: string;
  badges?: string[];
  children: ReactNode;
};

export default function PlantCardDialog({
  title,
  subtitle,
  detail,
  badges = [],
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) dialogRef.current?.close();
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="group min-h-24 w-full p-4 text-left transition-colors hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--ring)] sm:p-5"
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-[var(--fg)]">{title}</span>
          {badges.length > 0 && (
            <span className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-[var(--warning)]/15 px-2.5 py-1 text-xs font-medium text-[var(--warning)]"
                >
                  {badge}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="mt-2 block text-sm text-[var(--fg)]">{subtitle}</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">{detail}</span>
        <span className="sr-only">Open {title} actions</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={closeOnBackdrop}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialogRef.current?.close();
          }
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-[var(--fg)] backdrop:bg-slate-950/60"
      >
        <section className="mx-auto flex h-full w-full max-w-3xl flex-col bg-[var(--card)] shadow-2xl sm:my-8 sm:h-[calc(100dvh-4rem)] sm:rounded-2xl sm:border sm:border-[var(--border)]">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="break-words text-lg font-semibold sm:text-xl">
                {title}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              aria-label={`Close ${title} actions`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Close
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {children}
          </div>
        </section>
      </dialog>
    </article>
  );
}
