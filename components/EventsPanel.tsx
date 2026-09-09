"use client";

import type { CityEvent } from "@/lib/supabase";
import PanelShell from "@/components/PanelShell";

function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type EventsPanelProps = {
  events: CityEvent[];
  isAdmin: boolean;
  onAddClick: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
};

export default function EventsPanel({ events, isAdmin, onAddClick, onDelete, onClose }: EventsPanelProps) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.event_date >= today);

  return (
    <PanelShell
      title="Happening in Hyderabad"
      subtitle={`${upcoming.length} upcoming`}
      onClose={onClose}
      headerAction={
        isAdmin && (
          <button
            onClick={onAddClick}
            className="admin-btn-primary"
          >
            + Add
          </button>
        )
      }
    >
      {upcoming.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-neutral-400">
          {isAdmin ? "No news yet. Add the first item." : "Nothing announced yet — check back soon."}
        </div>
      )}
      {upcoming.map((event) => (
        <div
          key={event.id}
          className="group relative flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 transition-colors hover:border-white/15 hover:bg-white/[0.07]"
        >
          <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${event.event_date === today ? "bg-[rgba(255,107,107,0.16)]" : "bg-white/[0.06]"}`}>
            <span className={`text-[9px] font-bold tracking-wide uppercase ${event.event_date === today ? "text-[#ffc9c9]" : "text-neutral-400"}`}>
              {event.event_date === today ? "LIVE" : new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-IN", { month: "short" })}
            </span>
            <span className={`mt-1 text-sm font-bold ${event.event_date === today ? "text-[#ffe1e1]" : "text-neutral-200"}`}>
              {event.event_date === today ? "NOW" : new Date(`${event.event_date}T00:00:00`).getDate()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-neutral-100">
              {event.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-neutral-400">
              {formatDate(event.event_date)}
              {event.location ? ` · ${event.location}` : ""}
            </div>
            {event.description && (
              <div className="mt-1.5 line-clamp-2 text-xs leading-4 text-neutral-400">
                {event.description}
              </div>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => onDelete(event.id)}
              className="shrink-0 rounded-full p-1.5 text-neutral-300 opacity-100 hover:bg-white/10 hover:text-neutral-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={`Delete ${event.name}`}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                <path d="M5 6h10M8 6V4h4v2M6 6l.5 10h7l.5-10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </PanelShell>
  );
}
