"use client";

import { useEffect, useState } from "react";
import type { CaseBundle, Evidence, EvidenceSection } from "@/lib/case-types";
import { useGameStore } from "@/lib/game-store";

type Section = "incident" | EvidenceSection | "evidence";

const SECTION_LABELS: Record<EvidenceSection, string> = {
  mail: "📧 Почта",
  logs: "🔒 Логи",
  files: "📁 Файлы",
  people: "👥 Люди",
};
const SECTION_TITLES: Record<EvidenceSection, string> = {
  mail: "Почта",
  logs: "Журнал событий",
  files: "Файлы и метаданные",
  people: "Участники",
};

export default function CaseClient({ caseBundle }: { caseBundle: CaseBundle }) {
  const [section, setSection] = useState<Section>("incident");
  const { case: theCase, suspects, evidence, source } = caseBundle;
  const foundEvidenceIds = useGameStore((state) => state.foundEvidenceIds);
  const clearEvidence = useGameStore((state) => state.clearEvidence);
  const markEvidenceFound = useGameStore((state) => state.markEvidenceFound);

  useEffect(() => clearEvidence(), [theCase.id, clearEvidence]);

  const foundEvidence = evidence.filter((item) => foundEvidenceIds.includes(item.id));
  const bySection = (key: EvidenceSection) => evidence.filter((item) => item.section === key);

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="flex items-center gap-2 text-xs tracking-[0.3em] text-red-500">
            DECISIONLAB
            {source === "fallback" && <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] tracking-normal text-gray-500">РЕЗЕРВНОЕ ДЕЛО</span>}
          </p>
          <h1 className="text-xl font-bold">{theCase.title}</h1>
        </div>
        <div className="flex gap-6 text-sm"><span>⏱️ <b>30:00</b></span><span>🎯 <b>100</b> очков</span></div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)]">
        <aside className="w-64 border-r border-white/10 p-4">
          <MenuButton active={section === "incident"} onClick={() => setSection("incident")}>🚨 Инцидент</MenuButton>
          {(Object.keys(SECTION_LABELS) as EvidenceSection[]).map((key) => (
            <MenuButton key={key} active={section === key} onClick={() => setSection(key)}>{SECTION_LABELS[key]}</MenuButton>
          ))}
          <MenuButton active={section === "evidence"} onClick={() => setSection("evidence")}>🧩 Улики <span className="ml-1 text-xs opacity-70">{foundEvidence.length}</span></MenuButton>
        </aside>

        <section className="flex-1 p-6 md:p-10">
          {section === "incident" && <Incident caseTitle={theCase.title} briefing={theCase.briefing} createdAt={theCase.created_at} suspectsCount={suspects.length} evidenceCount={evidence.length} />}
          {section !== "incident" && section !== "evidence" && (
            <Page title={SECTION_TITLES[section]}>
              {section === "people" ? (
                <div className="space-y-8">
                  <div className="grid gap-3 md:grid-cols-2">{suspects.map((suspect) => (
                    <article key={suspect.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                      <h3 className="font-semibold">{suspect.name}</h3><p className="mt-1 text-sm text-red-300">{suspect.role}</p><p className="mt-3 text-sm text-gray-400">{suspect.description}</p>
                    </article>
                  ))}</div>
                  <div className="space-y-3">{bySection("people").map((item) => (
                    <Item key={item.id} item={item} studied={foundEvidenceIds.includes(item.id)} onStudy={() => item.danger && markEvidenceFound(item.id)} />
                  ))}</div>
                </div>
              ) : <div className="space-y-3">{bySection(section).map((item) => (
                <Item key={item.id} item={item} studied={foundEvidenceIds.includes(item.id)} onStudy={() => item.danger && markEvidenceFound(item.id)} />
              ))}</div>}
            </Page>
          )}
          {section === "evidence" && <EvidenceBoard items={foundEvidence} />}
        </section>
      </div>
    </main>
  );
}

function MenuButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`mb-2 w-full rounded-xl px-4 py-3 text-left transition ${active ? "bg-red-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>{children}</button>;
}

function Incident({ caseTitle, briefing, createdAt, suspectsCount, evidenceCount }: { caseTitle: string; briefing: string; createdAt: string; suspectsCount: number; evidenceCount: number }) {
  const dateLabel = new Date(createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  return <Page title={caseTitle}>
    <p className="mb-8 text-lg text-gray-400">{briefing}</p>
    <div className="grid gap-4 sm:grid-cols-3"><InfoCard title="Дата дела" value={dateLabel} /><InfoCard title="Всего улик" value={String(evidenceCount)} /><InfoCard title="Подозреваемые" value={String(suspectsCount)} /></div>
  </Page>;
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="max-w-4xl"><h2 className="mb-6 text-3xl font-bold">{title}</h2>{children}</div>;
}

function Item({ item, studied, onStudy }: { item: Evidence; studied: boolean; onStudy: () => void }) {
  const [open, setOpen] = useState(false);
  return <article className={`rounded-xl border transition ${item.danger ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
    <button onClick={() => { setOpen(!open); onStudy(); }} className="w-full p-4 text-left">
      <span className="flex items-center justify-between gap-3"><span className="font-semibold">{item.title}</span>{studied && <span className="shrink-0 rounded-full border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300">Изучено</span>}</span>
      <span className="mt-1 block text-sm text-gray-500">{item.subtitle}</span>
    </button>
    {open && <div className="space-y-3 border-t border-white/10 px-4 py-4"><EvidenceContentView item={item} />{item.hint && <p className="border-l-2 border-white/20 pl-3 text-xs italic text-gray-500">Подсказка: {item.hint}</p>}</div>}
  </article>;
}

function EvidenceContentView({ item }: { item: Evidence }) {
  const { content, type } = item;
  if (type === "log" && "lines" in content) return <div className="space-y-1 font-mono text-sm">{content.lines.map((line, i) => <p key={i} className={line.anomaly ? "text-red-400" : "text-gray-300"}>{line.text}</p>)}</div>;
  if (type === "metadata" && "entries" in content) return <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">{content.entries.map((entry, i) => <div key={i} className="contents"><span className="text-gray-500">{entry.key}</span><span className="text-gray-200">{entry.value}</span></div>)}</div>;
  if (type === "network" && "connections" in content) return <div className="space-y-2 text-sm">{content.connections.map((edge, i) => <p key={i} className={edge.anomaly ? "text-red-400" : "text-gray-300"}>{edge.from} → {edge.to} <span className="text-gray-500">({edge.label})</span></p>)}</div>;
  if (type === "testimony" && "speaker" in content) return <blockquote className="border-l-2 border-white/20 pl-3 text-sm italic text-gray-300">«{content.quote}»<footer className="mt-1 not-italic text-gray-500">— {content.speaker}</footer></blockquote>;
  return null;
}

function EvidenceBoard({ items }: { items: Evidence[] }) {
  return <Page title="Доска улик">{items.length === 0 ? <div className="rounded-xl border border-dashed border-white/20 p-12 text-center text-gray-500">Улик пока нет. Изучите материалы дела, чтобы добавить важные улики.</div> : <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-gray-500">{item.subtitle}</p><div className="mt-4"><EvidenceContentView item={item} /></div></article>)}</div>}</Page>;
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><p className="text-sm text-gray-500">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}
