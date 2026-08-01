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
import { MergeButton } from '../components/MergeButton'
import { eventArchived } from '../lib/events'
import type { PullRequestInfo } from '../lib/github'
import { useDataClient, useIndex, useLoad } from '../lib/hooks'
import type { ClubEvent } from '../types'

// Встреча, которая пока живёт только в открытом pull request-е.
interface PendingEvent {
  pr: PullRequestInfo
  dir: string
  file: string
}

interface EventRow {
  path: string
  dir: string
  file: string
  date: string
  slug: string
  event: ClubEvent | null
}

type Tab = 'active' | 'archive'

// Список встреч: активные и архив — тем же правилом, что в miniapp и боте
// (`eventArchived`: флаг finished или 4 часа после начала).
// Загружаем JSON каждой встречи, чтобы знать время, finished, stream и название.
export function Events() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const [tab, setTab] = useState<Tab>('active')
  const [mergeNote, setMergeNote] = useState<string | null>(null)

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

  // Встречи в открытых PR-ах: в main их ещё нет, поэтому в таблице выше они не
  // видны — а дорабатывать их (догрузить афишу, поправить ссылки) нужно до мержа.
  const pending = useLoad<PendingEvent[]>(async () => {
    const prs = await gh.listOpenPullRequests()
    const found = await Promise.all(
      prs.map(async (pr) => {
        const files = await gh.listPullRequestFiles(pr.number)
        // Берём тот файл встречи, который в ветке существует: у переносов
        // (сменили дату/название) в PR есть и удалённый старый путь.
        const path = files
          .filter((f) => f.status !== 'removed')
          .map((f) => f.filename)
          .find((name) => /^events\/[^/]+\/[^/]+\.json$/.test(name))
        if (!path) return null
        const rest = path.slice('events/'.length)
        const slash = rest.indexOf('/')
        return {
          pr,
          dir: rest.slice(0, slash),
          file: rest.slice(slash + 1),
        }
      }),
    )
    return found.filter((p): p is PendingEvent => p !== null)
  }, [gh])

  const all = rows.data ?? []
  const active = all.filter((r) => !eventArchived(r.event))
  const archive = all.filter((r) => eventArchived(r.event))
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

      {(pending.data?.length ?? 0) > 0 && (
        <section className="mb-6 rounded-card border border-line bg-surface-2 p-5">
          <p className="text-[13px] font-semibold">Ждут мержа · {pending.data?.length}</p>
          <p className="mt-1 text-xs text-ink-soft">
            Эти встречи пока только в pull request-ах — в списке ниже они появятся после
            мержа. «Доработать» правит тот же PR: можно догрузить афишу, поправить ссылки
            или дату, второй PR не создастся.
          </p>
          <ul className="mt-4 space-y-2">
            {pending.data?.map(({ pr, dir, file }) => (
              <li
                key={pr.number}
                className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface px-3 py-2"
              >
                <div className="min-w-0 grow">
                  <span className="block text-[13px] font-medium">{pr.title}</span>
                  <span className="text-xs text-ink-faint">
                    PR #{pr.number} · <span className="font-mono">{file}</span>
                  </span>
                </div>
                <Link
                  to={`/events/${dir}/${encodeURIComponent(file)}/edit?pr=${pr.number}`}
                  className={primaryLinkClass}
                >
                  Доработать
                </Link>
                <MergeButton
                  number={pr.number}
                  branch={pr.head?.ref}
                  onMerged={(note) => {
                    setMergeNote(note)
                    pending.reload()
                    rows.reload()
                  }}
                />
                <a
                  href={pr.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-ink-soft underline decoration-line underline-offset-2 transition-colors duration-120 ease-out hover:text-ink"
                >
                  На GitHub
                </a>
              </li>
            ))}
          </ul>
          {mergeNote && <p className="mt-3 text-xs text-ink-soft">{mergeNote}</p>}
        </section>
      )}

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
