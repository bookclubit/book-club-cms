import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  EmptyState,
  ErrorBox,
  Loading,
  Mono,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'

// Все главы книги одной таблицей. В реестре теперь есть и пустые главы —
// они видны сразу после создания и помечены как заготовки.
export function Chapters() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)
  const [book, setBook] = useState<string>('all')

  const books = index?.books ?? []
  const visible = book === 'all' ? books : books.filter((b) => b.folder === book)
  const total = books.reduce((sum, b) => sum + b.chapters.length, 0)

  return (
    <div>
      <PageHeader
        title="Главы и темы"
        hint="Темы живут внутри главы: там же название, спикеры и ссылки на материалы."
        action={
          <Link
            to="/chapters/new"
            className="inline-flex items-center whitespace-nowrap rounded-control bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors duration-120 ease-out hover:bg-accent-hover"
          >
            Новая глава
          </Link>
        }
      />

      {loading && <Loading label="Загружаем реестр…" />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {index && total === 0 && (
        <EmptyState title="Глав пока нет" hint="Создайте первую — вместе с темами." />
      )}

      {books.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <FilterChip active={book === 'all'} onClick={() => setBook('all')}>
            Все книги
          </FilterChip>
          {books.map((b) => (
            <FilterChip key={b.folder} active={book === b.folder} onClick={() => setBook(b.folder)}>
              {b.title}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {visible.map((b) => (
          <section key={b.folder}>
            <h2 className="mb-2 font-display text-[15px] font-semibold tracking-tight text-ink">
              {b.title}{' '}
              <span className="nums text-sm font-normal text-ink-faint">
                · глав {b.chapters.length}
              </span>
            </h2>

            {b.chapters.length === 0 ? (
              <p className="text-sm text-ink-faint">Глав нет.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-14">№</Th>
                    <Th>Глава</Th>
                    <Th className="w-28">Темы</Th>
                    <Th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {b.chapters.map((ch) => (
                    <Tr key={ch.slug}>
                      <Td className="nums text-ink-faint">{ch.order}</Td>
                      <Td>
                        <span className="block font-medium">{ch.title}</span>
                        <Mono>{ch.slug}</Mono>
                      </Td>
                      <Td>
                        {ch.topics > 0 ? (
                          <span className="nums text-ink-soft">{ch.topics}</span>
                        ) : (
                          <Badge tone="warn">заготовка</Badge>
                        )}
                      </Td>
                      <Td>
                        <Link
                          to={`/chapters/${b.folder}/${ch.slug}/edit`}
                          className="whitespace-nowrap text-sm font-medium text-accent underline decoration-accent/30 underline-offset-2 transition-colors duration-120 ease-out hover:decoration-accent"
                        >
                          Открыть
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        ))}
      </div>
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
      className={`whitespace-nowrap rounded-control border px-2.5 py-1 text-sm transition-colors duration-120 ease-out ${
        active
          ? 'border-accent bg-accent text-on-accent'
          : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink active:translate-y-px'
      }`}
    >
      {children}
    </button>
  )
}
