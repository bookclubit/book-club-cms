import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  EmptyState,
  ErrorBox,
  Loading,
  PageHeader,
  primaryLinkClass,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui'
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
    <div>
      <PageHeader
        title="Встречи"
        hint="Обсуждения глав и эфиры докладов. Запись участников — через бота."
        action={
          <Link
            to="/events/new"
            className={primaryLinkClass}
          >
            Новая встреча
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
          Активные ({active.length})
        </TabButton>
        <TabButton active={tab === 'archive'} onClick={() => setTab('archive')}>
          Архив ({archive.length})
        </TabButton>
      </div>

      {rows.loading && <Loading label="Загружаем встречи…" />}
      {rows.error && <ErrorBox>{rows.error}</ErrorBox>}
      {!rows.loading && visible.length === 0 && (
        <EmptyState
          title={tab === 'active' ? 'Активных встреч нет' : 'Архив пуст'}
          hint={tab === 'active' ? 'Заведите ближайшую встречу.' : undefined}
        />
      )}

      {visible.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th className="w-28">Дата</Th>
              <Th>Встреча</Th>
              <Th className="w-32">Тип</Th>
              <Th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <Tr key={r.path}>
                <Td className="nums text-ink-soft">{r.date}</Td>
                <Td>
                  <span className="block font-medium">{r.event?.title ?? r.slug}</span>
                  {r.event?.stream ? (
                    <span className="text-xs text-ink-faint">Книжный клуб {r.event.stream}</span>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={r.dir === 'closed-chapters' ? 'neutral' : 'accent'}>
                    {r.dir === 'closed-chapters' ? 'обсуждение' : 'доклады'}
                  </Badge>
                </Td>
                <Td>
                  <Link
                    to={`/events/${r.dir}/${encodeURIComponent(r.file)}/edit`}
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
