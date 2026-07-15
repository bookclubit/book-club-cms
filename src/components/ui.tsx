import type { ReactNode } from 'react'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={inputClass} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />
}

export function Button({
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const styles = {
    primary:
      'bg-ink text-white hover:bg-ink/85 disabled:bg-ink/40 disabled:cursor-not-allowed',
    ghost: 'border border-line bg-white hover:border-ink/30',
    danger: 'border border-red-200 bg-white text-red-600 hover:border-red-400',
  }[variant]
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${styles} ${props.className ?? ''}`}
    />
  )
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">{children}</h2>
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  )
}
