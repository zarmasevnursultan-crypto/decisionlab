"use client";
import { useState } from "react";
import type { CaseBundle, Evidence, SessionSnapshot } from "@/lib/case-types";
import { evidenceLinks, evidenceText } from "@/lib/evidence-links";
import { Item } from "./case-panels";

const categories = { mail: "Почта", logs: "Логи", files: "Файлы", people: "Люди" };
const types = { log: "Журнал", metadata: "Метаданные", network: "Сеть", testimony: "Показания" };
export default function EvidenceBoard({ bundle, session, onStudy, onHint, disabled, pending, hintLoading, errorMessage }: { bundle: CaseBundle; session: SessionSnapshot | null; onStudy: (id: string) => void; onHint: (id: string) => void; disabled: boolean; pending: boolean; hintLoading: boolean; errorMessage: string }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("time");
  const [selected, setSelected] = useState<Evidence | null>(null);
  const studied = new Set(session?.studiedEvidenceIds ?? []);
  const items = bundle.evidence.filter((item) => studied.has(item.id) && (filter === "all" || (filter === "important" ? item.danger : item.section === filter)) && evidenceText(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const time = (item: Evidence) => { const match = item.subtitle.match(/(\d{2}):(\d{2})/); return match ? Number(match[1]) * 60 + Number(match[2]) : 1440 + item.position; };
  items.sort((a, b) => sort === "importance" ? Number(b.danger) - Number(a.danger) || a.position - b.position : sort === "category" ? a.section.localeCompare(b.section) || a.position - b.position : time(a) - time(b));
  const render = (item: Evidence) => <Item item={{ ...item, hint: session?.hints[item.id] ?? "" }} studied={studied.has(item.id)} onStudy={() => onStudy(item.id)} onUseHint={() => onHint(item.id)} hintUsed={Boolean(session?.usedHintIds.includes(item.id))} hintDisabled={disabled} pending={pending} hintLoading={hintLoading} errorMessage={errorMessage} />;
  return <div className="space-y-5">
    <h2 className="text-3xl font-bold">Доска улик</h2>
    <p className="text-gray-400">Изучено {studied.size} из {bundle.evidence.length}. Осталось {bundle.evidence.length - studied.size}. Связи показывают общие идентификаторы; это направления проверки, а не готовые обвинения.</p>
    <div className="flex flex-wrap gap-2">{Object.entries({ all: "Все", important: "Важные", ...categories }).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-lg border px-3 py-2 text-sm ${filter === id ? "border-red-500 bg-red-500/15" : "border-white/15 hover:bg-white/5"}`}>{label}</button>)}</div>
    <div className="flex flex-col gap-3 sm:flex-row"><input aria-label="Поиск по уликам" placeholder="Поиск: название, устройство, адрес…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#10141c] p-3" /><select aria-label="Сортировка улик" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-white/15 bg-[#10141c] p-3"><option value="time">По времени в материале</option><option value="importance">По важности</option><option value="category">По категории</option></select></div>
    {items.length === 0 && <p className="rounded-xl border border-dashed border-white/20 p-8 text-gray-400">{studied.size ? "По этим условиям ничего не найдено. Измените поиск или фильтр." : "Откройте материалы в разделах расследования. Изученные улики появятся здесь."}</p>}
    {selected && <div className="rounded-xl border border-cyan-500/30 p-4"><p className="mb-2 text-sm text-cyan-200">Связанный материал <button className="ml-3 underline" onClick={() => setSelected(null)}>Скрыть</button></p>{render(selected)}</div>}
    {items.map((item) => <div key={item.id} className="space-y-2 rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap gap-3 text-xs text-gray-400"><span>{types[item.type]}</span><span>{categories[item.section]}</span><span>{item.danger ? "Важный материал" : "Контекст / проверка версии"}</span><span className="text-emerald-300">Изучено</span></div>
      {render(item)}
      <div className="flex flex-wrap gap-2">{evidenceLinks(item, bundle).map((link) => <button key={link.evidence.id} onClick={() => setSelected(link.evidence)} className="max-w-full break-words rounded-lg bg-cyan-500/5 px-3 py-2 text-left text-xs text-cyan-200 hover:bg-cyan-500/15">↔ {link.evidence.title}<span className="mt-1 block text-gray-400">{link.shared.join(", ")} · {studied.has(link.evidence.id) ? "изучено" : "ещё не изучено"}</span></button>)}</div>
    </div>)}
  </div>;
}
