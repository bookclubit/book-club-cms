import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearToken } from '../lib/auth'
import { ThemeToggle } from './ThemeToggle'

// N3 side-rail: постоянная навигация слева, контент на всю оставшуюся ширину.
// Разделы сгруппированы по смыслу — «что читаем» и «что происходит в клубе».
const groups: Array<{ title: string; links: Array<{ to: string; label: string; exact?: boolean }> }> = [
  {
    title: 'Контент',
    links: [
      { to: '/', label: 'Обзор', exact: true },
      { to: '/books', label: 'Книги' },
      { to: '/chapters', label: 'Главы и темы' },
      { to: '/flashcards', label: 'Карточки' },
    ],
  },
  {
    title: 'Клуб',
    links: [
      { to: '/events', label: 'Встречи' },
      { to: '/speakers', label: 'Спикеры' },
      { to: '/claims', label: 'Заявки' },
    ],
  },
  {
    title: 'Служебное',
    links: [{ to: '/settings', label: 'Настройки' }],
  },
]

function railLink({ isActive }: { isActive: boolean }) {
  return [
    'block rounded-control px-3 py-1.5 text-sm transition-colors duration-120 ease-out',
    isActive
      ? 'bg-accent-soft font-medium text-accent'
      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
  ].join(' ')
}

export function Layout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
              Книжный клуб
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">админка контента</p>
          </div>
          <ThemeToggle />
        </div>

        <nav className="px-3 py-4 lg:py-5">
          {groups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} end={link.exact} className={railLink}>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-4 text-xs text-ink-faint">
          <a
            href="https://github.com/bookclubit/book-club-data"
            target="_blank"
            rel="noreferrer"
            className="block whitespace-nowrap text-ink-soft underline decoration-line underline-offset-2 transition-colors duration-120 ease-out hover:text-ink"
          >
            book-club-data
          </a>
          <button
            type="button"
            onClick={() => {
              clearToken()
              navigate('/login')
            }}
            className="mt-2 whitespace-nowrap text-ink-faint transition-colors duration-120 ease-out hover:text-ink"
          >
            Выйти
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
