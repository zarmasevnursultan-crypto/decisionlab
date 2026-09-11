export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center max-w-3xl">
        <p className="text-red-500 tracking-[0.3em] text-sm mb-4">
          DECISIONLAB AI
        </p>

        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          CYBER INVESTIGATION
        </h1>

        <p className="text-gray-400 text-lg md:text-xl mb-10">
          В университете произошла утечка конфиденциальных данных.
          Найди источник атаки, собери доказательства и раскрой дело.
        </p>

        <div className="flex justify-center gap-6 mb-10 text-gray-300">
          <span>⏱ 30 минут</span>
          <span>🧩 Улики</span>
          <span>🧠 AI-сценарий</span>
        </div>

        <button className="bg-red-600 hover:bg-red-700 transition px-8 py-4 rounded-xl text-lg font-semibold">
          НАЧАТЬ РАССЛЕДОВАНИЕ
        </button>
      </div>
    </main>
  );
}