"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen bg-[#07090d] p-8 text-white"><h1 className="text-2xl font-bold">Не удалось загрузить расследование</h1><p className="mt-4 text-gray-400">Проверьте доступность сервера и попробуйте ещё раз. Подробности записаны в серверный журнал.</p><button className="mt-6 rounded-xl bg-red-600 px-5 py-3" onClick={reset}>Повторить</button></main>;
}
