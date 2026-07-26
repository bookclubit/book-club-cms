import type { ReactNode } from 'react'

// Примитивы CMS. Цвета и шрифты — только через токены из index.css.
// Правило монохрома: цветом обозначается смысл (ошибка/предупреждение),
// иерархия держится весом, размером и волосяными линиями.

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  )
}

const controlClass =
  'w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-faint ' +
  'transition-colors duration-120 ease-out hover:border-line-strong ' +
  'focus:border-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

// Поле растёт под содержимое (field-sizing), чтобы длинное описание не пряталось
// в трёх строках со скроллом. Браузеры без поддержки просто получат rows.
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${controlClass} field-sizing-content max-h-80 min-h-16 ${props.className ?? ''}`}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

// Кнопка. loading — отдельное состояние: подпись остаётся, действие блокируется.
export function Button({
  variant = 'primary',
  loading = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
}) {
  const styles = {
    primary:
      'bg-ink text-on-accent hover:bg-accent-hover active:translate-y-px ' +
      'disabled:bg-line-strong disabled:text-ink-faint',
    ghost:
      'border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong ' +
      'active:translate-y-px disabled:text-ink-faint',
    danger:
      'border border-line bg-surface text-danger hover:bg-danger-soft hover:border-danger/40 ' +
      'active:translate-y-px disabled:text-ink-faint',
  }[variant]

  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-3 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-120 ease-out disabled:cursor-not-allowed ${styles} ${props.className ?? ''}`}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

// Кнопка-ссылка того же вида, что primary Button (для react-router Link детей).
export const primaryLinkClass =
  'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-control bg-ink px-3 text-[13px] font-medium text-on-accent transition-colors duration-120 ease-out hover:bg-accent-hover'

// Спиннер только внутри кнопки: показывается вместе с уже начатым действием.
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-card border border-line bg-surface p-5 ${className}`}>
      {children}
    </section>
  )
}

// Заголовок группы полей внутри карточки.
export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[13px] font-semibold text-ink">{children}</h2>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

// Заголовок страницы: название, пояснение и место под действие справа.
export function PageHeader({
  title,
  hint,
  action,
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold text-ink">{title}</h1>
        {hint ? <p className="mt-1 text-[13px] text-ink-soft">{hint}</p> : null}
      </div>
      {action}
    </header>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
    >
      {children}
    </div>
  )
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-control border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink">
      {children}
    </div>
  )
}

// Метка. По умолчанию серая; цвет — только когда он что-то значит.
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'warn'
  children: ReactNode
}) {
  const styles = {
    neutral: 'border-line text-ink-soft',
    accent: 'border-line-strong text-ink',
    success: 'border-line text-ink-soft',
    warn: 'border-warn/30 text-warn',
  }[tone]
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-control border px-1.5 py-0.5 text-[11px] font-medium ${styles}`}
    >
      {children}
    </span>
  )
}

// Технический текст: slug, id, путь к файлу.
export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] text-ink-faint">{children}</span>
}

// Пусто — с подсказкой, что делать дальше.
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-10 text-center">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1 text-[13px] text-ink-soft">{hint}</p> : null}
    </div>
  )
}

export function Loading({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-5 text-[13px] text-ink-faint">
      <Spinner />
      {label}
    </p>
  )
}

// --- Таблицы: плотные, на волосяных линиях, без рамки вокруг ---

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  )
}

export function Th({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      scope="col"
      className={`border-b border-line px-3 py-2 text-left text-[12px] font-normal text-ink-faint ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return <td className={`px-3 py-2 align-middle text-ink ${className}`}>{children}</td>
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line transition-colors duration-120 ease-out hover:bg-surface-2">
      {children}
    </tr>
  )
}

// Строка-подзаголовок внутри таблицы: группирует строки, не заводя вторую таблицу.
export function TrGroup({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="border-b border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink-soft"
      >
        {children}
      </td>
    </tr>
  )
}
