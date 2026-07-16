import { Link } from 'react-router-dom'
import { ErrorBox, SectionTitle } from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'

const STATUS_LABEL: Record<string, string> = {
  reading: 'читаем',
  planned: 'в планах',
  finished: 'прочитана',
}

// Список добавленных книг: каждую можно открыть на редактирование.
export function Books() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

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
      {index?.books.length === 0 && (
        <p className="text-sm text-muted">Книг пока нет — добавьте первую.</p>
      )}

      <ul className="space-y-2">
        {index?.books.map((b) => (
          <li key={b.folder}>
            <Link
              to={`/books/${b.folder}/edit`}
              className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-ink/30"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{b.title}</p>
                <p className="text-xs text-muted">
                  <code>{b.folder}</code> · глав: {b.chapters.length}
                  {b.folder === index.active_book && ' · активная'}
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
