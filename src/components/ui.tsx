import type { ReactNode } from 'react'

// Примитивы CMS. Цвета и шрифты — только через токены из index.css.

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
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  )
}

const controlClass =
  'w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-colors duration-120 ease-out hover:border-line-strong ' +
  'focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

// Кнопка. loading — отдельное состояние: подпись остаётся, курсор ждёт.
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
      'bg-accent text-on-accent hover:bg-accent-hover active:translate-y-px ' +
      'disabled:bg-line-strong disabled:text-ink-faint',
    ghost:
      'border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2 ' +
      'active:translate-y-px disabled:text-ink-faint',
    danger:
      'border border-danger/40 bg-surface text-danger hover:bg-danger-soft ' +
      'active:translate-y-px disabled:text-ink-faint',
  }[variant]

  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,transform] duration-120 ease-out disabled:cursor-not-allowed ${styles} ${props.className ?? ''}`}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

// Спиннер только внутри кнопки: показывается вместе с уже начатым действием.
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
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
    <section
      className={`rounded-card border border-line bg-surface p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  )
}

// Заголовок группы полей внутри карточки.
export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
        {children}
      </h2>
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {hint ? <p className="mt-1.5 text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {action}
    </header>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-control border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {children}
    </div>
  )
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-control border border-success/40 bg-success-soft px-4 py-3 text-sm text-success">
      {children}
    </div>
  )
}

// Метка-статус: нейтральная, успешная, предупреждающая.
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'warn'
  children: ReactNode
}) {
  const styles = {
    neutral: 'border-line bg-surface-2 text-ink-soft',
    accent: 'border-accent/30 bg-accent-soft text-accent',
    success: 'border-success/30 bg-success-soft text-success',
    warn: 'border-warn/30 bg-warn-soft text-warn',
  }[tone]
  return (
    <span
      className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {children}
    </span>
  )
}

// Технический текст: slug, id, путь к файлу.
export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-ink-faint">{children}</span>
}

// Пусто — с подсказкой, что делать дальше.
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1.5 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  )
}

export function Loading({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-ink-soft">
      <Spinner className="text-ink-faint" />
      {label}
    </p>
  )
}

// --- Плотные таблицы: основной способ показать контент в CMS ---

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-sm">{children}</table>
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
      className={`border-b border-line px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint ${className}`}
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
  return <td className={`px-4 py-3 align-middle text-ink ${className}`}>{children}</td>
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line last:border-0 transition-colors duration-120 ease-out hover:bg-surface-2">
      {children}
    </tr>
  )
}
