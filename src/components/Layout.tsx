import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearToken } from '../lib/auth'
import { ThemeToggle } from './ThemeToggle'

// N3 side-rail: узкая постоянная навигация слева, контент справа. Рейл живёт на
// том же холсте, что страница, и отделён одной волосяной линией.
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
    'block rounded-control px-2 py-1 text-[13px] transition-colors duration-120 ease-out',
    isActive
      ? 'bg-surface-2 font-medium text-ink'
      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
  ].join(' ')
}

export function Layout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[13.5rem_1fr]">
      <aside className="border-b border-line lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <p className="text-[13px] font-semibold text-ink">Книжный клуб</p>
          <ThemeToggle />
        </div>

        <nav className="px-2 py-4">
          {groups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="px-2 pb-1 text-[11px] text-ink-faint">{group.title}</p>
              <ul className="space-y-px">
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

        <div className="px-4 py-3 text-[12px] lg:absolute lg:bottom-0 lg:w-54">
          <a
            href="https://github.com/bookclubit/book-club-data"
            target="_blank"
            rel="noreferrer"
            className="block whitespace-nowrap text-ink-faint transition-colors duration-120 ease-out hover:text-ink"
          >
            book-club-data ↗
          </a>
          <button
            type="button"
            onClick={() => {
              clearToken()
              navigate('/login')
            }}
            className="mt-1.5 whitespace-nowrap text-ink-faint transition-colors duration-120 ease-out hover:text-ink"
          >
            Выйти
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-5 pb-24 pt-6 lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-3xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
