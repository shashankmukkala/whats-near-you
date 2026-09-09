"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import { adminFetch } from "@/lib/adminFetch";

type Submission = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  known_for: string | null;
  image_url: string | null;
  media_url: string | null;
  lng: number;
  lat: number;
  contact_name: string | null;
  contact_phone: string;
  status: "pending" | "approved" | "rejected";
  published_place_id: string | null;
  created_at: string;
};

export default function AdminSubmissionsPage() {
  return (
    <AdminGate>
      <SubmissionsQueue />
    </AdminGate>
  );
}

function SubmissionsQueue() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Fetches and RETURNS rows rather than setting state itself. An effect
  // that calls a function which sets state synchronously is what React 19's
  // lint rule rejects, and the reason is real: it can cascade renders. The
  // promise chain below moves every setState past an await, and the
  // cancelled flag stops a slow response writing into an unmounted view.
  const fetchSubmissions = useCallback(async (): Promise<Submission[]> => {
    const res = await adminFetch("/api/submissions");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSubmissions()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load submissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSubmissions]);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError("");
    try {
      const res = await adminFetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setItems(await fetchSubmissions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((i) => i.status === "pending");
  const reviewed = items.filter((i) => i.status !== "pending");

  return (
    <div className="min-h-dvh bg-[var(--cream-100)]">
      <header className="sticky top-0 z-10 border-b border-[var(--ink-line)] bg-[#fffdf8f2] px-5 py-4 backdrop-blur">
        <Link href="/admin" className="text-xs text-[var(--ink-muted)] hover:underline">
          ← Back to map
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[var(--ink)]">Submissions</h1>
        <p className="text-xs text-[var(--ink-muted)]">
          {pending.length} awaiting review · {reviewed.length} done
        </p>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {error && <p className="mb-4 text-xs text-[#c22b1f]">{error}</p>}
        {loading && <div className="admin-enquiries-empty">Loading…</div>}

        {!loading && pending.length === 0 && (
          <div className="admin-enquiries-empty">Nothing waiting. Approved pandals appear on the map immediately.</div>
        )}

        {pending.map((item) => (
          <div key={item.id} className="admin-enquiry-item mb-3">
            {item.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="mb-3 h-40 w-full rounded-[1rem] object-cover" />
            )}
            <div className="admin-enquiry-item-top">
              <div className="min-w-0">
                <span className="admin-enquiry-format">Pending</span>
                <h3>{item.name}</h3>
                <div className="admin-enquiry-meta">
                  {[item.area, item.address].filter(Boolean).join(" · ") || "No area given"}
                </div>
              </div>
            </div>

            {item.known_for && <p className="admin-enquiry-message">{item.known_for}</p>}

            {/* The two things worth checking before this reaches the map:
                where the pin actually landed, and who to call about it. */}
            <div className="admin-enquiry-meta mt-2">
              📍 {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
              {" · "}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-deep)] hover:underline"
              >
                check the pin
              </a>
            </div>
            <div className="admin-enquiry-meta">
              ☎ {item.contact_phone}
              {item.contact_name ? ` · ${item.contact_name}` : ""}
            </div>

            {item.media_url && (
              <div className="admin-enquiry-links">
                <a href={item.media_url} target="_blank" rel="noopener noreferrer">
                  Media link
                </a>
              </div>
            )}

            <div className="admin-enquiry-actions">
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => review(item.id, "reject")}
                className="admin-enquiry-reject"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => review(item.id, "approve")}
                className="admin-enquiry-approve"
              >
                {busyId === item.id ? "Working…" : "Approve & publish"}
              </button>
            </div>
          </div>
        ))}

        {reviewed.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-xs font-bold tracking-wide text-[var(--ink-soft)] uppercase">Reviewed</h2>
            {reviewed.map((item) => (
              <div key={item.id} className="admin-enquiry-item mb-2">
                <div className="admin-enquiry-item-top">
                  <div className="min-w-0">
                    <h3>{item.name}</h3>
                    <div className="admin-enquiry-meta">{item.area ?? "—"}</div>
                  </div>
                  <span className={`admin-enquiry-status ${item.status === "approved" ? "status-approved" : "status-rejected"}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
