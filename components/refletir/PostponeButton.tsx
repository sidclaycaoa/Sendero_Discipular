"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TimerReset } from "lucide-react";

export function PostponeButton({
  compact = false,
  templateId,
  dateKey,
  onPostponed
}: {
  compact?: boolean;
  templateId?: string;
  dateKey?: string;
  onPostponed?: (postponedToDate: string) => void;
}) {
  const router = useRouter();
  const [postponed, setPostponed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function postpone() {
    if (!templateId || !dateKey) {
      setPostponed((current) => !current);
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/reflections/postpone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, date: dateKey })
      });

      if (!response.ok) return;

      const result = (await response.json()) as { postponedToDate?: string };
      setPostponed(true);
      onPostponed?.(result.postponedToDate ?? "");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      className={
        compact
          ? `flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold ${
              postponed ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-white text-ink"
            }`
          : `flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold ${
              postponed ? "border-red-200 bg-red-50 text-red-800" : "border-line text-ink"
            }`
      }
      disabled={saving}
      onClick={postpone}
    >
      <TimerReset className="h-4 w-4" />
      {saving ? "Postergando..." : postponed ? "Postergada" : "Postergar"}
    </button>
  );
}
