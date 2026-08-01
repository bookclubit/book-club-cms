// Общая форма встречи для страниц создания (AddEvent) и редактирования
// (EditEvent): единое состояние, сборка объекта события и общая разметка.
// Страницы различаются только стратегией сабмита (создание vs перенос файла)
// и Edit-блоками (галка «завершена», заявки D1, монтажные ролики).

import { useState, type ReactNode } from 'react'
import { BOARD_OPTS } from '../lib/image'
import { parseMaterials } from '../lib/materials'
import type { FileChange } from '../lib/pr'
import { RAW_BASE } from '../lib/repo'
import type {
  ClosedChapterEvent,
  ContentIndex,
  EventModerator,
  EventRecordings,
  IndexBook,
  LiveTalkEvent,
} from '../types'
import { emptyProgramBlock, ProgramEditor, type ProgramFormBlock } from './ProgramEditor'
import { ImagePicker } from './ImagePicker'
import { PosterPicker } from './PosterPicker'
import { ModeratorPicker } from './ModeratorPicker'
import { Card, CardTitle, Field, Select, TextArea, TextInput } from './ui'

export type EventKind = 'closed-chapter' | 'live-talk'

// Единое состояние формы встречи. Поля recordings и finished заполняются
// только на странице редактирования — при создании остаются пустыми и в
// собранный объект не попадают.
export function useEventFormState() {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [callUrl, setCallUrl] = useState('')
  const [materialsText, setMaterialsText] = useState('')
  // Афиши для постов в группу: анонс сразу и афиша в день встречи.
  const [posterAnnounce, setPosterAnnounce] = useState<Uint8Array | null>(null)
  const [posterDay, setPosterDay] = useState<Uint8Array | null>(null)
  // Постить ли встречу в группу клуба (иногда встречу заводят «в стол»).
  const [announce, setAnnounce] = useState(true)

  // closed-chapter
  const [folder, setFolder] = useState('')
  const [chapterSlug, setChapterSlug] = useState('')
  const [pagesFrom, setPagesFrom] = useState('')
  const [pagesTo, setPagesTo] = useState('')
  const [boardUrl, setBoardUrl] = useState('')
  const [boardFile, setBoardFile] = useState<Uint8Array | null>(null)
  const [moderatorIds, setModeratorIds] = useState<string[]>([])

  // live-talk
  const [youtube, setYoutube] = useState('')
  const [vk, setVk] = useState('')
  const [stream, setStream] = useState('')
  // Программа эфира блоками: за вечер бывает несколько глав и даже книг.
  const [blocks, setBlocks] = useState<ProgramFormBlock[]>([emptyProgramBlock()])
  // Edit-only: монтажные ролики докладов (id темы → ссылки).
  const [recordings, setRecordings] = useState<EventRecordings>({})

  // Edit-only: завершённость встречи (уводит в архив в miniapp).
  const [finished, setFinished] = useState(false)

  return {
    title, setTitle,
    date, setDate,
    time, setTime,
    callUrl, setCallUrl,
    materialsText, setMaterialsText,
    posterAnnounce, setPosterAnnounce,
    posterDay, setPosterDay,
    announce, setAnnounce,
    folder, setFolder,
    chapterSlug, setChapterSlug,
    pagesFrom, setPagesFrom,
    pagesTo, setPagesTo,
    boardUrl, setBoardUrl,
    boardFile, setBoardFile,
    moderatorIds, setModeratorIds,
    youtube, setYoutube,
    vk, setVk,
    stream, setStream,
    blocks, setBlocks,
    recordings, setRecordings,
    finished, setFinished,
  }
}

export type EventFormState = ReturnType<typeof useEventFormState>

// Готовность к сабмиту: название, дата, время; для разбора главы — книга и глава.
// Эфир можно создать и без докладов: спикеры запишутся через бота.
export function isEventFormReady(
  kind: EventKind,
  form: EventFormState,
  book: IndexBook | undefined,
): boolean {
  const common = Boolean(
    form.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && form.time,
  )
  return common && (kind === 'closed-chapter' ? Boolean(book && form.chapterSlug) : true)
}

// Сборка объекта события из состояния формы + сопутствующие файлы (доска WebP).
export function buildEventFiles(opts: {
  kind: EventKind
  form: EventFormState
  index: ContentIndex
  slug: string
}): { event: ClosedChapterEvent | LiveTalkEvent; extraFiles: FileChange[] } {
  const { kind, form, index, slug } = opts
  const book = index.books.find((b) => b.folder === form.folder)
  const prefix = kind === 'closed-chapter' ? 'closed' : 'live'
  const id = `${prefix}-${form.date}-${slug}`

  const materials = parseMaterials(form.materialsText)
  const streams = {
    ...(form.youtube.trim() ? { youtube: form.youtube.trim() } : {}),
    ...(form.vk.trim() ? { vk: form.vk.trim() } : {}),
  }
  const common = {
    // Meet — только у открытых обсуждений; доклады — чистовая запись.
    ...(kind === 'closed-chapter' && form.callUrl.trim()
      ? { call_url: form.callUrl.trim() }
      : {}),
    ...(materials.length > 0 ? { materials } : {}),
    ...(form.finished ? { finished: true } : {}),
  }

  const extraFiles: FileChange[] = []

  if (kind === 'closed-chapter') {
    // Доска — либо ссылка, либо загруженный файл (кладём в media/boards).
    let boardHref = form.boardUrl.trim()
    if (form.boardFile) {
      const boardPath = `media/boards/${form.date}-${slug}.webp`
      extraFiles.push({ path: boardPath, content: form.boardFile })
      boardHref = `${RAW_BASE}/${boardPath}`
    }
    const moderators: EventModerator[] = form.moderatorIds
      .map((mid) => index.speakers.find((s) => s.id === mid))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({ speaker_id: s.id, name: s.name, avatar: s.avatar }))
    const event: ClosedChapterEvent = {
      id,
      type: 'closed-chapter',
      title: form.title.trim(),
      date: form.date,
      time: form.time,
      timezone: 'Europe/Moscow',
      book_id: book!.id,
      chapter: form.chapterSlug,
      ...(Number(form.pagesFrom) > 0 && Number(form.pagesTo) > 0
        ? { pages: { from: Number(form.pagesFrom), to: Number(form.pagesTo) } }
        : {}),
      ...(boardHref ? { notes_board_url: boardHref } : {}),
      ...(Object.keys(streams).length > 0 ? { streams } : {}),
      ...(Number(form.stream) > 0 ? { stream: Number(form.stream) } : {}),
      ...(moderators.length > 0 ? { moderators } : {}),
      ...common,
    }
    return { event, extraFiles }
  }

  // Программа эфира: блоки формы (книга папкой) → блоки события (книга id).
  const program = form.blocks
    .filter((b) => b.folder && b.chapterSlug)
    .map((b) => ({
      book_id: index.books.find((x) => x.folder === b.folder)?.id ?? b.folder,
      chapter: b.chapterSlug,
      ...(b.topicIds.length > 0 ? { topic_ids: b.topicIds } : {}),
    }))
  // Темы встречи — из всех блоков: по ним чистим монтажные ролики.
  const programTopicIds = form.blocks.flatMap((b) => b.topicIds)

  // Монтажные ролики: только непустые ссылки и только по темам встречи.
  const cleanRecordings: EventRecordings = {}
  for (const [topicId, rec] of Object.entries(form.recordings)) {
    if (programTopicIds.length > 0 && !programTopicIds.includes(topicId)) continue
    const yt = rec.youtube?.trim()
    const v = rec.vk?.trim()
    if (yt || v) {
      cleanRecordings[topicId] = { ...(yt ? { youtube: yt } : {}), ...(v ? { vk: v } : {}) }
    }
  }
  const event: LiveTalkEvent = {
    id,
    type: 'live-talk',
    title: form.title.trim(),
    date: form.date,
    time: form.time,
    timezone: 'Europe/Moscow',
    streams,
    // Занятость тем живёт в заявках D1 (единый источник), не в event.talks.
    talks: [],
    // Программа эфира блоками: из неё бот предлагает темы спикерам.
    ...(program.length > 0 ? { program } : {}),
    // Первый блок дублируем полями события: по ним встречу находят читатели,
    // которые ещё не знают про program (и старые файлы выглядят так же).
    ...(program[0]
      ? {
          book_id: program[0].book_id,
          chapter: program[0].chapter,
          ...(program[0].topic_ids ? { topic_ids: program[0].topic_ids } : {}),
        }
      : {}),
    ...(Object.keys(cleanRecordings).length > 0 ? { recordings: cleanRecordings } : {}),
    ...(Number(form.stream) > 0 ? { stream: Number(form.stream) } : {}),
    ...common,
  }
  return { event, extraFiles }
}

interface EventFormFieldsProps {
  kind: EventKind
  form: EventFormState
  index: ContentIndex | null
  /** Слот в начале первой карточки — AddEvent показывает здесь селектор типа. */
  kindSelector?: ReactNode
  titlePlaceholder?: string
  /** Edit-блоки после программы эфира (заявки D1, монтажные ролики). */
  liveTalkExtra?: ReactNode
}

// Общая разметка полей встречи (обе страницы).
export function EventFormFields({
  kind,
  form,
  index,
  kindSelector,
  titlePlaceholder,
  liveTalkExtra,
}: EventFormFieldsProps) {
  const book = index?.books.find((b) => b.folder === form.folder)

  return (
    <>
      <Card>
        <div className="space-y-4">
          {kindSelector}
          <Field label="Название">
            <TextInput
              value={form.title}
              onChange={(e) => form.setTitle(e.target.value)}
              placeholder={titlePlaceholder}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Дата">
              <TextInput
                type="date"
                value={form.date}
                onChange={(e) => form.setDate(e.target.value)}
              />
            </Field>
            <Field label="Время (МСК)">
              <TextInput
                type="time"
                value={form.time}
                onChange={(e) => form.setTime(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Номер стрима"
            hint={
              kind === 'live-talk'
                ? 'показывается как «Книжный клуб N»; ещё и в имени папки презентации BC-<стрим>-…'
                : 'показывается как «Книжный клуб N»'
            }
          >
            <TextInput
              type="number"
              min={1}
              value={form.stream}
              onChange={(e) => form.setStream(e.target.value)}
              placeholder="113"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Трансляция YouTube">
              <TextInput
                value={form.youtube}
                onChange={(e) => form.setYoutube(e.target.value)}
              />
            </Field>
            <Field label="Трансляция VK">
              <TextInput value={form.vk} onChange={(e) => form.setVk(e.target.value)} />
            </Field>
          </div>
          {kind === 'closed-chapter' && (
            <Field
              label="Google Meet (подключиться к обсуждению)"
              hint="бот выдаст ссылку записавшимся; у докладов созвона нет — это чистовая запись"
            >
              <TextInput
                value={form.callUrl}
                onChange={(e) => form.setCallUrl(e.target.value)}
                placeholder="https://meet.google.com/…"
              />
            </Field>
          )}
          <Field label="Доп. материалы" hint="по одному на строку: «название | ссылка»">
            <TextArea
              rows={2}
              value={form.materialsText}
              onChange={(e) => form.setMaterialsText(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {kind === 'closed-chapter' && (
        <Card>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Книга">
                <Select
                  value={form.folder}
                  onChange={(e) => {
                    form.setFolder(e.target.value)
                    form.setChapterSlug('')
                  }}
                >
                  <option value="">— выберите —</option>
                  {index?.books.map((b) => (
                    <option key={b.folder} value={b.folder}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Глава">
                <Select
                  value={form.chapterSlug}
                  onChange={(e) => form.setChapterSlug(e.target.value)}
                  disabled={!book}
                >
                  <option value="">— выберите —</option>
                  {book?.chapters.map((ch) => (
                      <option key={ch.slug} value={ch.slug}>
                        {ch.order}. {ch.title}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Страницы с">
                <TextInput
                  type="number"
                  value={form.pagesFrom}
                  onChange={(e) => form.setPagesFrom(e.target.value)}
                />
              </Field>
              <Field label="по">
                <TextInput
                  type="number"
                  value={form.pagesTo}
                  onChange={(e) => form.setPagesTo(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Доска для совместной работы — ссылка"
              hint="Miro, Excalidraw и т.п.; либо загрузите файл ниже"
            >
              <TextInput
                value={form.boardUrl}
                onChange={(e) => form.setBoardUrl(e.target.value)}
                placeholder="https://miro.com/…"
              />
            </Field>
            <ImagePicker
              label="…или доска файлом"
              hint="скриншот доски — сконвертируется в WebP и заменит ссылку выше"
              opts={BOARD_OPTS}
              onChange={form.setBoardFile}
            />
            <Field label="Модераторы обсуждения" hint="из числа спикеров — кто ведёт встречу">
              <ModeratorPicker
                speakers={index?.speakers ?? []}
                selected={form.moderatorIds}
                onChange={form.setModeratorIds}
              />
            </Field>
          </div>
        </Card>
      )}

      {kind === 'live-talk' && (
        <>
          <Card>
            <CardTitle hint="Регистрация на встречу и заявки спикеров идут через бота — отдельная ссылка не нужна">
              Программа эфира
            </CardTitle>
            <p className="mb-4 text-xs text-ink-soft">
              Глав может быть несколько — и даже из разных книг. Внутри блока
              отметьте темы, если главу делят между эфирами; пусто — вся глава.
            </p>
            <ProgramEditor index={index} blocks={form.blocks} onChange={form.setBlocks} />
          </Card>
          {liveTalkExtra}
        </>
      )}

      {/* Афиши — последним блоком: это уже не про содержание встречи,
          а про то, как она уйдёт в группу. */}
      <Card>
        <CardTitle hint="Бот подготовит анонс, афишу дня и напоминание. Публикуете вы — в разделе «Посты», сами выбирая время и группы">
          Посты о встрече
        </CardTitle>
        <div className="space-y-4">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={form.announce}
              onChange={(e) => form.setAnnounce(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-ink"
            />
            <span className="text-[13px] text-ink">
              Подготовить посты о встрече
              <span className="block text-xs text-ink-faint">
                тексты появятся в разделе «Посты»; группы подключаются командой /anons_here
              </span>
            </span>
          </label>
          <PosterPicker
            label="Афиша анонса"
            hint="JPEG или PNG до 10 МБ; без афиши пост уйдёт текстом"
            onChange={(p) => form.setPosterAnnounce(p?.bytes ?? null)}
          />
          <PosterPicker
            label="Афиша в день встречи"
            hint="можно загрузить позже правкой встречи — пост ждёт публикации"
            onChange={(p) => form.setPosterDay(p?.bytes ?? null)}
          />
        </div>
      </Card>
    </>
  )
}
