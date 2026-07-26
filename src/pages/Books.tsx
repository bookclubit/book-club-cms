import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  EmptyState,
  ErrorBox,
  Loading,
  Mono,
  PageHeader,
  primaryLinkClass,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'
import { BOOK_CATEGORIES, type BookCategory } from '../types'

const STATUS_LABEL: Record<string, string> = {
  reading: 'читаем',
  planned: 'в планах',
  finished: 'прочитана',
}

const CATEGORY_LABEL = Object.fromEntries(BOOK_CATEGORIES.map((c) => [c.id, c.label]))

// Список книг с фильтром по категориям: клуб читает несколько книг параллельно.
export function Books() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

  const [filter, setFilter] = useState<'all' | BookCategory>('all')

  const books = index?.books ?? []
  const visible = filter === 'all' ? books : books.filter((b) => b.category === filter)
  const countBy = (cat: BookCategory) => books.filter((b) => b.category === cat).length

  return (
    <div>
      <PageHeader
        title="Книги"
        hint="Название, обложка и авторы книги — meta.json в book-club-data."
        action={
          <Link
            to="/books/new"
            className={primaryLinkClass}
          >
            Новая книга
          </Link>
        }
      />

      {loading && <Loading label="Загружаем реестр…" />}
      {error && <ErrorBox>{error}</ErrorBox>}

      {index && books.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
            Все ({books.length})
          </FilterTab>
          {BOOK_CATEGORIES.map((c) => (
            <FilterTab key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.label} ({countBy(c.id)})
            </FilterTab>
          ))}
        </div>
      )}

      {index && books.length === 0 && (
        <EmptyState title="Книг пока нет" hint="Добавьте первую — с обложкой и авторами." />
      )}
      {index && books.length > 0 && visible.length === 0 && (
        <EmptyState
          title="В этой категории книг нет"
          hint="Категория задаётся в форме редактирования книги."
        />
      )}

      {visible.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Книга</Th>
              <Th className="w-28">Главы</Th>
              <Th className="w-32">Статус</Th>
              <Th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => (
              <Tr key={b.folder}>
                <Td>
                  <span className="block font-medium">{b.title}</span>
                  <Mono>{b.folder}</Mono>
                  {b.category ? (
                    <span className="ml-2 text-xs text-ink-faint">
                      {CATEGORY_LABEL[b.category]}
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-ink-faint">без категории</span>
                  )}
                </Td>
                <Td className="nums text-ink-soft">{b.chapters.length}</Td>
                <Td>
                  <Badge tone={b.status === 'reading' ? 'accent' : 'neutral'}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </Badge>
                </Td>
                <Td>
                  <Link
                    to={`/books/${b.folder}/edit`}
                    className="text-ink-faint transition-colors duration-120 ease-out hover:text-ink" aria-label="Открыть"
                  >
                    ›
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
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
      aria-pressed={active}
      className={`whitespace-nowrap rounded-control border px-2.5 py-1 text-sm transition-colors duration-120 ease-out ${
        active
          ? 'bg-surface-2 font-medium text-ink'
          : 'text-ink-soft hover:bg-surface-2 hover:text-ink active:translate-y-px'
      }`}
    >
      {children}
    </button>
  )
}
