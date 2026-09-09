"use client";

import type { ReactNode } from "react";

type PanelShellProps = {
  title: string;
  subtitle?: string;
  /** Extra button(s) next to the title, e.g. an admin "+ Add". */
  headerAction?: ReactNode;
  /** Omit to hide the close button (used for panels that are always visible, like Events). */
  onClose?: () => void;
  /** Optional bar pinned below the scrollable body, e.g. Collections' "new collection" input. */
  footer?: ReactNode;
  children: ReactNode;
};

// Shared header + card chrome for every right-column panel (News, results,
// Favourites, Visited, Collections) so they all read as the same UI with
// different content, instead of each having its own header layout.
export default function PanelShell({ title, subtitle, headerAction, onClose, footer, children }: PanelShellProps) {
  return (
    <div className="panel-elevated flex max-h-full w-full flex-col rounded-3xl">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5 dark:border-neutral-800/80">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {title}
          </div>
          {subtitle && <div className="text-[11px] text-neutral-400">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {headerAction}
          {onClose && (
            <button
              onClick={onClose}
              className="panel-close-button rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-200"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
      {footer}
    </div>
  );
}
