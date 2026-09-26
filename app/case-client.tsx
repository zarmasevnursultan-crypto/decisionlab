"use client";

import { useState } from "react";
import type { CaseBundle, Evidence, EvidenceSection } from "@/lib/case-types";

type Section = "incident" | EvidenceSection | "evidence";

const SECTION_LABELS: Record<EvidenceSection, string> = {
  mail: "📧 Почта",
  logs: "🔐 Логи",
  files: "📁 Файлы",
  people: "👥 Люди",
};

const SECTION_TITLES: Record<EvidenceSection, string> = {
  mail: "Почта",
  logs: "Журнал входов",
  files: "Файлы",
  people: "Участники",
};

export default function CaseClient({ caseBundle }: { caseBundle: CaseBundle }) {
  const [section, setSection] = useState<Section>("incident");
  const { case: theCase, suspects, evidence, source } = caseBundle;

  const bySection = (key: EvidenceSection) =>
    evidence.filter((e) => e.section === key);

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      {/* Верхняя панель */}
      <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div>
          <p className="text-red-500 text-xs tracking-[0.3em] flex items-center gap-2">
            DECISIONLAB AI
            {source === "fallback" && (
              <span className="text-gray-500 tracking-normal border border-gray-600 rounded px-1.5 py-0.5 text-[10px] normal-case">
                fallback-режим
              </span>
            )}
          </p>

          <h1 className="text-xl font-bold">{theCase.title}</h1>
        </div>

        <div className="flex gap-6 text-sm">
          <span>
            ⏱ <b>30:00</b>
          </span>

          <span>
            🎯 <b>100</b> очков
          </span>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Меню слева */}
        <aside className="w-64 border-r border-white/10 p-4">
          <MenuButton active={section === "incident"} onClick={() => setSection("incident")}>
            🚨 Инцидент
          </MenuButton>

          {(Object.keys(SECTION_LABELS) as EvidenceSection[]).map((key) => (
            <MenuButton key={key} active={section === key} onClick={() => setSection(key)}>
              {SECTION_LABELS[key]}
            </MenuButton>
          ))}

          <MenuButton active={section === "evidence"} onClick={() => setSection("evidence")}>
            🧩 Улики
          </MenuButton>
        </aside>

        {/* Основной экран */}
        <section className="flex-1 p-10">
          {section === "incident" && (
            <Incident caseTitle={theCase.title} briefing={theCase.briefing} createdAt={theCase.created_at} suspectsCount={suspects.length} evidenceCount={evidence.length} />
          )}

          {section !== "incident" &&
            section !== "evidence" && (
              <EvidencePage title={SECTION_TITLES[section]} items={bySection(section)} />
            )}

          {section === "evidence" && <EvidenceBoard count={evidence.length} />}
        </section>
      </div>
    </main>
  );
}

function MenuButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition ${
        active ? "bg-red-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Incident({
  caseTitle,
  briefing,
  createdAt,
  suspectsCount,
  evidenceCount,
}: {
  caseTitle: string;
  briefing: string;
  createdAt: string;
  suspectsCount: number;
  evidenceCount: number;
}) {
  const dateLabel = new Date(createdAt).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="max-w-4xl">
      <p className="text-red-500 font-semibold mb-2">КРИТИЧЕСКИЙ ИНЦИДЕНТ</p>

      <h2 className="text-4xl font-bold mb-4">{caseTitle}</h2>

      <p className="text-gray-400 text-lg mb-8">{briefing}</p>

      <div className="grid grid-cols-3 gap-4">
        <InfoCard title="Дата дела" value={dateLabel} />
        <InfoCard title="Улик собрано" value={String(evidenceCount)} />
        <InfoCard title="Подозреваемых" value={String(suspectsCount)} />
      </div>
    </div>
  );
}

function EvidencePage({ title, items }: { title: string; items: Evidence[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="max-w-4xl">
      <h2 className="text-3xl font-bold mb-6">{title}</h2>

      {items.length === 0 ? (
        <div className="border border-dashed border-white/20 rounded-xl p-12 text-center text-gray-500">
          Здесь пока ничего нет
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <EvidenceItem
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => setOpenId(openId === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceItem({
  item,
  open,
  onToggle,
}: {
  item: Evidence;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`w-full text-left border rounded-xl transition ${
        item.danger
          ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
      }`}
    >
      <button onClick={onToggle} className="w-full text-left p-4">
        <p className="font-semibold">{item.title}</p>
        <p className="text-sm text-gray-500 mt-1">{item.subtitle}</p>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 py-4 space-y-3">
          <EvidenceContentView item={item} />
          {item.hint && (
            <p className="text-xs text-gray-500 italic border-l-2 border-white/20 pl-3">
              Подсказка: {item.hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceContentView({ item }: { item: Evidence }) {
  const { content, type } = item;

  if (type === "log" && "lines" in content) {
    return (
      <div className="font-mono text-sm space-y-1">
        {content.lines.map((line, i) => (
          <p key={i} className={line.anomaly ? "text-red-400" : "text-gray-300"}>
            {line.text}
          </p>
        ))}
      </div>
    );
  }

  if (type === "metadata" && "entries" in content) {
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {content.entries.map((entry, i) => (
          <div key={i} className="contents">
            <span className="text-gray-500">{entry.key}</span>
            <span className="text-gray-200">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "network" && "connections" in content) {
    return (
      <div className="space-y-2 text-sm">
        {content.connections.map((c, i) => (
          <p key={i} className={c.anomaly ? "text-red-400" : "text-gray-300"}>
            {c.from} → {c.to} <span className="text-gray-500">({c.label})</span>
          </p>
        ))}
      </div>
    );
  }

  if (type === "testimony" && "speaker" in content) {
    return (
      <blockquote className="text-sm text-gray-300 italic border-l-2 border-white/20 pl-3">
        «{content.quote}»
        <footer className="text-gray-500 not-italic mt-1">— {content.speaker}</footer>
      </blockquote>
    );
  }

  return null;
}

function EvidenceBoard({ count }: { count: number }) {
  return (
    <div className="max-w-4xl">
      <h2 className="text-3xl font-bold mb-6">Доска улик</h2>

      <div className="border border-dashed border-white/20 rounded-xl p-12 text-center text-gray-500">
        {count > 0
          ? `Собрано улик: ${count}. Доска для сопоставления пока не готова — следующий шаг.`
          : "Улик пока нет"}
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] rounded-xl p-5">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
