import { Link } from 'react-router-dom'
import { EmptyState, ErrorBox, Loading, Mono, PageHeader } from '../components/ui'
import { useDataClient, useIndex } from '../lib/hooks'
import { mediaUrl } from '../lib/repo'

// Спикеры клуба: аватарка, имя и алиасы (по алиасам темы связываются со спикером).
export function Speakers() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)

  return (
    <div>
      <PageHeader
        title="Спикеры"
        hint="Имя и алиасы связывают спикера с темами глав и заявками на доклады."
        action={
          <Link
            to="/speakers/new"
            className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-control bg-ink px-3 text-[13px] font-medium text-on-accent transition-colors duration-120 ease-out hover:bg-accent-hover"
          >
            Новый спикер
          </Link>
        }
      />

      {loading && <Loading label="Загружаем реестр…" />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {index?.speakers.length === 0 && (
        <EmptyState title="Спикеров пока нет" hint="Добавьте первого — с аватаркой в WebP." />
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {index?.speakers.map((s) => (
          <li key={s.id}>
            <Link
              to={`/speakers/${s.id}/edit`}
              className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors duration-120 ease-out hover:border-line-strong hover:bg-surface-2"
            >
              <img
                src={mediaUrl(s.avatar)}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-full border border-line object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                <p className="truncate">
                  <Mono>{s.id}</Mono>
                  {s.aliases.length > 0 && (
                    <span className="ml-1.5 text-xs text-ink-faint">{s.aliases.join(', ')}</span>
                  )}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
