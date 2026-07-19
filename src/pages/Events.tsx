import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBox, SectionTitle } from '../components/ui'
import { useDataClient, useIndex, useLoad } from '../lib/hooks'
import type { ClubEvent } from '../types'

interface EventRow {
  path: string
  dir: string
  file: string
  date: string
  slug: string
  event: ClubEvent | null
}

type Tab = 'active' | 'archive'

// Список встреч: активные и архив (по флагу finished, как в miniapp).
// Загружаем JSON каждой встречи, чтобы знать finished, stream и название.
export function Events() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const [tab, setTab] = useState<Tab>('active')

  const rows = useLoad<EventRow[]>(async () => {
    if (!index) return []
    // Свежие сверху: имена файлов начинаются с даты YYYY-MM-DD.
    const sorted = [...index.events].sort((a, b) =>
      (b.split('/')[1] ?? '').localeCompare(a.split('/')[1] ?? ''),
    )
    return Promise.all(
      sorted.map(async (path) => {
        const slash = path.indexOf('/')
        const file = path.slice(slash + 1)
        return {
          path,
          dir: path.slice(0, slash),
          file,
          date: file.slice(0, 10),
          slug: file.slice(11).replace(/\.json$/, ''),
          event: await gh.getFileJson<ClubEvent>(`events/${path}`),
        }
      }),
    )
  }, [gh, index])

  const all = rows.data ?? []
  const active = all.filter((r) => !r.event?.finished)
  const archive = all.filter((r) => r.event?.finished)
  const visible = tab === 'active' ? active : archive

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

      <div className="flex gap-2">
        <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
          Активные ({active.length})
        </TabButton>
        <TabButton active={tab === 'archive'} onClick={() => setTab('archive')}>
          Архив ({archive.length})
        </TabButton>
      </div>

      {rows.loading && <p className="text-sm text-muted">Загружаем встречи…</p>}
      {rows.error && <ErrorBox>{rows.error}</ErrorBox>}
      {!rows.loading && visible.length === 0 && (
        <p className="text-sm text-muted">
          {tab === 'active' ? 'Активных встреч нет — добавьте первую.' : 'Архив пуст.'}
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((r) => (
          <li key={r.path}>
            <Link
              to={`/events/${r.dir}/${encodeURIComponent(r.file)}/edit`}
              className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-ink/30"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {r.date}
                  {r.event?.stream ? ` · Книжный клуб ${r.event.stream}` : ''}
                </p>
                <p className="truncate text-xs text-muted">{r.event?.title ?? r.slug}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                  {r.dir === 'closed-chapters' ? 'обсуждение' : 'доклады'}
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

function TabButton({
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
          ? 'rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white'
          : 'rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:text-ink'
      }
    >
      {children}
    </button>
  )
}
