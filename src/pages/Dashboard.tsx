import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, ErrorBox, SectionTitle } from '../components/ui'
import type { PullRequestInfo } from '../lib/github'
import { useDataClient, useIndex } from '../lib/hooks'

const actions = [
  { to: '/books/new', title: 'Добавить книгу', desc: 'Обложка, авторы, описание — meta.json + WebP' },
  { to: '/chapters/new', title: 'Добавить главу', desc: 'Индекс главы chapter.json внутри книги' },
  { to: '/topics/new', title: 'Добавить тему', desc: 'Markdown с видео, инсайтами и мнением спикера' },
  { to: '/events/new', title: 'Добавить встречу', desc: 'Открытое обсуждение главы или доклады' },
  { to: '/flashcards/new', title: 'Добавить карточки', desc: 'ANKI-карточки для бота, id — автоматически' },
  { to: '/speakers/new', title: 'Добавить спикера', desc: 'Аватарка WebP в media/speakers/' },
]

export function Dashboard() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)
  const [prs, setPrs] = useState<PullRequestInfo[] | null>(null)

  useEffect(() => {
    gh.listOpenPullRequests()
      .then(setPrs)
      .catch(() => setPrs(null))
  }, [gh])

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Действия</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group rounded-2xl border border-line bg-white p-5 transition hover:border-ink/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
            >
              <p className="mb-1 font-medium group-hover:text-accent">{a.title}</p>
              <p className="text-sm text-muted">{a.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Сейчас в клубе</SectionTitle>
        {loading && <p className="text-sm text-muted">Загружаем реестр…</p>}
        {error && <ErrorBox>{error}</ErrorBox>}
        {index && (
          <Card>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="Книги" value={index.books.length} />
              <Stat
                label="Главы"
                value={index.books.reduce((sum, b) => sum + b.chapters.length, 0)}
              />
              <Stat label="Встречи" value={index.events.length} />
              <Stat label="Спикеры" value={index.speakers.length} />
            </div>
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Активная книга: <b>{index.active_book || '—'}</b>
            </p>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Открытые pull request-ы</SectionTitle>
        {prs === null && <p className="text-sm text-muted">Не удалось загрузить список.</p>}
        {prs?.length === 0 && (
          <p className="text-sm text-muted">Нет открытых PR — всё смержено</p>
        )}
        {prs && prs.length > 0 && (
          <ul className="space-y-2">
            {prs.map((pr) => (
              <li key={pr.number}>
                <a
                  href={pr.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm transition hover:border-ink/30"
                >
                  <span className="truncate pr-4">{pr.title}</span>
                  <span className="shrink-0 text-muted">#{pr.number}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-muted">{label}</p>
    </div>
  )
}
