import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBox, SectionTitle } from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'
import { BOOK_CATEGORIES, type BookCategory } from '../types'

const STATUS_LABEL: Record<string, string> = {
  reading: 'читаем',
  planned: 'в планах',
  finished: 'прочитана',
}

const CATEGORY_LABEL = Object.fromEntries(BOOK_CATEGORIES.map((c) => [c.id, c.label]))

// Список добавленных книг с фильтром по категориям. Клуб читает несколько
// книг параллельно, поэтому вкладки помогают не терять их в общем списке.
export function Books() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

  const [filter, setFilter] = useState<'all' | BookCategory>('all')

  const books = index?.books ?? []
  const visible = filter === 'all' ? books : books.filter((b) => b.category === filter)
  const countBy = (cat: BookCategory) => books.filter((b) => b.category === cat).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Книги</SectionTitle>
        <Link
          to="/books/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85"
        >
          + Добавить книгу
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Загружаем реестр…</p>}
      {error && <ErrorBox>{error}</ErrorBox>}

      {index && (
        <div className="flex flex-wrap gap-1.5">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
            Все книги ({books.length})
          </FilterTab>
          {BOOK_CATEGORIES.map((c) => (
            <FilterTab key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.label} ({countBy(c.id)})
            </FilterTab>
          ))}
        </div>
      )}

      {index && books.length === 0 && (
        <p className="text-sm text-muted">Книг пока нет — добавьте первую.</p>
      )}
      {index && books.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted">
          В этой категории книг нет. Категория задаётся в форме редактирования книги.
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((b) => (
          <li key={b.folder}>
            <Link
              to={`/books/${b.folder}/edit`}
              className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-ink/30"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{b.title}</p>
                <p className="text-xs text-muted">
                  <code>{b.folder}</code> · глав: {b.chapters.length}
                  {b.category ? ` · ${CATEGORY_LABEL[b.category]}` : ' · без категории'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
                <span className="text-sm text-accent">Редактировать</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FilterTab({
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
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-ink text-white'
          : 'border border-line bg-white text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
