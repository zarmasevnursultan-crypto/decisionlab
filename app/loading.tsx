export default function Loading() {
  return <main className="min-h-screen bg-[#07090d] p-8 text-white" aria-busy="true"><p role="status" className="text-red-300">Загружаем расследование…</p><div className="mt-8 max-w-4xl animate-pulse space-y-5"><div className="h-10 w-2/3 rounded bg-white/10" /><div className="h-40 rounded-xl bg-white/5" /><div className="h-40 rounded-xl bg-white/5" /></div></main>;
}
