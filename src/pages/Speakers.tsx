import { Link } from 'react-router-dom'
import { ErrorBox, SectionTitle } from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'
import { mediaUrl } from '../lib/repo'

// Список спикеров из реестра; каждого можно открыть на редактирование.
export function Speakers() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Спикеры</SectionTitle>
        <Link
          to="/speakers/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85"
        >
          + Добавить спикера
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Загружаем реестр…</p>}
      {error && <ErrorBox>{error}</ErrorBox>}
      {index?.speakers.length === 0 && (
        <p className="text-sm text-muted">Спикеров пока нет — добавьте первого.</p>
      )}

      <ul className="space-y-2">
        {index?.speakers.map((s) => (
          <li key={s.id}>
            <Link
              to={`/speakers/${s.id}/edit`}
              className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-ink/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={mediaUrl(s.avatar)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border border-line object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    <code>{s.id}</code>
                    {s.aliases.length > 0 && ` · ${s.aliases.join(', ')}`}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-sm text-accent">Редактировать</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
