import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// Тема: выбор пользователя в localStorage, иначе системная. Стартовое значение
// ставит инлайн-скрипт в index.html — здесь только читаем и переключаем.
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('cms-theme', theme)
    } catch {
      // приватный режим — тема просто не запомнится
    }
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
      title={next === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
      className="rounded-control border border-line p-1.5 text-ink-faint transition-colors duration-120 ease-out hover:border-line-strong hover:text-ink"
    >
      {theme === 'dark' ? (
        // солнце — переключит на светлую
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        // месяц — переключит на тёмную
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}
