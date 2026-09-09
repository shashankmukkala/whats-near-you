"use client";

import AdminGate from "@/components/AdminGate";
import MapExperience from "@/components/MapExperience";

export default function AdminPage() {
  return (
    <AdminGate>
      <MapExperience isAdmin={true} />
    </AdminGate>
  );
}
