import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  buildEventFiles,
  EventFormFields,
  isEventFormReady,
  useEventFormState,
} from '../components/EventForm'
import { EventTopicClaims } from '../components/EventTopicClaims'
import { PublishPanel } from '../components/PublishPanel'
import { Card, ErrorBox, Field, Mono, PageHeader, SuccessBox, TextInput } from '../components/ui'
import { getToken } from '../lib/auth'
import {
  announceEvent,
  announcePayload,
  assignClaim,
  getBotToken,
  listSpeakerClaims,
  releaseClaim,
  setClaimSlides,
  type SpeakerClaim,
} from '../lib/botApi'
import { useChapterTopics, useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { materialsToText } from '../lib/materials'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadBookMeta, loadChapter } from '../lib/repo'
import { slugify } from '../lib/slug'
import {
  acceptTalkForSlides,
  dispatchNewTalk,
  fetchAcceptedSlides,
  slidesUrl,
} from '../lib/talksApi'
import type { ClubEvent } from '../types'

// Редактирование встречи. Имя файла содержит дату и slug названия, поэтому
// при их смене файл переносится (старый удаляется, новый создаётся) одним PR;
// index.json пересоберётся автоматически после мержа.
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

  const form = useEventFormState()

  // Занятость тем — единый источник в D1 (заявки бота). Грузим и меняем их же.
  const [claims, setClaims] = useState<SpeakerClaim[]>([])
  const [claimsMsg, setClaimsMsg] = useState<string | null>(null)
  const [busyTopic, setBusyTopic] = useState<string | null>(null)
  // Итог обновления постов бота (PR уже создан, поэтому это заметка, не ошибка).
  const [announceNote, setAnnounceNote] = useState<{ ok: boolean; text: string } | null>(null)

  // генерация презентации доклада (repository_dispatch в talks)
  const [genId, setGenId] = useState<string | null>(null)
  const [genMsg, setGenMsg] = useState<string | null>(null)
  const [acceptId, setAcceptId] = useState<string | null>(null)
  // Принятые презентации (slides_url, чьи PR смержены в talks) — для статуса
  // «принята» вместо кнопки. Дополняется локально сразу после мержа,
  // т.к. raw-проверка отстаёт на кэш (~5 минут).
  const [acceptedSlides, setAcceptedSlides] = useState<Set<string>>(new Set())

  useEffect(() => {
    const ev = event.data
    if (!ev || !index) return
    form.setTitle(ev.title)
    form.setDate(ev.date)
    form.setTime(ev.time)
    form.setCallUrl(ev.call_url ?? '')
    form.setMaterialsText(materialsToText(ev.materials))
    form.setYoutube(ev.streams?.youtube ?? '')
    form.setVk(ev.streams?.vk ?? '')
    form.setStream(ev.stream ? String(ev.stream) : '')
    form.setFinished(ev.finished ?? false)
    if (ev.type === 'closed-chapter') {
      form.setFolder(index.books.find((b) => b.id === ev.book_id)?.folder ?? '')
      form.setChapterSlug(ev.chapter)
      form.setPagesFrom(ev.pages ? String(ev.pages.from) : '')
      form.setPagesTo(ev.pages ? String(ev.pages.to) : '')
      form.setBoardUrl(ev.notes_board_url ?? '')
      form.setModeratorIds((ev.moderators ?? []).map((m) => m.speaker_id))
    } else {
      form.setFolder(
        ev.book_id
          ? (index.books.find((b) => b.id === ev.book_id)?.folder ?? '')
          : '',
      )
      form.setChapterSlug(ev.chapter ?? '')
      form.setTopicIds(ev.topic_ids ?? [])
      form.setRecordings(ev.recordings ?? {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.data, index])

  const book = index?.books.find((b) => b.folder === form.folder)

  // Темы выбранной главы — слоты докладов.
  const { topics, loading: topicsLoading } = useChapterTopics(
    gh,
    form.folder,
    form.chapterSlug,
    kind === 'live-talk',
  )

  // Заявки этой встречи из D1 (единый источник занятости) — по книге и главе.
  const loadClaims = useCallback(async () => {
    if (kind !== 'live-talk' || !book || !form.chapterSlug || !getBotToken()) return
    try {
      const all = await listSpeakerClaims()
      setClaims(all.filter((c) => c.book_id === book.id && c.chapter === form.chapterSlug))
    } catch (e) {
      setClaimsMsg(e instanceof Error ? e.message : String(e))
    }
  }, [kind, book, form.chapterSlug])

  useEffect(() => {
    void loadClaims()
  }, [loadClaims])

  const claimByTopic = new Map(claims.filter((c) => c.topic_id).map((c) => [c.topic_id!, c]))

  // Проверяем принятость презентаций по main репозитория talks.
  useEffect(() => {
    const urls = claims
      .map((c) => c.slides_url)
      .filter((u): u is string => Boolean(u))
    if (urls.length === 0) return
    let alive = true
    void fetchAcceptedSlides(urls).then((accepted) => {
      if (alive && accepted.size > 0) {
        setAcceptedSlides((prev) => new Set([...prev, ...accepted]))
      }
    })
    return () => {
      alive = false
    }
  }, [claims])

  // Темы этой встречи для монтажных ссылок: выбранные (topic_ids) или вся глава.
  const meetingTopics = (topics ?? []).filter(
    (t) => form.topicIds.length === 0 || form.topicIds.includes(t.id),
  )

  function setRecording(topicId: string, field: 'youtube' | 'vk', value: string) {
    form.setRecordings((prev) => ({
      ...prev,
      [topicId]: { ...prev[topicId], [field]: value },
    }))
  }

  const ready = Boolean(event.data && index) && isEventFormReady(kind, form, book)

  function submit() {
    if (!index || !event.data) return
    publish(async () => {
      const slug = slugify(form.title)
      const newFile = `${form.date}-${slug}.json`
      const oldPath = `events/${dir}/${file}`
      const newPath = `events/${dir}/${newFile}`

      const { event: next, extraFiles } = buildEventFiles({ kind, form, index, slug })

      const files: FileChange[] = [
        { path: newPath, content: toJSON(next) },
        ...extraFiles,
      ]
      const renamed = newPath !== oldPath
      if (renamed) files.push({ path: oldPath, content: null })

      const result = await openContentPR(gh, {
        branch: `cms/edit-event-${form.date}-${slug}`,
        title: `fix(events): обновить встречу «${form.title.trim()}» (${form.date})`,
        body: [
          `Правки встречи **${form.title.trim()}**.`,
          '',
          `- \`${newPath}\``,
          renamed ? `- файл перенесён (был \`${oldPath}\`)` : null,
          '',
          '`index.json` пересоберётся автоматически после мержа.',
          '',
          '_Обновлено через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files,
      })

      // Обновляем у бота снимок встречи и афишу дня: он берёт поля из формы,
      // потому что правки лежат в открытом PR. Анонс повторно не публикуется —
      // бот помнит, что он уже вышел.
      if (form.announce) {
        try {
          await announceEvent(announcePayload(next), {
            announce: form.posterAnnounce,
            day: form.posterDay,
          })
          setAnnounceNote({ ok: true, text: 'План постов о встрече обновлён.' })
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err)
          setAnnounceNote({ ok: false, text: `Не удалось обновить посты бота: ${reason}` })
        }
      }

      return result
    })
  }

  // Назначить спикера каталога на тему — создаёт заявку в D1 (единый источник).
  async function handleAssign(topicId: string, topicTitle: string, speakerId: string) {
    if (!book || !form.chapterSlug) return
    const speaker = index?.speakers.find((s) => s.id === speakerId)
    if (!speaker) return
    setClaimsMsg(null)
    setBusyTopic(topicId)
    try {
      await assignClaim({
        topicId,
        topicTitle,
        bookId: book.id,
        chapter: form.chapterSlug,
        speakerId: speaker.id,
        speakerName: speaker.name,
      })
      await loadClaims()
    } catch (e) {
      setClaimsMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyTopic(null)
    }
  }

  // Освободить тему — удаляет заявку D1.
  async function handleFree(topicId: string) {
    setClaimsMsg(null)
    setBusyTopic(topicId)
    try {
      await releaseClaim(topicId)
      await loadClaims()
    } catch (e) {
      setClaimsMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyTopic(null)
    }
  }

  // Генерация презентации: считает URL, запускает PR в talks и пишет ссылку в заявку.
  async function generateTalk(topicId: string) {
    const topic = topics?.find((t) => t.id === topicId)
    const claim = claimByTopic.get(topicId)
    setGenMsg(null)
    if (!book) return setGenMsg('Сначала выберите книгу')
    if (!form.chapterSlug) return setGenMsg('Выберите главу')
    if (!topic) return setGenMsg('Презентацию можно сгенерировать только для темы из плана главы')
    if (!claim?.speaker_id) return setGenMsg('У темы нет каталожного спикера')
    if (!(Number(form.stream) > 0)) return setGenMsg('Укажите номер стрима')

    setGenId(topicId)
    try {
      const meta = await loadBookMeta(gh, book.folder)
      if (!meta?.code) throw new Error('У книги нет кода (задайте в форме книги: DOCKER, REACT…)')
      const chapter = await loadChapter(gh, book.folder, form.chapterSlug)
      if (!chapter) throw new Error('Глава не найдена в book-club-data')

      const url = slidesUrl({
        stream: Number(form.stream),
        code: meta.code,
        chapterOrder: chapter.order,
        speakerId: claim.speaker_id,
      })
      await dispatchNewTalk(getToken() ?? '', {
        book: book.folder,
        chapter: form.chapterSlug,
        topic: topic.title,
        speaker: claim.speaker_id,
        stream: Number(form.stream),
      })
      await setClaimSlides(topicId, url)
      await loadClaims()
      setGenMsg(`Запущена генерация. PR появится в book-club-talks, слайды: ${url}`)
    } catch (e) {
      setGenMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setGenId(null)
    }
  }

  // Принять презентацию: мержит PR доклада в book-club-talks — слайды
  // публикуются на боевом URL, и ссылка появляется в анонсе встречи в miniapp.
  async function acceptTalk(topicId: string) {
    const claim = claimByTopic.get(topicId)
    setGenMsg(null)
    if (!claim?.slides_url) {
      return setGenMsg('У темы нет ссылки на слайды — сначала создайте презентацию')
    }
    setAcceptId(topicId)
    try {
      const prNumber = await acceptTalkForSlides(claim.slides_url, getToken() ?? '')
      setAcceptedSlides((prev) => new Set(prev).add(claim.slides_url!))
      setGenMsg(
        `PR #${prNumber} смержен — презентация принята. Слайды: ${claim.slides_url}, ` +
          'ссылка появится в анонсе встречи (кэш до ~5 минут).',
      )
    } catch (e) {
      setGenMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setAcceptId(null)
    }
  }

  if (event.loading) return <p className="text-sm text-ink-soft">Загружаем встречу…</p>
  if (event.error) return <ErrorBox>{event.error}</ErrorBox>
  if (!event.data) {
    return (
      <ErrorBox>
        Встреча <code>{file}</code> не найдена.{' '}
        <Link to="/events" className="underline">К списку</Link>
      </ErrorBox>
    )
  }

  // Edit-only блоки эфира: заявки D1 и монтажные ролики (после «Тем встречи»).
  const liveTalkExtra = (
    <>
      <Card>
        <p className="mb-1 text-sm font-medium">Темы главы</p>
        <p className="mb-4 text-xs text-ink-soft">
          Занятость тем — единый источник в боте (D1): «Освободить» удаляет заявку,
          назначение создаёт её. Изменения применяются сразу, без сохранения встречи.
          «Создать презентацию» доступна для каталожного спикера; «Принять
          презентацию» мержит PR доклада — после этого ссылка на слайды видна в
          анонсе встречи.
        </p>
        {!getBotToken() ? (
          <p className="text-sm text-ink-soft">
            Для управления темами нужен админ-токен бота (задайте на странице входа).
          </p>
        ) : (
          <EventTopicClaims
            chapterSelected={Boolean(book && form.chapterSlug)}
            loading={topicsLoading}
            topics={(topics ?? []).map((t) => ({ id: t.id, title: t.title }))}
            claimByTopic={claimByTopic}
            speakers={index?.speakers ?? []}
            busyTopic={busyTopic}
            genBusyId={genId}
            acceptBusyId={acceptId}
            acceptedSlides={acceptedSlides}
            message={claimsMsg ?? genMsg}
            onAssign={handleAssign}
            onFree={handleFree}
            onGenerate={generateTalk}
            onAccept={acceptTalk}
          />
        )}
      </Card>
      <Card>
        <p className="mb-1 text-sm font-medium">Монтажные ролики докладов</p>
        <p className="mb-4 text-xs text-ink-soft">
          Ссылки на чистовые записи докладов — показываются на странице спикера
          вместо записи всей встречи. Заполняйте после монтажа. Сохраняются с
          правками встречи (кнопка ниже).
        </p>
        {!(book && form.chapterSlug) ? (
          <p className="text-sm text-ink-soft">Выберите книгу и главу.</p>
        ) : topicsLoading ? (
          <p className="text-sm text-ink-soft">Загружаем темы главы…</p>
        ) : meetingTopics.length === 0 ? (
          <p className="text-sm text-ink-soft">В этой главе ещё нет тем.</p>
        ) : (
          <div className="space-y-4">
            {meetingTopics.map((topic) => (
              <div key={topic.id} className="space-y-3 rounded-card border border-line p-4">
                <p className="text-sm font-medium">{topic.title}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Монтаж YouTube">
                    <TextInput
                      value={form.recordings[topic.id]?.youtube ?? ''}
                      onChange={(e) => setRecording(topic.id, 'youtube', e.target.value)}
                      placeholder="https://youtu.be/…"
                    />
                  </Field>
                  <Field label="Монтаж VK">
                    <TextInput
                      value={form.recordings[topic.id]?.vk ?? ''}
                      onChange={(e) => setRecording(topic.id, 'vk', e.target.value)}
                      placeholder="https://vkvideo.ru/…"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={kind === 'closed-chapter' ? 'Открытое обсуждение' : 'Эфир докладов'}
        hint={
          <>
            <Mono>
              events/{dir}/{file}
            </Mono>{' '}
            — смена даты или названия перенесёт файл автоматически
          </>
        }
      />

      <Card>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.finished}
            onChange={(e) => form.setFinished(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <span className="block text-sm font-medium">Встреча завершена</span>
            <span className="block text-xs text-ink-soft">
              Уводит встречу в архив приложения. Добавьте записи (YouTube/VK)
              {kind === 'closed-chapter' ? ' и доску' : ''} ниже.
            </span>
          </span>
        </label>
      </Card>

      <EventFormFields
        kind={kind}
        form={form}
        index={index}
        topics={topics}
        topicsLoading={topicsLoading}
        liveTalkExtra={liveTalkExtra}
      />

      {announceNote ? (
        announceNote.ok ? (
          <SuccessBox>{announceNote.text}</SuccessBox>
        ) : (
          <ErrorBox>{announceNote.text}</ErrorBox>
        )
      ) : null}

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
