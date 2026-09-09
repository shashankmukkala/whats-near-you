"use client";

import { useRef, useState } from "react";

type PhotoUploadProps = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

/**
 * Pick a photo, get back a hosted URL.
 *
 * The upload starts the moment a file is chosen rather than on form
 * submit. On a phone over festival-week mobile data a 4MB photo takes real
 * seconds, and hiding that inside the submit button makes the whole form
 * feel broken at the exact moment someone is deciding whether to bother.
 *
 * The preview is a local object URL, so it appears instantly and does not
 * wait on the round trip.
 */
export default function PhotoUpload({ value, onChange, label = "Photo" }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so picking the same file twice in a row still fires a change.
    event.target.value = "";
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setStatus("uploading");
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus("error");
      setPreview(null);
    }
  }

  const shown = preview ?? (value || null);

  return (
    <div>
      <label className="admin-label">{label}</label>
      <div className="mt-1.5">
        {shown ? (
          <div className="relative overflow-hidden rounded-[1.25rem] border border-[var(--ink-line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="" className="h-44 w-full object-cover" />
            {status === "uploading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#fffdf8cc] text-xs font-semibold text-[var(--ink-muted)]">
                Uploading…
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onChange("");
              }}
              className="absolute top-2 right-2 rounded-full bg-[#fffdf8f2] px-3 py-1 text-xs font-semibold text-[var(--ink-muted)] shadow-sm"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border border-dashed border-[var(--ink-line-strong)] bg-[#ffffff80] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-wash)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
              <path d="M3 16.5 8 12l3.5 3L15 11l6 5.5M3 5h18v14H3z" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            <span className="text-sm font-semibold">Add a photo</span>
            <span className="text-[11px]">PNG, JPG or WebP, up to 5MB</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="hidden" />
      {error && <p className="mt-1.5 text-xs text-[#c22b1f]">{error}</p>}
    </div>
  );
}
