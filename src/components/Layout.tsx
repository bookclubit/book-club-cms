import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearToken } from '../lib/auth'

const links = [
  { to: '/', label: 'Обзор', exact: true },
  { to: '/books/new', label: 'Книга' },
  { to: '/chapters/new', label: 'Глава' },
  { to: '/topics/new', label: 'Тема' },
  { to: '/events/new', label: 'Встреча' },
  { to: '/flashcards/new', label: 'Карточки' },
  { to: '/speakers/new', label: 'Спикер' },
]

export function Layout() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24">
      <header className="mb-8 flex items-center justify-between pt-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Codex CMS</h1>
          <p className="text-sm text-muted">
            Контент клуба → pull request в{' '}
            <a
              href="https://github.com/bookclubit/book-club-data"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-2 hover:text-ink"
            >
              book-club-data
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearToken()
            navigate('/login')
          }}
          className="text-sm text-muted hover:text-ink"
        >
          Выйти
        </button>
      </header>

      <nav className="mb-8 flex flex-wrap gap-1.5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.exact}
            className={({ isActive }) =>
              `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-ink text-white'
                  : 'border border-line bg-white text-muted hover:text-ink'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
