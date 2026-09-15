"use client";

import { useState } from "react";

type Section = "incident" | "mail" | "logs" | "files" | "people" | "evidence";

export default function Case001() {
  const [section, setSection] = useState<Section>("incident");

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      {/* Верхняя панель */}
      <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div>
          <p className="text-red-500 text-xs tracking-[0.3em]">
            DECISIONLAB AI
          </p>

          <h1 className="text-xl font-bold">
            CASE #001
          </h1>
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
          <MenuButton
            active={section === "incident"}
            onClick={() => setSection("incident")}
          >
            🚨 Инцидент
          </MenuButton>

          <MenuButton
            active={section === "mail"}
            onClick={() => setSection("mail")}
          >
            📧 Почта
          </MenuButton>

          <MenuButton
            active={section === "logs"}
            onClick={() => setSection("logs")}
          >
            🔐 Логи
          </MenuButton>

          <MenuButton
            active={section === "files"}
            onClick={() => setSection("files")}
          >
            📁 Файлы
          </MenuButton>

          <MenuButton
            active={section === "people"}
            onClick={() => setSection("people")}
          >
            👥 Люди
          </MenuButton>

          <MenuButton
            active={section === "evidence"}
            onClick={() => setSection("evidence")}
          >
            🧩 Улики
          </MenuButton>
        </aside>

        {/* Основной экран */}
        <section className="flex-1 p-10">
          {section === "incident" && <Incident />}
          {section === "mail" && <Mail />}
          {section === "logs" && <Logs />}
          {section === "files" && <Files />}
          {section === "people" && <People />}
          {section === "evidence" && <Evidence />}
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
        active
          ? "bg-red-600 text-white"
          : "text-gray-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Incident() {
  return (
    <div className="max-w-4xl">
      <p className="text-red-500 font-semibold mb-2">
        КРИТИЧЕСКИЙ ИНЦИДЕНТ
      </p>

      <h2 className="text-4xl font-bold mb-4">
        Утечка закрытых документов
      </h2>

      <p className="text-gray-400 text-lg mb-8">
        Сегодня в 09:10 система безопасности обнаружила массовое скачивание
        конфиденциальных файлов из внутреннего облачного хранилища университета.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <InfoCard title="Время обнаружения" value="09:10" />
        <InfoCard title="Скачано файлов" value="214" />
        <InfoCard title="Подозреваемых" value="3" />
      </div>
    </div>
  );
}

function Mail() {
  return (
    <Page title="Почта">
      <Item
        title="⚠️ Срочная проверка аккаунта"
        subtitle="02:57 · IT Support"
        danger
      />

      <Item
        title="Материалы к лекции"
        subtitle="Вчера · Амина"
      />

      <Item
        title="Обновление портала"
        subtitle="Вчера · System"
      />
    </Page>
  );
}

function Logs() {
  return (
    <Page title="Журнал входов">
      <Item
        title="Windows PC"
        subtitle="02:31 · Павлодар"
      />

      <Item
        title="Android"
        subtitle="02:46 · Павлодар"
      />

      <Item
        title="⚠️ Unknown Linux"
        subtitle="03:14 · новое устройство"
        danger
      />
    </Page>
  );
}

function Files() {
  return (
    <Page title="Файлы">
      <Item
        title="students_private.xlsx"
        subtitle="03:18 · скачан"
        danger
      />

      <Item
        title="research_data.zip"
        subtitle="03:19 · скачан"
        danger
      />

      <Item
        title="meeting_notes.pdf"
        subtitle="Вчера · просмотрен"
      />
    </Page>
  );
}

function People() {
  return (
    <Page title="Участники">
      <Item
        title="Амина С."
        subtitle="Преподаватель"
      />

      <Item
        title="Тимур К."
        subtitle="Системный администратор"
      />

      <Item
        title="Данияр М."
        subtitle="Студент-ассистент"
      />
    </Page>
  );
}

function Evidence() {
  return (
    <Page title="Доска улик">
      <div className="border border-dashed border-white/20 rounded-xl p-12 text-center text-gray-500">
        Улик пока нет
      </div>
    </Page>
  );
}

function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-4xl">
      <h2 className="text-3xl font-bold mb-6">
        {title}
      </h2>

      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function Item({
  title,
  subtitle,
  danger = false,
}: {
  title: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <button
      className={`w-full text-left border rounded-xl p-4 transition ${
        danger
          ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
      }`}
    >
      <p className="font-semibold">
        {title}
      </p>

      <p className="text-sm text-gray-500 mt-1">
        {subtitle}
      </p>
    </button>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.03] rounded-xl p-5">
      <p className="text-gray-500 text-sm">
        {title}
      </p>

      <p className="text-2xl font-bold mt-2">
        {value}
      </p>
    </div>
  );
}