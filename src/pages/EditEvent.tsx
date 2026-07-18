import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ImagePicker } from '../components/ImagePicker'
import { ModeratorPicker } from '../components/ModeratorPicker'
import { PublishPanel } from '../components/PublishPanel'
import { TalkProgram, type TalkAssignment, type TalkRow } from '../components/TalkProgram'
import { Card, ErrorBox, Field, Select, TextArea, TextInput } from '../components/ui'
import { getToken } from '../lib/auth'
import { useChapterTopics, useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { BOARD_OPTS } from '../lib/image'
import { materialsToText, parseMaterials } from '../lib/materials'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadBookMeta, loadChapter, RAW_BASE } from '../lib/repo'
import { slugify } from '../lib/slug'
import { dispatchNewTalk, slidesUrl } from '../lib/talksApi'
import type { ClosedChapterEvent, ClubEvent, EventModerator, LiveTalkEvent } from '../types'

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
  const [boardFile, setBoardFile] = useState<Uint8Array | null>(null)
  const [moderatorIds, setModeratorIds] = useState<string[]>([])

  // live-talk
  const [youtube, setYoutube] = useState('')
  const [vk, setVk] = useState('')
  const [stream, setStream] = useState('')
  // Назначения спикеров темам главы (ключ — id темы или `off:<название>`).
  const [assign, setAssign] = useState<Record<string, TalkAssignment>>({})
  // Устаревшие доклады, чьих тем нет в текущей главе, — чтобы не потерять их.
  const [offRows, setOffRows] = useState<TalkRow[]>([])

  // общее: завершённость встречи (уводит в архив в miniapp)
  const [finished, setFinished] = useState(false)

  // генерация презентации доклада (repository_dispatch в talks)
  const [genId, setGenId] = useState<string | null>(null)
  const [genMsg, setGenMsg] = useState<string | null>(null)

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
    setFinished(ev.finished ?? false)
    if (ev.type === 'closed-chapter') {
      setFolder(index.books.find((b) => b.id === ev.book_id)?.folder ?? '')
      setChapterSlug(ev.chapter)
      setPagesFrom(ev.pages ? String(ev.pages.from) : '')
      setPagesTo(ev.pages ? String(ev.pages.to) : '')
      setBoardUrl(ev.notes_board_url ?? '')
      setModeratorIds((ev.moderators ?? []).map((m) => m.speaker_id))
    } else {
      setFolder(
        ev.book_id
          ? (index.books.find((b) => b.id === ev.book_id)?.folder ?? '')
          : '',
      )
      setChapterSlug(ev.chapter ?? '')
      setStream(ev.stream ? String(ev.stream) : '')
    }
  }, [event.data, index])

  const book = index?.books.find((b) => b.folder === folder)

  // Темы выбранной главы — слоты докладов.
  const { topics, loading: topicsLoading } = useChapterTopics(
    gh,
    folder,
    chapterSlug,
    kind === 'live-talk',
  )

  // Раскладываем сохранённые доклады по темам главы: совпадение по topic_id или
  // названию. Доклады без темы в главе — в offRows (сохраняем как «вне плана»).
  useEffect(() => {
    const ev = event.data
    if (!ev || ev.type !== 'live-talk' || topics === null) return
    const nextAssign: Record<string, TalkAssignment> = {}
    const offs: TalkRow[] = []
    for (const t of ev.talks) {
      const topic = topics.find((x) => x.id === t.topic_id || x.title === t.title)
      const id = topic ? topic.id : `off:${t.title}`
      if (!topic) offs.push({ id, title: t.title, offPlan: true })
      nextAssign[id] = { speakerId: t.speaker_id, slidesUrl: t.slides_url ?? '' }
    }
    setAssign(nextAssign)
    setOffRows(offs)
  }, [event.data, topics])

  // Строки программы: темы главы + устаревшие доклады вне плана.
  const rows: TalkRow[] = [
    ...(topics ?? []).map((t) => ({ id: t.id, title: t.title })),
    ...offRows,
  ]
  const program = rows.filter((r) => assign[r.id]?.speakerId)

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
        // Meet — только у открытых обсуждений; доклады — чистовая запись.
        ...(kind === 'closed-chapter' && callUrl.trim() ? { call_url: callUrl.trim() } : {}),
        ...(materials.length > 0 ? { materials } : {}),
        ...(finished ? { finished: true } : {}),
      }

      const extraFiles: FileChange[] = []

      let next: ClosedChapterEvent | LiveTalkEvent
      if (kind === 'closed-chapter') {
        // Доска — ссылка или загруженный файл (media/boards).
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
          ...(boardHref ? { notes_board_url: boardHref } : {}),
          ...(Object.keys(streams).length > 0 ? { streams } : {}),
          ...(moderators.length > 0 ? { moderators } : {}),
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
          talks: program.map((r) => {
            const a = assign[r.id]
            const speaker = index.speakers.find((s) => s.id === a.speakerId)!
            const topic = topics?.find((t) => t.id === r.id)
            return {
              title: r.title,
              speaker: speaker.name,
              speaker_id: speaker.id,
              avatar: speaker.avatar,
              ...(topic ? { topic_id: topic.id } : {}),
              ...(a.slidesUrl.trim() ? { slides_url: a.slidesUrl.trim() } : {}),
            }
          }),
          ...(book ? { book_id: book.id } : {}),
          ...(chapterSlug ? { chapter: chapterSlug } : {}),
          ...(Number(stream) > 0 ? { stream: Number(stream) } : {}),
          ...common,
        }
      }

      const files: FileChange[] = [
        { path: newPath, content: toJSON(next) },
        ...extraFiles,
      ]
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

  // Генерация презентации доклада: считает URL, подставляет и запускает PR в talks.
  async function generateTalk(rowId: string) {
    const a = assign[rowId]
    const topic = topics?.find((t) => t.id === rowId)
    setGenMsg(null)
    if (!book) return setGenMsg('Сначала выберите книгу')
    if (!chapterSlug) return setGenMsg('Выберите главу')
    if (!topic) return setGenMsg('Презентацию можно сгенерировать только для темы из плана главы')
    if (!a?.speakerId) return setGenMsg('Назначьте спикера теме')
    if (!(Number(stream) > 0)) return setGenMsg('Укажите номер стрима')

    setGenId(rowId)
    try {
      const meta = await loadBookMeta(gh, book.folder)
      if (!meta?.code) throw new Error('У книги нет кода (задайте в форме книги: DOCKER, REACT…)')
      const chapter = await loadChapter(gh, book.folder, chapterSlug)
      if (!chapter) throw new Error('Глава не найдена в book-club-data')

      const url = slidesUrl({
        stream: Number(stream),
        code: meta.code,
        chapterOrder: chapter.order,
        speakerId: a.speakerId,
      })
      setAssign((prev) => ({ ...prev, [rowId]: { ...prev[rowId], slidesUrl: url } }))

      await dispatchNewTalk(getToken() ?? '', {
        book: book.folder,
        chapter: chapterSlug,
        topic: topic.title,
        speaker: a.speakerId,
        stream: Number(stream),
      })
      setGenMsg(`✓ Запущена генерация. PR появится в book-club-talks, слайды: ${url}. Сохраните встречу, чтобы ссылка попала в приложение.`)
    } catch (e) {
      setGenMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setGenId(null)
    }
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
        {kind === 'closed-chapter' ? 'открытое обсуждение' : 'доклады'}. Смена даты
        или названия перенесёт файл автоматически.
      </p>

      <Card>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={finished}
            onChange={(e) => setFinished(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <span className="block text-sm font-medium">Встреча завершена</span>
            <span className="block text-xs text-muted">
              Уводит встречу в архив приложения. Добавьте записи (YouTube/VK)
              {kind === 'closed-chapter' ? ' и доску' : ''} ниже.
            </span>
          </span>
        </label>
      </Card>

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
            <Field label="Доска для совместной работы — ссылка" hint="Miro, Excalidraw и т.п.; либо загрузите файл ниже">
              <TextInput value={boardUrl} onChange={(e) => setBoardUrl(e.target.value)} />
            </Field>
            <ImagePicker
              label="…или доска файлом"
              hint="скриншот доски — заменит ссылку выше"
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
                Регистрация и заявки спикеров идут через бота — отдельная ссылка не нужна.
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
                    {book?.chapters.map((s) => (
                      <option key={s} value={s}>
                        {s}
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
              Назначь спикера теме — «Создать презентацию» соберёт доклад из
              book-club-data и откроет PR в book-club-talks; ссылка на слайды подставится
              рядом (сохрани встречу, чтобы она попала в приложение).
            </p>
            <TalkProgram
              chapterSelected={Boolean(book && chapterSlug)}
              loading={topicsLoading}
              rows={rows}
              speakers={index?.speakers ?? []}
              assignments={assign}
              onSpeaker={(id, speakerId) =>
                setAssign((p) => ({
                  ...p,
                  [id]: { ...(p[id] ?? { speakerId: '', slidesUrl: '' }), speakerId },
                }))
              }
              onSlides={(id, url) =>
                setAssign((p) => ({
                  ...p,
                  [id]: { ...(p[id] ?? { speakerId: '', slidesUrl: '' }), slidesUrl: url },
                }))
              }
              generate={{ run: generateTalk, busyId: genId, message: genMsg }}
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
        submitLabel="Создать pull request с правками"
      />
    </div>
  )
}
