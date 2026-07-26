import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MergeButton } from '../components/MergeButton'
import { Badge, Card, ErrorBox, Loading, PageHeader } from '../components/ui'
import type { PullRequestInfo } from '../lib/github'
import { useDataClient, useIndex } from '../lib/hooks'

// Что заводят чаще — выше и шире: глава с темами и встреча.
const actions = [
  {
    to: '/chapters/new',
    title: 'Новая глава',
    desc: 'Глава вместе с темами — один файл, один PR',
    wide: true,
  },
  { to: '/events/new', title: 'Новая встреча', desc: 'Обсуждение главы или эфир докладов' },
  { to: '/flashcards/new', title: 'Карточки', desc: 'ANKI-карточки для бота, id автоматически' },
  { to: '/books/new', title: 'Книга', desc: 'meta.json, обложка и авторы в WebP' },
  { to: '/speakers/new', title: 'Спикер', desc: 'Аватарка WebP и профиль' },
]

export function Dashboard() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)
  const [prs, setPrs] = useState<PullRequestInfo[] | null>(null)
  const [mergeNote, setMergeNote] = useState<string | null>(null)

  useEffect(() => {
    gh.listOpenPullRequests()
      .then(setPrs)
      .catch(() => setPrs(null))
  }, [gh])

  const emptyChapters =
    index?.books.reduce((sum, b) => sum + b.chapters.filter((c) => c.topics === 0).length, 0) ?? 0

  return (
    <div>
      <PageHeader
        title="Обзор"
        hint="Правки контента уходят в book-club-data пул-реквестами."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={`group rounded-card border border-line bg-surface p-4 transition-colors duration-120 ease-out hover:border-line-strong hover:bg-surface-2 ${
              a.wide ? 'sm:col-span-2' : ''
            }`}
          >
            <p className="text-[13px] font-semibold text-ink">
              {a.title}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">{a.desc}</p>
          </Link>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-semibold text-ink">
          Сейчас в клубе
        </h2>
        {loading && <Loading label="Загружаем реестр…" />}
        {error && <ErrorBox>{error}</ErrorBox>}
        {index && (
          <Card>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="Книги" value={index.books.length} />
              <Stat
                label="Главы"
                value={index.books.reduce((sum, b) => sum + b.chapters.length, 0)}
              />
              <Stat label="Встречи" value={index.events.length} />
              <Stat label="Спикеры" value={index.speakers.length} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-xs text-ink-soft">
              <span>
                Активная книга:{' '}
                <span className="font-medium text-ink">{index.active_book || '—'}</span>
              </span>
              {emptyChapters > 0 ? (
                <Link to="/chapters">
                  <Badge tone="warn">глав без тем: {emptyChapters}</Badge>
                </Link>
              ) : null}
            </div>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold text-ink">
          Открытые pull request-ы
        </h2>
        {prs === null && <p className="text-sm text-ink-faint">Не удалось загрузить список.</p>}
        {prs?.length === 0 && (
          <p className="text-sm text-ink-faint">Нет открытых PR — всё смержено.</p>
        )}
        {prs && prs.length > 0 && (
          <>
            <ul className="space-y-2">
              {prs.map((pr) => (
                <li
                  key={pr.number}
                  className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 text-[13px]"
                >
                  <a
                    href={pr.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 grow truncate transition-colors duration-120 ease-out hover:text-accent"
                  >
                    {pr.title}
                  </a>
                  <span className="nums shrink-0 text-ink-faint">#{pr.number}</span>
                  <MergeButton
                    number={pr.number}
                    branch={pr.head?.ref}
                    onMerged={(note) => {
                      setMergeNote(note)
                      setPrs((prev) => (prev ?? []).filter((p) => p.number !== pr.number))
                    }}
                  />
                </li>
              ))}
            </ul>
            {mergeNote && <p className="mt-3 text-xs text-ink-soft">{mergeNote}</p>}
          </>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="nums text-xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-[13px] text-ink-soft">{label}</p>
    </div>
  )
}
