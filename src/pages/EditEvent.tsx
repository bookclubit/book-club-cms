import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublishPanel } from '../components/PublishPanel'
import { Button, Card, ErrorBox, Field, Select, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { materialsToText, parseMaterials } from '../lib/materials'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { slugify } from '../lib/slug'
import type { ClosedChapterEvent, ClubEvent, LiveTalkEvent } from '../types'

interface TalkDraft {
  title: string
  speakerId: string
}

// Редактирование встречи. Имя файла содержит дату и slug названия, поэтому
// при их смене файл переносится (старый удаляется, новый создаётся) одним PR
// вместе с обновлением index.json.
export function EditEvent() {
  const { dir = '', file = '' } = useParams()
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const kind = dir === 'closed-chapters' ? 'closed-chapter' : 'live-talk'
  const event = useLoad(
    () => gh.getFileJson<ClubEvent>(`events/${dir}/${file}`),
    [gh, dir, file],
  )

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
  const [talks, setTalks] = useState<TalkDraft[]>([])

  useEffect(() => {
    const ev = event.data
    if (!ev || !index) return
    setTitle(ev.title)
    setDate(ev.date)
    setTime(ev.time)
    setCallUrl(ev.call_url ?? '')
    setMaterialsText(materialsToText(ev.materials))
    setYoutube(ev.streams?.youtube ?? '')
    setVk(ev.streams?.vk ?? '')
    if (ev.type === 'closed-chapter') {
      setFolder(index.books.find((b) => b.id === ev.book_id)?.folder ?? '')
      setChapterSlug(ev.chapter)
      setPagesFrom(ev.pages ? String(ev.pages.from) : '')
      setPagesTo(ev.pages ? String(ev.pages.to) : '')
      setBoardUrl(ev.notes_board_url ?? '')
    } else {
      setFolder(
        ev.book_id
          ? (index.books.find((b) => b.id === ev.book_id)?.folder ?? '')
          : '',
      )
      setChapterSlug(ev.chapter ?? '')
      setRegUrl(ev.registration_url ?? '')
      setTalks(ev.talks.map((t) => ({ title: t.title, speakerId: t.speaker_id })))
    }
  }, [event.data, index])

  const book = index?.books.find((b) => b.folder === folder)
  const filledTalks = talks.filter((t) => t.title.trim() && t.speakerId)

  const readyCommon = Boolean(title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && time)
  // Эфир может быть и без докладов — спикеры записываются через бота.
  const ready =
    Boolean(event.data && index) &&
    readyCommon &&
    (kind === 'closed-chapter' ? Boolean(book && chapterSlug) : true)

  function submit() {
    if (!index || !event.data) return
    publish(async () => {
      const prefix = kind === 'closed-chapter' ? 'closed' : 'live'
      const slug = slugify(title)
      const newFile = `${date}-${slug}.json`
      const oldPath = `events/${dir}/${file}`
      const newPath = `events/${dir}/${newFile}`
      const id = `${prefix}-${date}-${slug}`

      const materials = parseMaterials(materialsText)
      const streams = {
        ...(youtube.trim() ? { youtube: youtube.trim() } : {}),
        ...(vk.trim() ? { vk: vk.trim() } : {}),
      }
      const common = {
        // Meet — только у открытых обсуждений; выступления — чистовая запись.
        ...(kind === 'closed-chapter' && callUrl.trim() ? { call_url: callUrl.trim() } : {}),
        ...(materials.length > 0 ? { materials } : {}),
      }

      let next: ClosedChapterEvent | LiveTalkEvent
      if (kind === 'closed-chapter') {
        next = {
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
          ...(Object.keys(streams).length > 0 ? { streams } : {}),
          ...common,
        }
      } else {
        next = {
          id,
          type: 'live-talk',
          title: title.trim(),
          date,
          time,
          timezone: 'Europe/Moscow',
          streams,
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
          ...(book ? { book_id: book.id } : {}),
          ...(chapterSlug ? { chapter: chapterSlug } : {}),
          ...common,
        }
      }

      const files: FileChange[] = [{ path: newPath, content: toJSON(next) }]
      const renamed = newPath !== oldPath
      if (renamed) files.push({ path: oldPath, content: null })

      if (renamed) {
        const nextIndex = structuredClone(index)
        nextIndex.events = nextIndex.events
          .filter((e) => e !== `${dir}/${file}`)
          .concat(`${dir}/${newFile}`)
          .sort()
        files.push({ path: 'index.json', content: toJSON(nextIndex) })
      }

      return openContentPR(gh, {
        branch: `cms/edit-event-${date}-${slug}`,
        title: `fix(events): обновить встречу «${title.trim()}» (${date})`,
        body: [
          `Правки встречи **${title.trim()}**.`,
          '',
          `- \`${newPath}\``,
          renamed ? `- файл перенесён (был \`${oldPath}\`), обновлён \`index.json\`` : null,
          '',
          '_Обновлено через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files,
      })
    })
  }

  if (event.loading) return <p className="text-sm text-muted">Загружаем встречу…</p>
  if (event.error) return <ErrorBox>{event.error}</ErrorBox>
  if (!event.data) {
    return (
      <ErrorBox>
        Встреча <code>{file}</code> не найдена.{' '}
        <Link to="/events" className="underline">К списку</Link>
      </ErrorBox>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Редактирование <code>events/{dir}/{file}</code> · тип:{' '}
        {kind === 'closed-chapter' ? 'открытое обсуждение' : 'выступления'}. Смена даты
        или названия перенесёт файл автоматически.
      </p>

      <Card>
        <div className="space-y-4">
          <Field label="Название">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
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
              hint="бот выдаст ссылку записавшимся; у выступлений созвона нет — это чистовая запись"
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
                  {book?.chapters.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Страницы с">
                <TextInput type="number" value={pagesFrom} onChange={(e) => setPagesFrom(e.target.value)} />
              </Field>
              <Field label="по">
                <TextInput type="number" value={pagesTo} onChange={(e) => setPagesTo(e.target.value)} />
              </Field>
            </div>
            <Field label="Доска заметок (Miro и т.п.)">
              <TextInput value={boardUrl} onChange={(e) => setBoardUrl(e.target.value)} />
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
                    {book?.chapters.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
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
        submitLabel="Создать pull request с правками"
      />
    </div>
  )
}
