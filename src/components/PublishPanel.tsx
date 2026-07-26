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
}: {
  state: PublishState
  onSubmit: () => void
  onReset: () => void
  disabled?: boolean
  disabledReason?: string
  submitLabel?: string
}) {
  if (state.phase === 'done') {
    return (
      <div className="rounded-card border border-success/40 bg-success-soft p-5">
        <p className="font-display font-semibold text-success">Pull request открыт</p>
        <p className="mt-1.5 text-sm text-ink-soft">
          Ветка <span className="font-mono text-xs">{state.result.branch}</span> → PR&nbsp;#
          {state.result.number}. Проверьте изменения и смержите.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={state.result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center whitespace-nowrap rounded-control bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors duration-120 ease-out hover:bg-accent-hover"
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
    <div className="sticky bottom-0 -mx-4 mt-2 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
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
