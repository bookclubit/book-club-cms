import { Link } from 'react-router-dom'
import { ErrorBox, SectionTitle } from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'

// Список встреч из реестра (events: ["closed-chapters/2026-….json", …]).
export function Events() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

  // Свежие сверху: имена файлов начинаются с даты YYYY-MM-DD.
  const events = [...(index?.events ?? [])].sort((a, b) =>
    (b.split('/')[1] ?? '').localeCompare(a.split('/')[1] ?? ''),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Встречи</SectionTitle>
        <Link
          to="/events/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85"
        >
          + Добавить встречу
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Загружаем реестр…</p>}
      {error && <ErrorBox>{error}</ErrorBox>}
      {index && events.length === 0 && (
        <p className="text-sm text-muted">Встреч пока нет — добавьте первую.</p>
      )}

      <ul className="space-y-2">
        {events.map((path) => {
          const [dir, file] = [path.slice(0, path.indexOf('/')), path.slice(path.indexOf('/') + 1)]
          const date = file.slice(0, 10)
          const slug = file.slice(11).replace(/\.json$/, '')
          return (
            <li key={path}>
              <Link
                to={`/events/${dir}/${encodeURIComponent(file)}/edit`}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-ink/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {date} · <code>{slug}</code>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                    {dir === 'closed-chapters' ? 'разбор главы' : 'открытый эфир'}
                  </span>
                  <span className="text-sm text-accent">Редактировать</span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
