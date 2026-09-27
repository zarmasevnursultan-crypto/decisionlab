"use client";
import { useEffect, useRef, useState } from "react";
import type { Evidence } from "@/lib/case-types";
export function MenuButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button aria-pressed={active} onClick={onClick} className={`mb-2 w-full rounded-xl px-4 py-3 text-left transition ${active ? "bg-red-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>{children}</button>;
}

export function Incident({ caseTitle, briefing, createdAt, suspectsCount, evidenceCount }: { caseTitle: string; briefing: string; createdAt: string; suspectsCount: number; evidenceCount: number }) {
  const dateLabel = new Date(createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  return <Page title={caseTitle}>
    <div className="mb-8 grid gap-4 sm:grid-cols-3"><InfoCard title="Дата дела" value={dateLabel} /><InfoCard title="Материалов дела" value={String(evidenceCount)} /><InfoCard title="Подозреваемые" value={String(suspectsCount)} /></div>
    <div className="space-y-5">{briefing.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index} className="whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.02] p-5 text-base leading-8 text-gray-300">{paragraph}</p>)}</div>
    <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-5"><h3 className="font-semibold">Как вести расследование</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-400"><li>Изучите согласования в почте: что разрешали и кому.</li><li>Сопоставьте время, устройства и идентификаторы в журналах и файлах.</li><li>Проверьте объяснения участников по независимым источникам.</li><li>В разделе «Люди» выберите подозреваемого. После верного ответа откроется разбор.</li></ol><p className="mt-4 text-sm text-gray-400">На дело — 30 минут. Подсказка стоит 10 очков, каждые 30 секунд — ещё 1 очко. Обновление страницы сохраняет прогресс. «Новое дело» меняет сценарий, «Заново» повторяет текущий. Неверное обвинение стоит 5 очков.</p></div>
  </Page>;
}

export function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="max-w-5xl"><h2 className="mb-6 text-3xl font-bold">{title}</h2>{children}</div>;
}

export function Item({ item, studied, onStudy, onUseHint, hintUsed = false, hintDisabled = false, pending = false, hintLoading = false, errorMessage = "" }: { item: Evidence; studied: boolean; onStudy: () => void; onUseHint?: () => void; hintUsed?: boolean; hintDisabled?: boolean; pending?: boolean; hintLoading?: boolean; errorMessage?: string }) {
  const [open, setOpen] = useState(false);
  return <article className={`rounded-xl border transition ${item.danger ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
    <button disabled={pending} onClick={() => { setOpen(true); onStudy(); }} className="w-full p-4 text-left disabled:opacity-50">
      <span className="flex items-center justify-between gap-3"><span className="font-semibold">{item.title}</span>{studied && <span className="shrink-0 rounded-full border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300">Изучено</span>}</span>
      <span className="mt-1 block text-sm text-gray-500">{item.subtitle}</span>
    </button>
    {open && <ArtifactPanel item={item} onClose={() => setOpen(false)} onUseHint={onUseHint} hintUsed={hintUsed} hintDisabled={hintDisabled} hintLoading={hintLoading} errorMessage={errorMessage} />}
  </article>;
}

export function ArtifactPanel({ item, onClose, onUseHint, hintUsed, hintDisabled, hintLoading, errorMessage }: { item: Evidence; onClose: () => void; onUseHint?: () => void; hintUsed: boolean; hintDisabled: boolean; hintLoading: boolean; errorMessage: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return <dialog ref={dialogRef} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby={`artifact-${item.id}`} className="fixed inset-0 m-auto max-h-[90vh] w-[min(94vw,1024px)] overflow-y-auto rounded-xl border border-white/10 bg-[#07090d] text-white shadow-2xl backdrop:bg-black/80">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
        <div><p className="mb-1 text-xs uppercase tracking-[0.2em] text-red-400">{item.type}</p><h2 id={`artifact-${item.id}`} className="text-xl font-semibold">{item.title}</h2><p className="mt-1 text-sm text-gray-500">{item.subtitle}</p></div>
        <button onClick={onClose} aria-label="Закрыть" className="rounded-lg border border-white/10 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white">✕</button>
      </header>
      <div className="space-y-6 break-words p-5 leading-7 md:p-8"><EvidenceContentView item={item} />{errorMessage && <p role="alert" className="text-sm text-red-300">{errorMessage}</p>}{(item.hint || onUseHint) && <div>{hintUsed ? <p className="rounded-lg border-l-2 border-red-500/50 bg-white/[0.02] py-2 pl-3 text-sm italic text-gray-400"><span className="text-red-300">Подсказка:</span> {item.hint}</p> : <button onClick={onUseHint} disabled={hintDisabled || !onUseHint} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">{hintLoading ? "Открываем подсказку…" : "Показать подсказку (−10 очков)"}</button>}</div>}</div>
  </dialog>;
}

export function EvidenceContentView({ item }: { item: Evidence }) {
  const { content, type } = item;
  if (type === "log" && "lines" in content) return <div className="space-y-1 font-mono text-sm">{content.lines.map((line, i) => <p key={i} className={line.anomaly ? "text-red-400" : "text-gray-300"}>{line.text}</p>)}</div>;
  if (type === "metadata" && "entries" in content) return <dl className="space-y-4 text-sm">{content.entries.map((entry, i) => <div key={i} className="grid gap-1 border-b border-white/5 pb-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6"><dt className="text-gray-500">{entry.key}</dt><dd className="whitespace-pre-wrap text-gray-200">{entry.value}</dd></div>)}</dl>;
  if (type === "network" && "connections" in content) return <div className="space-y-2 text-sm">{content.connections.map((edge, i) => <p key={i} className={edge.anomaly ? "text-red-400" : "text-gray-300"}>{edge.from} → {edge.to} <span className="text-gray-500">({edge.label})</span></p>)}</div>;
  if (type === "testimony" && "speaker" in content) return <blockquote className="border-l-2 border-white/20 pl-3 text-sm italic text-gray-300">«{content.quote}»<footer className="mt-1 not-italic text-gray-500">— {content.speaker}</footer></blockquote>;
  return null;
}

export function InfoCard({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><p className="text-sm text-gray-500">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}
