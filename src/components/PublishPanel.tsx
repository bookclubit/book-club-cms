import type { PublishState } from '../lib/hooks'
import { Button, ErrorBox } from './ui'

// Панель публикации формы: липнет к низу экрана, чтобы кнопка была под рукой
// в любой длинной форме. Успех показываем на месте панели — без тостов.
export function PublishPanel({
  state,
  onSubmit,
  onReset,
  disabled,
  disabledReason,
  submitLabel = 'Создать pull request',
  updated = false,
}: {
  state: PublishState
  onSubmit: () => void
  onReset: () => void
  disabled?: boolean
  disabledReason?: string
  submitLabel?: string
  // Правки дописаны в уже открытый PR, а не открыт новый.
  updated?: boolean
}) {
  if (state.phase === 'done') {
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-[13px] font-semibold text-ink">
          {updated ? 'Pull request обновлён' : 'Pull request открыт'}
        </p>
        <p className="mt-1.5 text-sm text-ink-soft">
          {updated ? 'Новый коммит в ветке ' : 'Ветка '}
          <span className="font-mono text-xs">{state.result.branch}</span> → PR&nbsp;#
          {state.result.number}. Проверьте изменения и смержите.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={state.result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-control bg-ink px-3 text-[13px] font-medium text-on-accent transition-colors duration-120 ease-out hover:bg-accent-hover"
          >
            Открыть PR на GitHub
          </a>
          <Button variant="ghost" onClick={onReset}>
            Добавить ещё
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky bottom-0 -mx-5 mt-2 border-t border-line bg-canvas px-5 py-3 lg:-mx-10 lg:px-10">
      {state.phase === 'error' && (
        <div className="mb-3">
          <ErrorBox>{state.message}</ErrorBox>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSubmit} disabled={disabled} loading={state.phase === 'working'}>
          {state.phase === 'working' ? 'Публикуем…' : submitLabel}
        </Button>
        {disabled && disabledReason && (
          <span className="text-sm text-ink-faint">{disabledReason}</span>
        )}
      </div>
    </div>
  )
}
