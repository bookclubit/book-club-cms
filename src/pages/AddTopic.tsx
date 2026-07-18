import { useEffect, useMemo, useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { Card, Field, Select, TextArea } from '../components/ui'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadChapter } from '../lib/repo'
import { pad2, slugify } from '../lib/slug'
import { buildTopicMarkdown } from '../lib/topicMd'
import type { Chapter } from '../types'

// Одна тема к созданию: порядок, id, имя файла, название.
interface PlannedTopic {
  order: number
  id: string
  file: string
  title: string
}

export function AddTopic() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [folder, setFolder] = useState('')
  const [chapterSlug, setChapterSlug] = useState('')
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [chapterError, setChapterError] = useState<string | null>(null)

  // Все темы главы разом — по одному названию на строку.
  const [titlesText, setTitlesText] = useState('')

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

  // Планируем темы: продолжаем нумерацию с конца существующих.
  const planned: PlannedTopic[] = useMemo(() => {
    if (!book || !chapter) return []
    const existing = chapter.topics.length
    return titlesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title, i) => {
        const order = existing + i + 1
        return {
          order,
          id: `${book.id}-${chapter.order}-${order}`,
          file: `${pad2(order)}-${slugify(title)}.md`,
          title,
        }
      })
  }, [book, chapter, titlesText])

  const ready = Boolean(book && chapter && planned.length > 0)

  function submit() {
    if (!index || !book || !chapter || planned.length === 0) return
    publish(async () => {
      // Тема заводится одним названием; контент дозаполняется после встречи.
      const mdFiles: FileChange[] = planned.map((t) => ({
        path: `books/${book.folder}/chapters/${chapterSlug}/${t.file}`,
        content: buildTopicMarkdown({
          id: t.id,
          title: t.title,
          order: t.order,
          videoYoutube: '',
          videoVk: '',
          presentation: '',
          resources: [],
          speakers: [],
          description: '',
          insights: [],
          speakerOpinions: [],
        }),
      }))

      const nextChapter: Chapter = {
        ...chapter,
        topics: [
          ...chapter.topics,
          ...planned.map((t) => ({ id: t.id, title: t.title, file: t.file })),
        ],
      }

      const dir = `books/${book.folder}/chapters/${chapterSlug}`
      const files: FileChange[] = [
        ...mdFiles,
        { path: `${dir}/chapter.json`, content: toJSON(nextChapter) },
      ]

      const count = planned.length
      return openContentPR(gh, {
        branch: `cms/topics-${book.folder}-${chapter.order}`,
        title: `feat(books): ${count} ${count === 1 ? 'тема' : 'тем'} в главе ${chapter.order} (${book.title})`,
        body: [
          `Темы главы **${chapter.order}. ${chapter.title}** книги **${book.title}**:`,
          '',
          ...planned.map((t) => `- ${t.order}. ${t.title} — \`${t.file}\``),
          '',
          `Все зарегистрированы в \`${dir}/chapter.json\` одним PR.`,
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
            Глава «{chapter.title}», тем сейчас: {chapter.topics.length}. Новые темы
            продолжат нумерацию с {chapter.topics.length + 1}.
          </p>
        )}
      </Card>

      <Card>
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Заведи сразу все темы главы — по одному названию на строку. Создаются одним
            pull request-ом (без конфликтов). Описание, видео, инсайты и мнения спикеров
            дозаполняются после встречи через редактирование каждой темы.
          </p>
          <Field label="Названия тем" hint="по одному на строку">
            <TextArea
              rows={8}
              value={titlesText}
              onChange={(e) => setTitlesText(e.target.value)}
              placeholder={'Почему Docker?\nАрхитектура Docker\nЖизненный цикл контейнера'}
            />
          </Field>
          {planned.length > 0 && (
            <div className="rounded-xl border border-line p-4">
              <p className="mb-2 text-sm font-medium">
                Будет создано тем: {planned.length}
              </p>
              <ol className="space-y-1 text-sm text-muted">
                {planned.map((t) => (
                  <li key={t.id}>
                    <span className="text-ink">{t.order}. {t.title}</span>{' '}
                    <code className="text-xs">{t.file}</code>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Выберите книгу и главу, введите хотя бы одно название темы"
      />
    </div>
  )
}
