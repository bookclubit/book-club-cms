import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, ErrorBox, Field, SectionTitle, Select } from '../components/ui'
import { useDataClient, useIndex, useLoad } from '../lib/hooks'
import { loadChapter } from '../lib/repo'

// Темы выбранной главы; каждую можно открыть на редактирование.
export function Topics() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

  const [folder, setFolder] = useState('')
  const [chapterSlug, setChapterSlug] = useState('')
  const book = index?.books.find((b) => b.folder === folder)

  useEffect(() => {
    setChapterSlug('')
  }, [folder])

  const chapter = useLoad(
    () => (folder && chapterSlug ? loadChapter(gh, folder, chapterSlug) : Promise.resolve(null)),
    [gh, folder, chapterSlug],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Темы</SectionTitle>
        <Link
          to="/topics/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85"
        >
          + Добавить тему
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Загружаем реестр…</p>}
      {error && <ErrorBox>{error}</ErrorBox>}

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
      </Card>

      {chapterSlug && chapter.error && <ErrorBox>{chapter.error}</ErrorBox>}
      {chapter.data && chapter.data.topics.length === 0 && (
        <p className="text-sm text-muted">В главе пока нет тем.</p>
      )}
      {chapter.data && chapter.data.topics.length > 0 && (
        <ul className="space-y-2">
          {chapter.data.topics.map((t) => (
            <li key={t.id}>
              <Link
                to={`/topics/${folder}/${chapterSlug}/${encodeURIComponent(t.file)}/edit`}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-ink/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    <code>{t.file}</code> · id <code>{t.id}</code>
                  </p>
                </div>
                <span className="shrink-0 text-sm text-accent">Редактировать</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
