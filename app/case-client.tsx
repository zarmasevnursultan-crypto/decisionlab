"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CaseBundle, EvidenceSection, GenerationResult, HealthStatus, HistoryEntry, SessionSnapshot, Statistics, VerdictResult } from "@/lib/case-types";
import { api } from "@/lib/api-client";
import { useGameStore } from "@/lib/game-store";
import { calculateDisplayScore } from "@/lib/score";
import { Incident, Item, MenuButton, Page } from "./case-panels";
import EvidenceBoard from "./evidence-board";
import SessionResult, { formatTime } from "./session-result";

const labels: Record<EvidenceSection, string> = { mail: "Почта", logs: "Логи", files: "Файлы", people: "Люди" };
type Section = "incident" | EvidenceSection | "evidence" | "history" | "debug";
const buttonStyle = "rounded-xl border border-white/15 px-4 py-2 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

export default function CaseClient({ caseBundle, initialSession }: { caseBundle: CaseBundle; initialSession?: SessionSnapshot }) {
  const [bundle, setBundle] = useState(caseBundle);
  const [section, setSection] = useState<Section>("incident");
  const [busy, setBusy] = useState<string | null>(initialSession ? null : "session");
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(0);
  const receivedAt = useGameStore((state) => state.receivedAt);
  const [confirmation, setConfirmation] = useState<{ type: "verdict" | "restart" | "new"; id?: string; name?: string } | null>(null);
  const [mode, setMode] = useState<"auto" | "ai" | "local" | "fallback">("auto");
  const [generationFailed, setGenerationFailed] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const stored = useGameStore((state) => state.session);
  const syncSession = useGameStore((state) => state.syncSession);
  const session = stored?.caseId === bundle.case.id ? stored : initialSession?.caseId === bundle.case.id ? initialSession : null;
  const bootstrap = useRef<Promise<SessionSnapshot> | null>(null);

  function applySession(next: SessionSnapshot) {
    syncSession(next);
  }

  useEffect(() => {
    let alive = true;
    bootstrap.current ??= initialSession ? Promise.resolve(initialSession) : api<SessionSnapshot>("/api/case/session", { caseId: caseBundle.case.id });
    bootstrap.current.then((next) => {
      if (!alive) return;
      syncSession(next); setClock(Date.now()); setBusy(null);
    }).catch((failure: unknown) => { if (alive) { setError(failure instanceof Error ? failure.message : "Не удалось начать сессию."); setBusy(null); } });
    return () => { alive = false; };
  }, [caseBundle.case.id, initialSession, syncSession]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (busyRef.current || document.visibilityState === "hidden") return;
      try {
        const next = await api<SessionSnapshot>("/api/case/session");
        if (!alive || busyRef.current) return;
        if (next.caseId !== bundle.case.id) { setNotice("В другой вкладке начато другое дело. Обновите страницу, чтобы продолжить его."); return; }
        syncSession(next); setClock(Date.now());
      } catch { /* Actions surface errors; polling must not cover the page with repeated alerts. */ }
    };
    const timer = setInterval(() => void refresh(), 15000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [bundle.case.id, syncSession]);

  async function run(label: string, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label); setError(""); setNotice("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось выполнить действие."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  const elapsed = session ? Math.min(1800, session.elapsedSeconds + (session.status === "active" ? Math.max(0, Math.floor((clock - receivedAt) / 1000)) : 0)) : 0;
  const active = session?.status === "active" && elapsed < 1800;
  const disabled = Boolean(busy) || !active;
  const score = session ? calculateDisplayScore(elapsed, session.hintsUsed, session.wrongAttempts).total : 100;

  function study(id: string) {
    if (!active || session?.studiedEvidenceIds.includes(id)) return;
    void run("evidence", async () => { applySession(await api<SessionSnapshot>("/api/case/evidence", { evidenceId: id })); setNotice("Материал сохранён на доске улик."); });
  }
  function hint(id: string) {
    void run("hint", async () => {
      const result = await api<{ hint: string; session: SessionSnapshot }>("/api/case/hint", { evidenceId: id });
      applySession(result.session); setNotice("Подсказка открыта. Повторное чтение бесплатно.");
    });
  }
  function generate(selectedMode = mode) {
    void run("generate", async () => {
      setGenerationFailed(false);
      let result: GenerationResult;
      try { result = await api<GenerationResult>("/api/case/generate", { mode: selectedMode, previousTitle: bundle.case.title }); }
      catch (failure) { setGenerationFailed(true); throw failure; }
      const next = await api<SessionSnapshot>("/api/case/session", { caseId: result.bundle.case.id });
      applySession(next); setBundle(result.bundle); setSection("incident"); setNotice(result.generation.notice);
    });
  }
  function restart(caseId = bundle.case.id) {
    void run("restart", async () => {
      const result = await api<{ bundle: CaseBundle; session: SessionSnapshot }>("/api/case/restart", { caseId });
      applySession(result.session); setBundle(result.bundle); setSection("incident"); setNotice("Новое прохождение начато. Предыдущий результат сохранён в истории.");
    });
  }
  function verdict(id: string) {
    void run("verdict", async () => {
      const result = await api<VerdictResult>("/api/case/verdict", { suspect_id: id });
      applySession(result.session);
      setNotice(result.correct ? "Вердикт подтверждён. Дело раскрыто." : "Вердикт не подтверждён. Изучите материалы и проверьте другую версию. Штраф: 5 очков.");
    });
  }
  function openHistory() {
    setSection("history");
    void run("history", async () => {
      const [entries, summary] = await Promise.all([api<HistoryEntry[]>("/api/history"), api<Statistics>("/api/statistics")]);
      setHistory(entries); setStats(summary);
    });
  }
  function debug() { setSection("debug"); void run("health", async () => setHealth(await api<HealthStatus>("/api/health"))); }
  const material = (item: CaseBundle["evidence"][number]) => <Item key={`${session?.id}:${item.id}`} item={{ ...item, hint: session?.hints[item.id] ?? "" }} studied={Boolean(session?.studiedEvidenceIds.includes(item.id))} onStudy={() => study(item.id)} onUseHint={() => hint(item.id)} hintUsed={Boolean(session?.usedHintIds.includes(item.id))} hintDisabled={disabled} pending={Boolean(busy)} hintLoading={busy === "hint"} errorMessage={error} />;

  return <main className="min-h-screen bg-[#07090d] text-white">
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 px-5 py-5 md:px-8">
      <div className="min-w-0"><Link href="/" className="text-xs tracking-[0.3em] text-red-400">DECISIONLAB</Link><h1 className="mt-1 break-words text-xl font-bold">{bundle.case.title}</h1></div>
      <div className="flex flex-wrap items-center gap-3"><span aria-label="Оставшееся время" className="font-mono">⏱ {formatTime(Math.max(0, 1800 - elapsed))}</span><b className="text-emerald-300">{score} очков</b><button className={buttonStyle} disabled={Boolean(busy) || !session} onClick={() => setConfirmation({ type: "restart" })}>Заново</button><button className={`${buttonStyle} border-red-500/40 text-red-200`} disabled={Boolean(busy)} onClick={() => setConfirmation({ type: "new" })}>Новое дело</button></div>
    </header>
    <div className="border-b border-white/10 px-5 py-3 text-sm">
      {busy && <p role="status" aria-live="polite" className="text-cyan-200">{({ session: "Начинаем расследование…", generate: "Готовим новое расследование: получаем сценарий, проверяем материалы и сохраняем дело. ИИ может потребовать до 50 секунд.", evidence: "Сохраняем изученный материал…", hint: "Открываем подсказку…", verdict: "Проверяем вердикт…", restart: "Начинаем повторное прохождение…", history: "Загружаем историю…", health: "Проверяем сервисы…" } as Record<string, string>)[busy]}</p>}
      {error && <div role="alert" className="text-red-300">{error} {!session && <button className="ml-3 underline" disabled={Boolean(busy)} onClick={() => void run("session", async () => applySession(await api<SessionSnapshot>("/api/case/session", { caseId: bundle.case.id })))}>Повторить запуск</button>}</div>}
      {notice && <p role="status" className="text-gray-300">{notice}</p>}
      {!busy && !notice && !error && <p className="text-gray-500">Прогресс сохраняется автоматически. Каждая подсказка: −10; ошибка: −5; 30 секунд: −1.</p>}
      {generationFailed && <div className="mt-3 flex flex-wrap gap-2"><button className={buttonStyle} disabled={Boolean(busy)} onClick={() => generate()}>Повторить генерацию</button><button className={buttonStyle} disabled={Boolean(busy)} onClick={() => generate("fallback")}>Использовать резервное</button><button className={buttonStyle} disabled={Boolean(busy)} onClick={() => generate("local")}>Новое локальное дело</button></div>}
    </div>
    <div className="flex flex-col md:flex-row">
      <aside className="shrink-0 border-b border-white/10 p-4 md:w-64 md:border-r">
        <nav aria-label="Разделы расследования"><MenuButton active={section === "incident"} onClick={() => setSection("incident")}>Инцидент</MenuButton>{Object.entries(labels).map(([id, label]) => <MenuButton key={id} active={section === id} onClick={() => setSection(id as EvidenceSection)}>{label} <span className="float-right text-xs opacity-70">{session?.progress.sections[id as EvidenceSection].studied ?? 0}/{bundle.evidence.filter((item) => item.section === id).length}</span></MenuButton>)}<MenuButton active={section === "evidence"} onClick={() => setSection("evidence")}>Доска улик</MenuButton><MenuButton active={section === "history"} onClick={openHistory}>История и статистика</MenuButton><MenuButton active={section === "debug"} onClick={debug}>Состояние системы</MenuButton><Link className="block px-4 py-3 text-sm text-cyan-300 hover:underline" href="/api-test">Тестирование API ↗</Link></nav>
        <div className="mt-5 rounded-xl border border-white/10 p-4"><p className="text-sm text-gray-300">Расследование: {session?.progress.studiedEvidence ?? 0} / {bundle.evidence.length}</p><progress aria-label="Прогресс расследования" className="my-3 h-2 w-full accent-red-500" value={session?.progress.progress ?? 0} max={100} /><p className="text-xs leading-6 text-gray-500">Типы изученных материалов: {new Set(bundle.evidence.filter((item) => session?.studiedEvidenceIds.includes(item.id)).map((item) => item.type)).size} / 4</p></div>
      </aside>
      <section className="min-w-0 flex-1 p-5 md:p-8"><div className="max-w-5xl">
        {session?.status === "completed" && <SessionResult session={session} onNew={() => setConfirmation({ type: "new" })} onRestart={() => setConfirmation({ type: "restart" })} />}
        {session && !active && session.status !== "completed" && <div role="status" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5"><h2 className="font-semibold">{session.status === "abandoned" ? "Прохождение остановлено" : "Время расследования истекло"}</h2><p className="mt-2 text-sm text-gray-400">Материалы доступны для чтения. Начните заново, чтобы продолжить игру.</p><button className={`${buttonStyle} mt-3`} disabled={Boolean(busy)} onClick={() => setConfirmation({ type: "restart" })}>Начать заново</button></div>}
        {busy === "session" && <div aria-label="Загрузка сессии" className="mb-5 animate-pulse space-y-3"><div className="h-4 w-2/3 rounded bg-white/10" /><div className="h-4 w-1/2 rounded bg-white/10" /></div>}
        {section === "incident" && <Incident caseTitle={bundle.case.title} briefing={bundle.case.briefing} createdAt={bundle.case.created_at} suspectsCount={bundle.suspects.length} evidenceCount={bundle.evidence.length} />}
        {section === "evidence" && <EvidenceBoard key={session?.id ?? bundle.case.id} bundle={bundle} session={session} onStudy={study} onHint={hint} disabled={disabled} pending={Boolean(busy)} hintLoading={busy === "hint"} errorMessage={error} />}
        {section in labels && <Page title={labels[section as EvidenceSection]}>
          {section === "people" && <div className="mb-8 grid gap-4 lg:grid-cols-2">{bundle.suspects.map((person) => <article key={person.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5"><h3 className="text-lg font-semibold">{person.name}</h3><p className="mt-1 text-sm text-red-300">{person.role}</p><p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-400">{person.description}</p><button disabled={disabled || session?.attemptedSuspectIds.includes(person.id)} className={`${buttonStyle} mt-4`} onClick={() => setConfirmation({ type: "verdict", id: person.id, name: person.name })}>{session?.attemptedSuspectIds.includes(person.id) ? "Вердикт зарегистрирован" : "Вынести вердикт"}</button></article>)}</div>}
          <div className="space-y-3">{bundle.evidence.filter((item) => item.section === section).map(material)}</div>
        </Page>}
        {section === "history" && <Page title="История и статистика"><p className="mb-5 text-sm text-gray-400">Последние 100 завершённых прохождений в этом браузере. Анонимная история не переносится на другие устройства.</p>{stats && <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Раскрыто", stats.completed], ["Средний счёт", stats.averageScore], ["Лучший счёт", stats.bestScore], ["Среднее время", formatTime(stats.averageSeconds)]].map(([title, value]) => <div className="rounded-xl bg-white/5 p-4" key={title}><p className="text-xs text-gray-400">{title}</p><b className="mt-2 block text-2xl">{value}</b></div>)}</div>}{!busy && !history.length && <p className="rounded-xl border border-dashed border-white/20 p-8 text-gray-400">Завершённых расследований пока нет. Раскройте первое дело, чтобы увидеть результат здесь.</p>}<div className="space-y-3">{history.map((item) => <article key={item.sessionId} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 p-5"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm text-gray-400">{item.score} очков · {formatTime(item.elapsedSeconds)} · улики {item.studiedEvidence}/{item.totalEvidence} · подсказки {item.hintsUsed} · попытки {item.attempts}</p><p className="mt-1 text-xs text-gray-500">{new Date(item.completedAt).toLocaleString("ru-RU")}</p></div><button className={buttonStyle} disabled={Boolean(busy)} onClick={() => setConfirmation({ type: "restart", id: item.caseId, name: item.title })}>Пройти ещё раз</button></article>)}</div></Page>}
        {section === "debug" && <Page title="Состояние системы"><dl className="space-y-3 break-all text-sm">{[["Case ID", bundle.case.id], ["Session ID", session?.id ?? "не создана"], ["Статус", session?.status ?? "ожидание"], ["Хранилище дела", bundle.source], ["Материалы / участники", `${bundle.evidence.length} / ${bundle.suspects.length}`], ["База", health?.services.database ?? "не проверена"], ["OpenRouter", health?.services.ai ?? "не проверен"]].map(([key, value]) => <div key={key} className="rounded-lg border border-white/10 p-4"><dt className="text-gray-500">{key}</dt><dd className="mt-1">{value}</dd></div>)}</dl><p className="mt-4 text-sm text-gray-400">configured_not_checked означает, что ключ задан, но платный запрос к модели не выполнялся. Health проверяет доступность базы. Ответ расследования здесь не отображается.</p><button className={`${buttonStyle} mt-4`} disabled={Boolean(busy)} onClick={debug}>Обновить статус</button></Page>}
      </div></section>
    </div>
    {confirmation && <Confirmation title={confirmation.type === "verdict" ? "Вынести вердикт?" : confirmation.type === "restart" ? "Начать дело заново?" : "Новое расследование"} onClose={() => setConfirmation(null)}>
      {confirmation.type === "verdict" ? <><p>Вы выбираете: <b>{confirmation.name}</b>.</p><p className="mt-3 text-sm leading-6 text-gray-400">Решение будет зарегистрировано. Неверное обвинение стоит 5 очков; повторно обвинить того же участника в этом прохождении нельзя.</p></> : confirmation.type === "restart" ? <p className="text-gray-300">{confirmation.name ?? bundle.case.title}. Начнётся новое прохождение с нулевым прогрессом. Завершённые результаты останутся в истории.</p> : <><p className="text-sm text-gray-400">Выберите источник нового дела. В автоматическом режиме при недоступности ИИ будет создан другой локальный сценарий.</p><select aria-label="Источник нового дела" className="mt-4 w-full rounded-lg border border-white/20 bg-[#10141c] p-3" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="auto">Автоматически</option><option value="ai">Только ИИ (OpenRouter)</option><option value="local">Новый локальный сценарий</option><option value="fallback">Резервное дело «Ночной экспорт»</option></select></>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button className={buttonStyle} onClick={() => setConfirmation(null)}>Отмена</button><button className="rounded-xl bg-red-600 px-4 py-2 hover:bg-red-500" disabled={Boolean(busy)} onClick={() => { const action = confirmation; setConfirmation(null); if (action.type === "verdict") verdict(action.id!); else if (action.type === "restart") restart(action.id); else generate(); }}>{confirmation.type === "verdict" ? "Вынести вердикт" : confirmation.type === "restart" ? "Начать заново" : "Создать дело"}</button></div>
    </Confirmation>}
  </main>;
}

function Confirmation({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[min(92vw,560px)] overflow-y-auto rounded-2xl border border-white/20 bg-[#10141c] p-6 text-white shadow-2xl backdrop:bg-black/80"><h2 className="mb-4 text-2xl font-bold">{title}</h2>{children}</dialog>;
}
