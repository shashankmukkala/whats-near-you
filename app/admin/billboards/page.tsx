"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import BillboardList from "@/components/BillboardList";
import { useAdminAuth } from "@/lib/useAdminAuth";
import type { Billboard } from "@/lib/supabase";

export default function AdminBillboardsPage() {
  return (
    <AdminGate>
      <BillboardsAdmin />
    </AdminGate>
  );
}

function BillboardsAdmin() {
  const router = useRouter();
  const { session } = useAdminAuth();
  const accessToken = session?.access_token ?? null;
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billboards")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setBillboards(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function deleteBillboard(id: string) {
    if (!accessToken) return;
    setBillboards((prev) => prev.filter((b) => b.id !== id));
    try {
      await fetch(`/api/billboards/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    } catch {
      // Best-effort — the placement stays removed from view even if the request fails.
    }
  }

  return (
    <div className="min-h-dvh bg-[#0b0b0d] text-neutral-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b0b0d]/95 px-5 py-4 backdrop-blur">
        <div>
          <Link href="/admin" className="text-xs text-neutral-400 hover:underline">
            ← Back to map
          </Link>
          <h1 className="mt-1 text-lg font-semibold">Placements</h1>
          <p className="text-xs text-neutral-400">
            {billboards.length} pinned placement{billboards.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {loading ? (
          <div className="admin-enquiries-empty">Loading…</div>
        ) : (
          <BillboardList items={billboards} onDelete={deleteBillboard} onClose={() => router.push("/admin")} />
        )}
      </div>
    </div>
  );
}
