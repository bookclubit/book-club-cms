import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBox, SectionTitle } from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'

// Все главы, сгруппированные по книгам; каждая открывается на редактирование.
// Фильтр по книге показывает главы только выбранной книги.
export function Chapters() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)
  const [book, setBook] = useState<string>('all')

  const booksWithChapters = index?.books.filter((b) => b.chapters.length > 0) ?? []
  const visible = book === 'all' ? booksWithChapters : booksWithChapters.filter((b) => b.folder === book)

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

      {booksWithChapters.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={book === 'all'} onClick={() => setBook('all')}>
            Все книги
          </FilterChip>
          {booksWithChapters.map((b) => (
            <FilterChip key={b.folder} active={book === b.folder} onClick={() => setBook(b.folder)}>
              {b.title}
            </FilterChip>
          ))}
        </div>
      )}

      {visible.map((b) => (
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-full bg-ink px-3 py-1 text-sm font-medium text-white'
          : 'rounded-full border border-line px-3 py-1 text-sm font-medium text-muted hover:text-ink'
      }
    >
      {children}
    </button>
  )
}
