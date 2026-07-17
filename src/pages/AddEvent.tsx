import { useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { Button, Card, Field, Select, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { parseMaterials } from '../lib/materials'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { slugify } from '../lib/slug'
import type { ClosedChapterEvent, LiveTalkEvent } from '../types'

type EventKind = 'closed-chapter' | 'live-talk'

interface TalkDraft {
  title: string
  speakerId: string
}

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

  // live-talk
  const [youtube, setYoutube] = useState('')
  const [vk, setVk] = useState('')
  const [regUrl, setRegUrl] = useState('')
  const [talks, setTalks] = useState<TalkDraft[]>([{ title: '', speakerId: '' }])

  const book = index?.books.find((b) => b.folder === folder)
  const slug = slugify(title)

  const readyCommon = Boolean(title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && time)
  const filledTalks = talks.filter((t) => t.title.trim() && t.speakerId)
  // Эфир можно создать и без докладов: спикеры запишутся через бота,
  // админ добавит подтверждённые доклады позже через редактирование.
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
      const common = {
        ...(callUrl.trim() ? { call_url: callUrl.trim() } : {}),
        ...(materials.length > 0 ? { materials } : {}),
      }

      let event: ClosedChapterEvent | LiveTalkEvent
      if (kind === 'closed-chapter') {
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
          ...(boardUrl.trim() ? { notes_board_url: boardUrl.trim() } : {}),
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
          streams: {
            ...(youtube.trim() ? { youtube: youtube.trim() } : {}),
            ...(vk.trim() ? { vk: vk.trim() } : {}),
          },
          talks: filledTalks.map((t) => {
            const speaker = index.speakers.find((s) => s.id === t.speakerId)!
            return {
              title: t.title.trim(),
              speaker: speaker.name,
              speaker_id: speaker.id,
              avatar: speaker.avatar,
            }
          }),
          ...(regUrl.trim() ? { registration_url: regUrl.trim() } : {}),
          // Программа эфира: из этой главы бот предлагает темы спикерам.
          ...(book ? { book_id: book.id } : {}),
          ...(chapterSlug ? { chapter: chapterSlug } : {}),
          ...common,
        }
      }

      const nextIndex = structuredClone(index)
      nextIndex.events = [...nextIndex.events, `${fileDir}/${date}-${slug}.json`].sort()

      const files: FileChange[] = [
        { path: filePath, content: toJSON(event) },
        { path: 'index.json', content: toJSON(nextIndex) },
      ]

      return openContentPR(gh, {
        branch: `cms/event-${date}-${slug}`,
        title: `feat(events): ${title.trim()} (${date})`,
        body: [
          kind === 'closed-chapter'
            ? `Закрытая встреча: разбор главы \`${chapterSlug}\` книги **${book!.title}**.`
            : `Открытый эфир, докладов: ${filledTalks.length}.`,
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
              <option value="closed-chapter">Закрытая — разбор главы</option>
              <option value="live-talk">Открытый эфир с докладами</option>
            </Select>
          </Field>
          <Field label="Название">
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === 'closed-chapter'
                  ? 'Разбор главы 2 «Образы Docker»'
                  : 'Открытый эфир: Docker на практике'
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
          <Field label="Ссылка на созвон" hint="Zoom / Meet / телеграм-эфир — бот выдаст её записавшимся">
            <TextInput value={callUrl} onChange={(e) => setCallUrl(e.target.value)} placeholder="https://…" />
          </Field>
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
            <Field label="Доска заметок (Miro и т.п.)">
              <TextInput
                value={boardUrl}
                onChange={(e) => setBoardUrl(e.target.value)}
                placeholder="https://miro.com/…"
              />
            </Field>
          </div>
        </Card>
      )}

      {kind === 'live-talk' && (
        <>
          <Card>
            <div className="space-y-4">
              <p className="text-sm font-medium">Программа эфира</p>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Трансляция YouTube">
                  <TextInput value={youtube} onChange={(e) => setYoutube(e.target.value)} />
                </Field>
                <Field label="Трансляция VK">
                  <TextInput value={vk} onChange={(e) => setVk(e.target.value)} />
                </Field>
              </div>
              <Field label="Ссылка на регистрацию">
                <TextInput value={regUrl} onChange={(e) => setRegUrl(e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card>
            <p className="mb-4 text-sm font-medium">Доклады</p>
            <div className="space-y-4">
              {talks.map((talk, i) => (
                <div key={i} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_14rem_auto]">
                  <Field label="Тема доклада">
                    <TextInput
                      value={talk.title}
                      onChange={(e) =>
                        setTalks(talks.map((t, j) => (j === i ? { ...t, title: e.target.value } : t)))
                      }
                    />
                  </Field>
                  <Field label="Спикер">
                    <Select
                      value={talk.speakerId}
                      onChange={(e) =>
                        setTalks(talks.map((t, j) => (j === i ? { ...t, speakerId: e.target.value } : t)))
                      }
                    >
                      <option value="">— выберите —</option>
                      {index?.speakers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex items-end">
                    {talks.length > 1 && (
                      <Button variant="danger" onClick={() => setTalks(talks.filter((_, j) => j !== i))}>
                        ✕
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="ghost" onClick={() => setTalks([...talks, { title: '', speakerId: '' }])}>
                + Ещё доклад
              </Button>
            </div>
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
