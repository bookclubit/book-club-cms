import { Link } from 'react-router-dom'
import { ErrorBox, SectionTitle } from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'

// Все главы, сгруппированные по книгам; каждая открывается на редактирование.
export function Chapters() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

  const booksWithChapters = index?.books.filter((b) => b.chapters.length > 0) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Главы</SectionTitle>
        <Link
          to="/chapters/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85"
        >
          + Добавить главу
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Загружаем реестр…</p>}
      {error && <ErrorBox>{error}</ErrorBox>}
      {index && booksWithChapters.length === 0 && (
        <p className="text-sm text-muted">Глав пока нет — добавьте первую.</p>
      )}

      {booksWithChapters.map((b) => (
        <section key={b.folder}>
          <p className="mb-2 text-sm font-medium">{b.title}</p>
          <ul className="space-y-2">
            {b.chapters.map((slug) => (
              <li key={slug}>
                <Link
                  to={`/chapters/${b.folder}/${slug}/edit`}
                  className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-2.5 text-sm transition hover:border-ink/30"
                >
                  <code className="truncate pr-4">{slug}</code>
                  <span className="shrink-0 text-accent">Редактировать</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
