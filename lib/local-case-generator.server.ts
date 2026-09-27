import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { GeneratedCase } from "./fallback-case.server";

const scenarios = [
  { title: "Открытая ссылка", asset: "архив заявок на стипендии", file: "scholarships.zip", role: "Координатор стипендиальной программы", action: "create_public_link", mechanism: "создание общедоступной ссылки без срока действия", trace: "public_link", destination: "share.external.example", claim: "Я подготовил внутреннюю подборку, но внешних ссылок не создавал. Архив должен был остаться доступным только комиссии.", consequence: "В заявках содержатся сведения о доходах семей и основаниях для материальной помощи. Комиссия приостановила рассмотрение заявок до проверки доступа." },
  { title: "Подмена получателя", asset: "пакет договоров исследовательского гранта", file: "grant_contracts.zip", role: "Секретарь грантового отдела", action: "change_recipient_and_send", mechanism: "подмена адреса получателя в согласованной отправке", trace: "mail_delivery", destination: "contracts@partner-review.example", claim: "Я проверил вложения и оставил адрес партнёра без изменений. Письмо должно было уйти только на заранее согласованный адрес.", consequence: "В договорах указаны неопубликованные условия финансирования и банковские реквизиты. Юридический отдел остановил следующие отправки партнёрам." },
  { title: "Лишняя синхронизация", asset: "каталог результатов закрытого исследования", file: "lab_results.zip", role: "Инженер исследовательской лаборатории", action: "enable_external_sync", mechanism: "подключение внешнего хранилища к служебной папке", trace: "sync_job", destination: "vault.external.example", claim: "Я проверял локальные резервные копии. Внешнюю синхронизацию не включал: правила лаборатории разрешают только университетское хранилище.", consequence: "Каталог содержит исходные измерения до публикации и сведения об участниках исследования. Руководитель лаборатории временно ограничил выгрузку результатов." },
  { title: "Экспорт после закрытия", asset: "реестр экзаменационных ведомостей", file: "exam_register.zip", role: "Оператор учебного офиса", action: "export_with_service_token", mechanism: "выгрузка через служебный токен за пределами согласованного задания", trace: "export_job", destination: "transfer.external.example", claim: "После закрытия офиса я проверял только расписание. Выгрузку ведомостей не запускал и служебный токен для неё не использовал.", consequence: "Реестр содержит оценки, номера студенческих документов и служебные комментарии. Учебный офис проверяет, какие записи могли покинуть защищённую систему." },
];

const names = ["Алия Р.", "Марат Б.", "Сауле К.", "Руслан А.", "Динара Т.", "Ерлан С.", "Мадина Н.", "Арман Д."];
const locations = ["Северный кампус", "Научный корпус", "Центральный кампус", "Восточный корпус"];

// Vary the mechanism as well as names and identifiers. Never repeat the previous theme.
export function generateLocalCase(previousTitle = ""): GeneratedCase {
  const choices = scenarios.filter((item) => previousTitle.split(" · ")[0] !== item.title);
  const scenario = choices[randomInt(choices.length)];
  const reference = randomUUID().slice(0, 8).toUpperCase();
  const location = locations[randomInt(locations.length)];
  const pool = [...names];
  const takeName = () => pool.splice(randomInt(pool.length), 1)[0];
  const actor = takeName();
  const colleague = takeName();
  const technician = takeName();
  const device = `WS-${randomInt(10, 99)}`;
  const key = `KEY-${randomInt(100, 999)}`;
  const count = randomInt(80, 480);
  const size = randomInt(120, 850);
  const hour = randomInt(18, 22);
  const time = (minute: number) => `${hour}:${String(minute).padStart(2, "0")}`;
  const job = `JOB-${reference}`;
  const suspects = [
    { name: actor, role: scenario.role, description: `Обязанности: подготовка материалов и передача согласованных пакетов. Доступ: может читать ${scenario.asset} и запускать служебные операции с личным подтверждением. Закреплённое устройство: ${device}; персональный аппаратный ключ: ${key}.\n\nОбъяснение участника: «${scenario.claim}» Проверить следует не только права доступа, но и то, кто физически подтвердил спорную операцию.` },
    { name: colleague, role: "Специалист по согласованию", description: `Проверяет состав пакета и список получателей. Имеет доступ на чтение, но не может менять правила передачи. Рабочее устройство REVIEW-02.\n\nСообщает, что в ${time(3)} согласовал внутреннюю обработку и завершил сеанс до начала спорной операции. Его имя встречается в переписке, поэтому время согласования нужно сопоставить с журналом изменений.` },
    { name: technician, role: "Дежурный специалист ИТ", description: `Следит за доступностью сервисов и резервными копиями. Работает с MONITOR-03, может читать технические журналы, но не содержимое защищённых пакетов.\n\nСообщает, что выполнял плановую проверку внутреннего сервера. Наличие административной должности само по себе не доказывает участие: проверьте адрес назначения и идентификатор задания.` },
  ];
  // The answer must not be predictable from the suspect's position.
  for (let i = suspects.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [suspects[i], suspects[j]] = [suspects[j], suspects[i]];
  }
  return {
    title: `${scenario.title} · ${reference}`,
    briefing: `Обстоятельства\n${location}. В ${time(32)} система контроля передачи данных зарегистрировала выход защищённого пакета за пределы университета. Объект расследования — ${scenario.asset}: ${count} документов общим объёмом ${size} МБ. Дежурный ограничил дальнейшие передачи, но уже выполненная операция требует отдельной проверки.\n\nЧто известно\nПакет готовили для внутренней обработки. В переписке есть согласование, однако назначение фактической передачи отличается от разрешённого. Рабочая гипотеза службы безопасности — ${scenario.mechanism}. Это ещё не вывод о виновности: нужно установить связь между действием, устройством и человеком.\n\nПоследствия\n${scenario.consequence}\n\nЗадача расследования\nВосстановите последовательность от согласования до передачи, проверьте объяснения всех трёх участников и выберите человека, чьё действие подтверждается независимыми источниками. Совпадения имени в письме недостаточно. Все отметки времени относятся к одному дню, часовой пояс UTC+5. Исходные материалы сохранены до блокировки доступа.`,
    suspects,
    culprit_index: suspects.findIndex((person) => person.name === actor),
    evidence: [
      { type: "metadata", section: "mail", title: "Согласование обработки пакета", subtitle: `${time(3)} · служебная переписка`, danger: true, content: { entries: [
        { key: "Отправитель", value: colleague }, { key: "Получатель", value: actor },
        { key: "Тема", value: `Обработка: ${scenario.asset}` },
        { key: "Текст письма", value: `Состав из ${count} документов проверен. Разрешена только внутренняя обработка. Не создавайте публичные ссылки, не меняйте получателя и не подключайте внешние хранилища без нового согласования.` },
        { key: "Разрешённое назначение", value: "review.university.internal" },
        { key: "Проверка подлинности", value: "Подпись отправителя подтверждена; изменений письма после отправки нет." },
      ] }, hint: "Отделите разрешение подготовить пакет от разрешения передать его наружу. Сравните назначение с сетевым журналом." },
      { type: "log", section: "logs", title: "Журнал действий с пакетом", subtitle: `${time(6)}–${time(19)} · аудит приложения`, danger: true, content: { lines: [
        { text: `${time(6)} user=${colleague} device=REVIEW-02 action=logout result=success`, anomaly: false },
        { text: `${time(11)} user=${actor} device=${device} action=open_package file=${scenario.file}`, anomaly: false },
        { text: `${time(14)} user=${actor} device=${device} action=${scenario.action} trace=${scenario.trace} job=${job}`, anomaly: true },
        { text: `${time(15)} job=${job} destination=${scenario.destination} approval=missing`, anomaly: true },
        { text: `${time(19)} job=${job} status=completed documents=${count} bytes_mb=${size}`, anomaly: true },
      ] }, hint: "Найдите действие, изменившее способ передачи, и проследите один и тот же job во всех источниках. Имя пользователя проверьте по отдельному журналу подтверждений." },
      { type: "log", section: "logs", title: "Подтверждение чувствительной операции", subtitle: `${time(13)}–${time(14)} · независимый сервер доступа`, danger: true, content: { lines: [
        { text: `${time(13)} device=${device} console=local remote_session=none`, anomaly: false },
        { text: `${time(14)} job=${job} hardware_key=${key} owner=${actor} physical_touch=verified user_verification=passed`, anomaly: true },
        { text: `${time(14)} requested_action=${scenario.action} signed_destination=${scenario.destination}`, anomaly: true },
        { text: `${time(14)} confirmation=accepted replay=false source=independent_auth_service`, anomaly: false },
      ] }, hint: "Этот источник связывает действие с личным ключом и физическим подтверждением. Проверьте, совпадают ли операция и назначение с аудитом приложения." },
      { type: "network", section: "logs", title: "Куда ушёл пакет", subtitle: `${time(16)}–${time(24)} · шлюз и служба адресов`, danger: true, content: { connections: [
        { from: device, to: scenario.destination, label: `${time(16)}–${time(19)} · ${job} · ${size} МБ · передача завершена`, anomaly: true },
        { from: "MONITOR-03", to: "backup.university.internal", label: `${time(20)} · проверка резервной копии · 2 МБ · внутренний узел`, anomaly: false },
        { from: "REVIEW-02", to: "review.university.internal", label: `${time(3)}–${time(6)} · согласование · 1 МБ · сеанс завершён`, anomaly: false },
        { from: "Служба адресов", to: device, label: `Закрепление за устройством подтверждено на весь интервал ${time(0)}–${time(30)}; смены адреса не было`, anomaly: false },
      ] }, hint: "Сравните внешнюю передачу с обычной внутренней активностью других устройств. Сверьте объём и идентификатор задания с манифестом." },
      { type: "metadata", section: "files", title: "Манифест переданного архива", subtitle: `${time(19)} · копия из журнала контроля`, danger: true, content: { entries: [
        { key: "Имя файла", value: scenario.file }, { key: "Содержимое", value: scenario.asset },
        { key: "Число документов", value: String(count) }, { key: "Объём", value: `${size} МБ` },
        { key: "Задание", value: job }, { key: "Фактическое назначение", value: scenario.destination },
        { key: "Политика доступа", value: "Только внутренняя обработка; согласование внешней передачи отсутствует" },
        { key: "Сохранность", value: "Контрольные суммы исходного пакета и копии на шлюзе совпадают. Подмена содержимого после операции не обнаружена." },
      ] }, hint: "Манифест подтверждает, что наружу передали именно защищённый пакет, а не небольшой технический отчёт." },
      { type: "testimony", section: "people", title: "Объяснение ответственного за пакет", subtitle: `${time(40)} · опрос после блокировки`, danger: true, content: { speaker: actor, quote: `${scenario.claim} Устройство ${device} в этот период было у меня, ключ ${key} никому не передавал. Я действительно открывал пакет, чтобы проверить состав, но считаю, что последующая передача произошла автоматически. Прошу сверить журнал с плановыми заданиями.` }, hint: "Сопоставьте версию об автоматическом задании с локальным подтверждением конкретной операции и выбранного назначения." },
      { type: "testimony", section: "people", title: "Показания согласующего специалиста", subtitle: `${time(43)} · проверка переписки`, danger: false, content: { speaker: colleague, quote: `Я согласовал только состав пакета и внутреннюю обработку. После ${time(6)} завершил сеанс REVIEW-02. Новый адрес назначения мне не присылали, внешнюю передачу я не утверждал. Моё имя осталось в цепочке письма, но это не означает, что я запускал отправку. Время выхода можно проверить в аудите приложения.` }, hint: "Проверьте границы выданного согласования и независимое подтверждение завершения сеанса." },
      { type: "testimony", section: "people", title: "Отчёт дежурного ИТ", subtitle: `${time(47)} · проверка плановых работ`, danger: false, content: { speaker: technician, quote: `Моя проверка с MONITOR-03 обращалась только к backup.university.internal. В расписании нет задания ${job}; оно создано вручную через пользовательский интерфейс. Для операции ${scenario.action} требуется личное подтверждение ключом. Я сохранил журналы до блокировки, их время синхронизировано. Чужие ключи доступа мне не выдавали.` }, hint: "Проверьте показания по сетевому журналу и серверу доступа. Техническая должность не заменяет доказательств конкретного действия." },
    ],
  };
}
