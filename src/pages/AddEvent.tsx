import { useState } from 'react'
import { ImagePicker } from '../components/ImagePicker'
import { ModeratorPicker } from '../components/ModeratorPicker'
import { PublishPanel } from '../components/PublishPanel'
import { TalkProgram, type TalkAssignment } from '../components/TalkProgram'
import { Card, Field, Select, TextArea, TextInput } from '../components/ui'
import { useChapterTopics, useDataClient, useIndex, usePublish } from '../lib/hooks'
import { BOARD_OPTS } from '../lib/image'
import { parseMaterials } from '../lib/materials'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { RAW_BASE } from '../lib/repo'
import { slugify } from '../lib/slug'
import type { ClosedChapterEvent, EventModerator, LiveTalkEvent } from '../types'

type EventKind = 'closed-chapter' | 'live-talk'

export function AddEvent() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [kind, setKind] = useState<EventKind>('closed-chapter')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [callUrl, setCallUrl] = useState('')
  const [materialsText, setMaterialsText] = useState('')

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
  // Назначения спикеров темам главы (ключ — id темы).
  const [assign, setAssign] = useState<Record<string, TalkAssignment>>({})

  const book = index?.books.find((b) => b.folder === folder)
  const slug = slugify(title)

  // Темы выбранной главы — слоты докладов эфира.
  const { topics, loading: topicsLoading } = useChapterTopics(
    gh,
    folder,
    chapterSlug,
    kind === 'live-talk',
  )
  // Доклады эфира — темы главы, которым назначен спикер.
  const program = (topics ?? []).filter((t) => assign[t.id]?.speakerId)

  const readyCommon = Boolean(title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && time)
  // Эфир можно создать и без докладов: спикеры запишутся через бота,
  // админ назначит подтверждённые темы позже через редактирование.
  const ready =
    readyCommon && (kind === 'closed-chapter' ? Boolean(book && chapterSlug) : true)

  function submit() {
    if (!index) return
    publish(async () => {
      const prefix = kind === 'closed-chapter' ? 'closed' : 'live'
      const id = `${prefix}-${date}-${slug}`
      const fileDir = kind === 'closed-chapter' ? 'closed-chapters' : 'live-talks'
      const filePath = `events/${fileDir}/${date}-${slug}.json`

      const materials = parseMaterials(materialsText)
      const streams = {
        ...(youtube.trim() ? { youtube: youtube.trim() } : {}),
        ...(vk.trim() ? { vk: vk.trim() } : {}),
      }
      const common = {
        // Meet — только у открытых обсуждений; доклады — чистовая запись.
        ...(kind === 'closed-chapter' && callUrl.trim() ? { call_url: callUrl.trim() } : {}),
        ...(materials.length > 0 ? { materials } : {}),
      }

      const extraFiles: FileChange[] = []

      let event: ClosedChapterEvent | LiveTalkEvent
      if (kind === 'closed-chapter') {
        // Доска — либо ссылка, либо загруженный файл (кладём в media/boards).
        let boardHref = boardUrl.trim()
        if (boardFile) {
          const boardPath = `media/boards/${date}-${slug}.webp`
          extraFiles.push({ path: boardPath, content: boardFile })
          boardHref = `${RAW_BASE}/${boardPath}`
        }
        const moderators: EventModerator[] = moderatorIds
          .map((mid) => index.speakers.find((s) => s.id === mid))
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
          .map((s) => ({ speaker_id: s.id, name: s.name, avatar: s.avatar }))
        event = {
          id,
          type: 'closed-chapter',
          title: title.trim(),
          date,
          time,
          timezone: 'Europe/Moscow',
          book_id: book!.id,
          chapter: chapterSlug,
          ...(Number(pagesFrom) > 0 && Number(pagesTo) > 0
            ? { pages: { from: Number(pagesFrom), to: Number(pagesTo) } }
            : {}),
          ...(boardHref ? { notes_board_url: boardHref } : {}),
          ...(Object.keys(streams).length > 0 ? { streams } : {}),
          ...(moderators.length > 0 ? { moderators } : {}),
          ...common,
        }
      } else {
        event = {
          id,
          type: 'live-talk',
          title: title.trim(),
          date,
          time,
          timezone: 'Europe/Moscow',
          streams,
          talks: program.map((topic) => {
            const speaker = index.speakers.find((s) => s.id === assign[topic.id].speakerId)!
            return {
              title: topic.title,
              speaker: speaker.name,
              speaker_id: speaker.id,
              avatar: speaker.avatar,
              topic_id: topic.id,
            }
          }),
          // Программа докладов: из этой главы бот предлагает темы спикерам.
          ...(book ? { book_id: book.id } : {}),
          ...(chapterSlug ? { chapter: chapterSlug } : {}),
          ...(Number(stream) > 0 ? { stream: Number(stream) } : {}),
          ...common,
        }
      }

      const nextIndex = structuredClone(index)
      nextIndex.events = [...nextIndex.events, `${fileDir}/${date}-${slug}.json`].sort()

      const files: FileChange[] = [
        { path: filePath, content: toJSON(event) },
        ...extraFiles,
        { path: 'index.json', content: toJSON(nextIndex) },
      ]

      return openContentPR(gh, {
        branch: `cms/event-${date}-${slug}`,
        title: `feat(events): ${title.trim()} (${date})`,
        body: [
          kind === 'closed-chapter'
            ? `Открытое обсуждение: разбор главы \`${chapterSlug}\` книги **${book!.title}**.`
            : `Доклады: ${program.length} из ${topics?.length ?? 0} тем главы.`,
          '',
          `- \`${filePath}\``,
          '- обновлён `index.json`',
          '',
          '_Создано через CMS Книжного клуба._',
        ].join('\n'),
        files,
      })
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <Field label="Тип встречи">
            <Select value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
              <option value="closed-chapter">Открытое обсуждение — разбор главы</option>
              <option value="live-talk">Доклады — записи докладов</option>
            </Select>
          </Field>
          <Field label="Название">
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === 'closed-chapter'
                  ? 'Обсуждение главы 2 «Образы Docker»'
                  : 'Доклады: Docker на практике'
              }
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Дата">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Время (МСК)">
              <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Трансляция YouTube">
              <TextInput value={youtube} onChange={(e) => setYoutube(e.target.value)} />
            </Field>
            <Field label="Трансляция VK">
              <TextInput value={vk} onChange={(e) => setVk(e.target.value)} />
            </Field>
          </div>
          {kind === 'closed-chapter' && (
            <Field
              label="Google Meet (подключиться к обсуждению)"
              hint="бот выдаст ссылку записавшимся; у докладов созвона нет — это чистовая запись"
            >
              <TextInput value={callUrl} onChange={(e) => setCallUrl(e.target.value)} placeholder="https://meet.google.com/…" />
            </Field>
          )}
          <Field label="Доп. материалы" hint="по одному на строку: «название | ссылка»">
            <TextArea rows={2} value={materialsText} onChange={(e) => setMaterialsText(e.target.value)} />
          </Field>
        </div>
      </Card>

      {kind === 'closed-chapter' && (
        <Card>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Книга">
                <Select
                  value={folder}
                  onChange={(e) => {
                    setFolder(e.target.value)
                    setChapterSlug('')
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
                  value={chapterSlug}
                  onChange={(e) => setChapterSlug(e.target.value)}
                  disabled={!book}
                >
                  <option value="">— выберите —</option>
                  {book?.chapters.map((slug) => (
                    <option key={slug} value={slug}>
                      {slug}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Страницы с">
                <TextInput
                  type="number"
                  value={pagesFrom}
                  onChange={(e) => setPagesFrom(e.target.value)}
                />
              </Field>
              <Field label="по">
                <TextInput
                  type="number"
                  value={pagesTo}
                  onChange={(e) => setPagesTo(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Доска для совместной работы — ссылка" hint="Miro, Excalidraw и т.п.; либо загрузите файл ниже">
              <TextInput
                value={boardUrl}
                onChange={(e) => setBoardUrl(e.target.value)}
                placeholder="https://miro.com/…"
              />
            </Field>
            <ImagePicker
              label="…или доска файлом"
              hint="скриншот доски — сконвертируется в WebP"
              opts={BOARD_OPTS}
              onChange={setBoardFile}
            />
            <Field label="Модераторы обсуждения" hint="из числа спикеров — кто ведёт встречу">
              <ModeratorPicker
                speakers={index?.speakers ?? []}
                selected={moderatorIds}
                onChange={setModeratorIds}
              />
            </Field>
          </div>
        </Card>
      )}

      {kind === 'live-talk' && (
        <>
          <Card>
            <div className="space-y-4">
              <p className="text-sm font-medium">Программа докладов</p>
              <p className="text-xs text-muted">
                Регистрация на встречу и заявки спикеров идут через бота — отдельная
                ссылка не нужна.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Книга" hint="из глав этой книги бот предложит темы спикерам">
                  <Select
                    value={folder}
                    onChange={(e) => {
                      setFolder(e.target.value)
                      setChapterSlug('')
                    }}
                  >
                    <option value="">— не привязывать —</option>
                    {index?.books.map((b) => (
                      <option key={b.folder} value={b.folder}>
                        {b.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Глава">
                  <Select
                    value={chapterSlug}
                    onChange={(e) => setChapterSlug(e.target.value)}
                    disabled={!book}
                  >
                    <option value="">— выберите —</option>
                    {book?.chapters.map((slug) => (
                      <option key={slug} value={slug}>
                        {slug}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Номер стрима" hint="в имени папки доклада: BC-<стрим>-… (например 112)">
                <TextInput
                  type="number"
                  min={1}
                  value={stream}
                  onChange={(e) => setStream(e.target.value)}
                  placeholder="112"
                />
              </Field>
            </div>
          </Card>
          <Card>
            <p className="mb-1 text-sm font-medium">Темы главы</p>
            <p className="mb-4 text-xs text-muted">
              Все темы выбранной главы — слоты докладов. Обычно спикеры записываются
              через бота; при желании можно назначить спикера теме сразу.
            </p>
            <TalkProgram
              chapterSelected={Boolean(book && chapterSlug)}
              loading={topicsLoading}
              rows={(topics ?? []).map((t) => ({ id: t.id, title: t.title }))}
              speakers={index?.speakers ?? []}
              assignments={assign}
              onSpeaker={(id, speakerId) =>
                setAssign((p) => ({
                  ...p,
                  [id]: { ...(p[id] ?? { speakerId: '', slidesUrl: '' }), speakerId },
                }))
              }
            />
          </Card>
        </>
      )}

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Заполните название, дату и обязательные поля типа встречи"
      />
    </div>
  )
}
