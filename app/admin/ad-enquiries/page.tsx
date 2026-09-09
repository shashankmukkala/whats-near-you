"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import AdEnquiriesPanel, { type AdEnquiry } from "@/components/AdEnquiriesPanel";
import { useAdminAuth } from "@/lib/useAdminAuth";

export default function AdminAdEnquiriesPage() {
  return (
    <AdminGate>
      <AdEnquiriesAdmin />
    </AdminGate>
  );
}

function AdEnquiriesAdmin() {
  const router = useRouter();
  const { session } = useAdminAuth();
  const accessToken = session?.access_token ?? null;
  const [enquiries, setEnquiries] = useState<AdEnquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetch("/api/ad-enquiries", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setEnquiries(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function updateStatus(id: string, status: "approved" | "rejected") {
    if (!accessToken) return;
    const response = await fetch(`/api/ad-enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return;
    setEnquiries((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  return (
    <div className="min-h-dvh bg-[#0b0b0d] text-neutral-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b0b0d]/95 px-5 py-4 backdrop-blur">
        <div>
          <Link href="/admin" className="text-xs text-neutral-400 hover:underline">
            ← Back to map
          </Link>
          <h1 className="mt-1 text-lg font-semibold">Ad enquiries</h1>
          <p className="text-xs text-neutral-400">
            {enquiries.filter((e) => e.status === "pending").length} awaiting review
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {loading ? (
          <div className="admin-enquiries-empty">Loading…</div>
        ) : (
          <AdEnquiriesPanel enquiries={enquiries} onStatus={updateStatus} onClose={() => router.push("/admin")} />
        )}
      </div>
    </div>
  );
}
