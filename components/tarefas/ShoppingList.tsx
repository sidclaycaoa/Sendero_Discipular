"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit3, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import type { ShoppingItem } from "@/lib/db/sendero";

export function ShoppingListEditor({ items }: { items: ShoppingItem[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => null) as { saved?: boolean; error?: string } | null;
    if (!response.ok || !result?.saved) throw new Error(result?.error || "Não foi possível salvar a lista.");
  }
  async function add() {
    if (!title.trim()) return;
    setSaving(true); setError(null);
    try { await request("/api/shopping", "POST", { title, dueDate: dueDate || undefined }); setTitle(""); setDueDate(""); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o item."); }
    finally { setSaving(false); }
  }
  async function toggle(item: ShoppingItem) {
    setSaving(true); setError(null);
    try { await request(`/api/shopping/${item.id}`, "PATCH", { checked: !item.checked }); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o item."); }
    finally { setSaving(false); }
  }
  function startEdit(item: ShoppingItem) { setEditing(item); setEditTitle(item.title); setEditDueDate(item.dueDate ?? ""); setError(null); }
  async function saveEdit() {
    if (!editing || !editTitle.trim()) return;
    setSaving(true); setError(null);
    try { await request(`/api/shopping/${editing.id}`, "PATCH", { title: editTitle, dueDate: editDueDate || null }); setEditing(null); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o item."); }
    finally { setSaving(false); }
  }
  async function remove(item: ShoppingItem) {
    if (!window.confirm(`Excluir “${item.title}”?`)) return;
    setSaving(true); setError(null);
    try { await request(`/api/shopping/${item.id}`, "DELETE"); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir o item."); }
    finally { setSaving(false); }
  }

  const open = items.filter((item) => !item.checked);
  const done = items.filter((item) => item.checked);
  return <section>
    <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-olive">Demandas da casa</p><h2 className="mt-1 text-lg font-semibold text-ink">Lista de compras</h2></div><ShoppingCart className="h-5 w-5 text-emerald-700" /></div>
    <Card className="border-emerald-200">
      <div className="grid grid-cols-[1fr_48px] gap-2"><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} className="min-h-11 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" placeholder="Adicionar item" /><button type="button" onClick={() => void add()} disabled={saving || !title.trim()} className="grid min-h-11 place-items-center rounded-xl bg-emerald-700 text-white disabled:opacity-50" aria-label="Adicionar item à lista"><Plus className="h-5 w-5" /></button></div>
      <label className="mt-3 block text-sm font-semibold text-ink"><span>Previsão de compra <span className="font-normal text-ink/50">(opcional)</span></span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm" /></label>
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      {open.length ? <div className="mt-3 divide-y divide-line">{open.map((item) => <ShoppingRow key={item.id} item={item} saving={saving} onToggle={() => void toggle(item)} onEdit={() => startEdit(item)} onDelete={() => void remove(item)} />)}</div> : <p className="mt-4 text-sm text-ink/60">A lista está vazia.</p>}
      {done.length ? <div className="mt-3 border-t border-line pt-3"><p className="text-xs font-bold uppercase tracking-wide text-ink/45">Comprados</p>{done.map((item) => <ShoppingRow key={item.id} item={item} saving={saving} onToggle={() => void toggle(item)} onEdit={() => startEdit(item)} onDelete={() => void remove(item)} />)}</div> : null}
    </Card>
    {editing ? <div className="fixed inset-0 z-[80] flex items-end bg-ink/55 sm:items-center sm:justify-center sm:p-5"><div role="dialog" aria-modal="true" aria-label="Editar item de compra" className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-olive">Lista de compras</p><h3 className="mt-1 text-xl font-semibold text-ink">Editar item</h3></div><button type="button" onClick={() => setEditing(null)} className="rounded-full bg-paper p-2" aria-label="Fechar"><X className="h-5 w-5" /></button></div><label className="mt-5 block text-sm font-semibold text-ink">Item<input autoFocus value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm" /></label><label className="mt-4 block text-sm font-semibold text-ink">Data prevista<input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm" /></label><button type="button" disabled={saving || !editTitle.trim()} onClick={() => void saveEdit()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50"><Edit3 className="h-4 w-4" />{saving ? "Salvando..." : "Salvar alterações"}</button></div></div> : null}
  </section>;
}

function ShoppingRow({ item, saving, onToggle, onEdit, onDelete }: { item: ShoppingItem; saving: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return <div className="flex items-center gap-3 py-3"><button type="button" disabled={saving} onClick={onToggle} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${item.checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent"}`} aria-label={item.checked ? `Desmarcar ${item.title}` : `Comprar ${item.title}`}><Check className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className={`text-sm font-semibold text-ink ${item.checked ? "text-ink/45 line-through" : ""}`}>{item.title}</p>{item.dueDate ? <p className="mt-0.5 text-xs font-medium text-ink/55">Previsto: {shortDate(item.dueDate)}</p> : null}</div><div className="flex shrink-0"><button type="button" disabled={saving} onClick={onEdit} className="p-1.5 text-ink/50" aria-label={`Editar ${item.title}`}><Edit3 className="h-4 w-4" /></button><button type="button" disabled={saving} onClick={onDelete} className="p-1.5 text-ink/40" aria-label={`Excluir ${item.title}`}><Trash2 className="h-4 w-4" /></button></div></div>;
}

function shortDate(date: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`)); }
