import { useEffect, useMemo, useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { Card, Field, Select, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadChapter } from '../lib/repo'
import { pad2, slugify } from '../lib/slug'
import { buildTopicMarkdown } from '../lib/topicMd'
import type { Chapter } from '../types'

export function AddTopic() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [folder, setFolder] = useState('')
  const [chapterSlug, setChapterSlug] = useState('')
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [chapterError, setChapterError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [videoYoutube, setVideoYoutube] = useState('')
  const [videoVk, setVideoVk] = useState('')
  const [presentation, setPresentation] = useState('')
  const [resources, setResources] = useState('')
  const [speakers, setSpeakers] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [insights, setInsights] = useState('')
  const [opinions, setOpinions] = useState<Record<string, string>>({})

  const book = index?.books.find((b) => b.folder === folder)

  // Меняется книга — сбрасываем главу; меняется глава — тянем её chapter.json.
  useEffect(() => {
    setChapterSlug('')
    setChapter(null)
  }, [folder])

  useEffect(() => {
    setChapter(null)
    setChapterError(null)
    if (!folder || !chapterSlug) return
    let cancelled = false
    loadChapter(gh, folder, chapterSlug)
      .then((ch) => {
        if (cancelled) return
        if (!ch) setChapterError('chapter.json не найден')
        else setChapter(ch)
      })
      .catch((err: unknown) => {
        if (!cancelled) setChapterError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [gh, folder, chapterSlug])

  const nextOrder = useMemo(() => (chapter ? chapter.topics.length + 1 : 1), [chapter])
  const fileName = `${pad2(nextOrder)}-${slugify(title)}.md`
  const topicId = book && chapter ? `${book.id}-${chapter.order}-${nextOrder}` : ''

  const ready = Boolean(book && chapter && title.trim() && description.trim())

  function toggleSpeaker(name: string) {
    setSpeakers((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
  }

  function submit() {
    if (!index || !book || !chapter) return
    publish(async () => {
      const md = buildTopicMarkdown({
        id: topicId,
        title,
        order: nextOrder,
        videoYoutube,
        videoVk,
        presentation,
        resources: resources.split('\n'),
        speakers,
        description,
        insights: insights.split('\n'),
        speakerOpinions: speakers.map((s) => ({ speaker: s, text: opinions[s] ?? '' })),
      })

      const nextChapter: Chapter = {
        ...chapter,
        topics: [
          ...chapter.topics,
          { id: topicId, title: title.trim(), file: fileName },
        ],
      }

      const dir = `books/${book.folder}/chapters/${chapterSlug}`
      const files: FileChange[] = [
        { path: `${dir}/${fileName}`, content: md },
        { path: `${dir}/chapter.json`, content: toJSON(nextChapter) },
      ]

      return openContentPR(gh, {
        branch: `cms/topic-${book.folder}-${chapter.order}-${nextOrder}`,
        title: `feat(books): тема «${title.trim()}» (${book.title}, глава ${chapter.order})`,
        body: [
          `Тема **${title.trim()}** в главе **${chapter.order}. ${chapter.title}**.`,
          '',
          `- \`${dir}/${fileName}\``,
          `- тема зарегистрирована в \`${dir}/chapter.json\``,
          speakers.length > 0 ? `- спикеры: ${speakers.join(', ')}` : null,
          '',
          '_Создано через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files,
      })
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Книга">
            <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">— выберите —</option>
              {index?.books
                .filter((b) => b.chapters.length > 0)
                .map((b) => (
                  <option key={b.folder} value={b.folder}>
                    {b.title}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Глава" hint={chapterError ?? undefined}>
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
        {chapter && (
          <p className="mt-3 text-xs text-muted">
            Глава «{chapter.title}», тем сейчас: {chapter.topics.length}. Новая тема получит
            номер {nextOrder}, id <code>{topicId || '…'}</code>
            {title && (
              <>
                , файл <code>{fileName}</code>
              </>
            )}
          </p>
        )}
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label="Название темы">
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Почему Docker?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Видео YouTube">
              <TextInput
                value={videoYoutube}
                onChange={(e) => setVideoYoutube(e.target.value)}
                placeholder="https://youtube.com/…"
              />
            </Field>
            <Field label="Видео VK">
              <TextInput
                value={videoVk}
                onChange={(e) => setVideoVk(e.target.value)}
                placeholder="https://vk.com/video…"
              />
            </Field>
          </div>
          <Field label="Презентация">
            <TextInput
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
              placeholder="https://…pages.dev"
            />
          </Field>
          <Field label="Доп. материалы" hint="по одной ссылке на строку">
            <TextArea
              rows={2}
              value={resources}
              onChange={(e) => setResources(e.target.value)}
            />
          </Field>
          <Field label="Спикеры">
            <div className="flex flex-wrap gap-2">
              {index?.speakers.map((s) => {
                const name = s.aliases[0] ?? s.name
                const active = speakers.includes(name)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSpeaker(name)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-white text-muted hover:text-ink'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label="Краткое описание">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Суть темы в 2–4 предложениях"
            />
          </Field>
          <Field label="Инсайты" hint="по одному на строку — станут списком">
            <TextArea value={insights} onChange={(e) => setInsights(e.target.value)} />
          </Field>
          {speakers.map((s) => (
            <Field key={s} label={`Мнение спикера — ${s}`} hint="опционально">
              <TextArea
                rows={2}
                value={opinions[s] ?? ''}
                onChange={(e) => setOpinions({ ...opinions, [s]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Выберите книгу и главу, заполните название и описание"
      />
    </div>
  )
}
