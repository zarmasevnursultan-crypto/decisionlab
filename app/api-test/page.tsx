"use client";
import { useState } from "react";
import Link from "next/link";
import endpoints from "@/lib/api-contract.json";
import type { ApiResponse, CaseBundle, GenerationResult } from "@/lib/case-types";

type RequestLog = { id: number; method: string; url: string; status: number; duration: number; body: string; response: string };
export default function ApiTestPage() {
  const [selected, setSelected] = useState(0);
  const [body, setBody] = useState("{}");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RequestLog | null>(null);
  const [history, setHistory] = useState<RequestLog[]>([]);
  const [message, setMessage] = useState("");
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const endpoint = endpoints[selected];
  function select(index: number) {
    setSelected(index); setQuery(""); setMessage("");
    const example: Record<string, unknown> = { ...(endpoints[index].body ?? {}) };
    if (bundle) { if ("caseId" in example) example.caseId = bundle.case.id; if ("evidenceId" in example) example.evidenceId = bundle.evidence[0]?.id; if ("suspect_id" in example) example.suspect_id = bundle.suspects[0]?.id; }
    setBody(JSON.stringify(example, null, 2));
  }
  async function send() {
    if (busy) return;
    let payload: unknown;
    try { payload = endpoint.method === "POST" ? JSON.parse(body) : undefined; }
    catch { setMessage("Исправьте JSON в редакторе запроса."); return; }
    setBusy(true); setMessage("");
    const start = performance.now();
    const url = endpoint.path + (endpoint.path === "/api/case" && query ? `?caseId=${encodeURIComponent(query)}` : "");
    try {
      const response = await fetch(url, { method: endpoint.method, headers: { "Content-Type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), cache: "no-store" });
      const text = await response.text();
      let pretty = text;
      try {
        const parsed = JSON.parse(text) as ApiResponse<CaseBundle | GenerationResult>;
        pretty = JSON.stringify(parsed, null, 2);
        if (parsed.success && endpoint.path === "/api/case") setBundle(parsed.data as CaseBundle);
        if (parsed.success && endpoint.path === "/api/case/generate") setBundle((parsed.data as GenerationResult).bundle);
      } catch { /* Preserve non-JSON responses for diagnostics. */ }
      const entry = { id: Date.now(), method: endpoint.method, url, status: response.status, duration: Math.round(performance.now() - start), body, response: pretty };
      setResult(entry); setHistory((items) => [entry, ...items].slice(0, 20));
    } catch { setMessage("Соединение с сервером потеряно. Проверьте, что приложение запущено."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#07090d] p-5 text-white md:p-10"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-wrap justify-between gap-4"><div><p className="text-xs tracking-widest text-red-400">DECISIONLAB / DEVELOPER TOOLS</p><h1 className="mt-2 text-3xl font-bold">API Tester</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">Запросы используют cookie этого браузера и меняют текущее прохождение. Начните с GET /api/case или создайте дело; реальные ID автоматически подставятся при выборе следующего запроса.</p></div><div className="flex gap-4 text-sm text-cyan-300"><Link href="/">Вернуться в игру</Link><a href="/openapi.json" target="_blank" rel="noreferrer">OpenAPI ↗</a></div></header>
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"><aside className="space-y-2">{endpoints.map((item, index) => <button key={`${item.method}:${item.path}`} className={`w-full rounded-xl border p-3 text-left text-sm ${selected === index ? "border-red-500/50 bg-red-500/10" : "border-white/10 hover:bg-white/5"}`} onClick={() => select(index)} disabled={busy}><span className={item.method === "GET" ? "text-emerald-300" : "text-amber-300"}>{item.method}</span><span className="ml-2 break-all">{item.path}</span></button>)}</aside>
      <section className="min-w-0 space-y-5"><div className="rounded-2xl border border-white/10 p-5"><h2 className="break-all font-mono text-lg">{endpoint.method} {endpoint.path}</h2><p className="mt-2 text-sm text-gray-400">{endpoint.description}</p>
        {endpoint.method === "POST" && <label className="mt-5 block text-sm text-gray-400">Request body<textarea aria-label="JSON запроса" spellCheck={false} value={body} onChange={(event) => setBody(event.target.value)} className="mt-2 min-h-44 w-full rounded-xl border border-white/15 bg-black/30 p-4 font-mono text-sm text-gray-200" /></label>}
        {endpoint.path === "/api/case" && <label className="mt-4 block text-sm text-gray-400">caseId (необязательно)<input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 p-3 text-white" placeholder="Пусто — текущее дело" /></label>}
        {bundle && <details className="mt-4 text-sm"><summary className="cursor-pointer text-cyan-300">ID загруженного дела и материалов</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs text-gray-400">{JSON.stringify({ caseId: bundle.case.id, evidence: bundle.evidence.map(({ id, title }) => ({ id, title })), suspects: bundle.suspects.map(({ id, name }) => ({ id, name })) }, null, 2)}</pre></details>}
        <button className="mt-5 rounded-xl bg-red-600 px-6 py-3 hover:bg-red-500 disabled:opacity-40" disabled={busy} onClick={() => void send()}>{busy ? "Отправляем запрос…" : "Send"}</button>
      </div>
      {message && <p role="status" className="text-amber-300">{message}</p>}
      <div className="rounded-2xl border border-white/10 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-semibold">Response</h2><div className="flex gap-4 text-sm"><button disabled={!result} className="text-cyan-300 disabled:opacity-30" onClick={async () => { try { await navigator.clipboard.writeText(result?.response ?? ""); setMessage("Ответ скопирован."); } catch { setMessage("Копирование недоступно. Выделите JSON вручную."); } }}>Copy</button><button className="text-gray-400" onClick={() => { setResult(null); setMessage(""); }}>Clear</button></div></div>{result ? <><div className="my-4 flex gap-8 font-mono"><p className={result.status < 400 ? "text-emerald-300" : "text-red-300"}>STATUS {result.status}</p><p className="text-gray-400">TIME {result.duration} ms</p></div><pre tabIndex={0} className="max-h-[650px] overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-gray-300">{result.response}</pre></> : <p className="py-8 text-gray-500">Отправьте запрос — здесь появятся статус, время и JSON.</p>}</div>
      <div className="rounded-2xl border border-white/10 p-5"><div className="flex justify-between"><h2 className="font-semibold">Последние запросы</h2><button className="text-sm text-gray-400" onClick={() => setHistory([])}>Очистить историю</button></div><p className="mt-2 text-xs text-gray-500">До 20 запросов, только в памяти этой страницы.</p><div className="mt-4 space-y-2">{history.map((item) => <button key={item.id} onClick={() => setResult(item)} className="flex w-full flex-wrap justify-between gap-2 rounded-lg bg-white/5 p-3 text-left font-mono text-xs hover:bg-white/10"><span>{item.method} {item.url}</span><span>{item.status} · {item.duration} ms</span></button>)}</div></div>
      </section></div>
  </div></main>;
}
