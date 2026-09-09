"use client";

import type { Billboard } from "@/lib/supabase";
import PanelShell from "@/components/PanelShell";
import { isCampaignActive } from "@/lib/adFilter";

const AD_TYPE_LABELS: Record<Billboard["ad_type"], string> = {
  rail: "Map rail",
  billboard: "3D billboard",
  aircraft: "Aircraft banner",
};

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type BillboardListProps = {
  items: Billboard[];
  onDelete?: (id: string) => void;
  onClose: () => void;
};

/**
 * The admin inventory list for published placements.
 *
 * It shows expired campaigns explicitly rather than hiding them the way
 * the public map does (see lib/adFilter.ts): the operator is the one
 * person who needs to see that a placement has lapsed, because a lapsed
 * rail ad is a slot that can be sold again.
 */
export default function BillboardList({ items, onDelete, onClose }: BillboardListProps) {
  return (
    <PanelShell title="Placements" subtitle={`${items.length} published`} onClose={onClose}>
      {items.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-neutral-400">
          No placements yet — publish one from the map&apos;s &ldquo;Place on map&rdquo; tools.
        </div>
      )}
      {items.map((item) => {
        const expired = !isCampaignActive(item);
        return (
          <div key={item.id} className="group flex w-full items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-white/10">
            <div className="flex min-w-0 flex-1 items-start gap-3 px-1 py-1">
              <span className="text-lg leading-none" aria-hidden="true">
                {item.ad_type === "aircraft" ? "✈" : item.ad_type === "rail" ? "▦" : "📢"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-neutral-100">{item.name}</span>
                <span className="block truncate text-xs text-neutral-400">
                  {AD_TYPE_LABELS[item.ad_type]}
                  {item.ad_type === "rail" && item.slot_number ? ` · slot ${item.slot_number}` : ""}
                  {" · "}
                  {item.campaign_end ? `${expired ? "ended" : "until"} ${formatDate(item.campaign_end)}` : timeAgo(item.created_at)}
                </span>
              </span>
              {expired && <span className="admin-archived-flag shrink-0">Expired</span>}
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                aria-label={`Delete ${item.name}`}
                className="mt-1 shrink-0 rounded-full p-1.5 text-neutral-500 opacity-60 transition hover:bg-rose-500/15 hover:text-rose-300 group-hover:opacity-100"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                  <path d="M5 6h10M8 6V4h4v2M6 6l.5 10h7l.5-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </PanelShell>
  );
}
