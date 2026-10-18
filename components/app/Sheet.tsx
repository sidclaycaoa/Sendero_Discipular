"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

/** Panel that rises from the bottom of the screen; tapping outside closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35" onClick={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-soft" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-ink">{title}</h2><button type="button" className="rounded-md border border-line p-2" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
