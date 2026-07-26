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
  TrGroup,
} from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'

// Все главы одной таблицей: книги — строки-подзаголовки внутри неё, а не
// отдельные таблицы со своими шапками. В реестре есть и пустые главы —
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
        hint="Темы живут внутри главы: там же спикеры и ссылки на материалы."
        action={
          <Link to="/chapters/new" className={primaryLinkClass}>
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
        <div className="mb-4 flex flex-wrap gap-1">
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

      {total > 0 && (
        <Table>
          <thead>
            <tr>
              <Th className="w-10 text-right">№</Th>
              <Th>Глава</Th>
              <Th className="w-24 text-right">Темы</Th>
              <Th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => (
              <Fragmented key={b.folder}>
                <TrGroup colSpan={4}>
                  {b.title}
                  <span className="nums ml-2 text-ink-faint">{b.chapters.length}</span>
                </TrGroup>
                {b.chapters.map((ch) => (
                  <Tr key={ch.slug}>
                    <Td className="nums text-right text-ink-faint">{ch.order}</Td>
                    <Td>
                      <Link
                        to={`/chapters/${b.folder}/${ch.slug}/edit`}
                        className="group flex flex-wrap items-baseline gap-x-2"
                      >
                        <span className="font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2">
                          {ch.title}
                        </span>
                        <Mono>{ch.slug}</Mono>
                      </Link>
                    </Td>
                    <Td className="text-right">
                      {ch.topics > 0 ? (
                        <span className="nums text-ink-soft">{ch.topics}</span>
                      ) : (
                        <Badge>заготовка</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Link
                        to={`/chapters/${b.folder}/${ch.slug}/edit`}
                        aria-label={`Открыть главу ${ch.order}`}
                        className="text-ink-faint transition-colors duration-120 ease-out hover:text-ink"
                      >
                        ›
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </Fragmented>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

// Группа строк книги: <tbody> может содержать только строки, поэтому
// оборачиваем их фрагментом, а не элементом.
function Fragmented({ children }: { children: React.ReactNode }) {
  return <>{children}</>
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
      className={`whitespace-nowrap rounded-control px-2.5 py-1 text-[13px] transition-colors duration-120 ease-out ${
        active
          ? 'bg-surface-2 font-medium text-ink'
          : 'text-ink-soft hover:bg-surface-2 hover:text-ink active:translate-y-px'
      }`}
    >
      {children}
    </button>
  )
}
