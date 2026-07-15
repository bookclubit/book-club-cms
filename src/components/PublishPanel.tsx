import type { PublishState } from '../lib/hooks'
import { Button, ErrorBox } from './ui'

// Нижняя панель формы: кнопка публикации, прогресс, результат с ссылкой на PR.
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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="mb-1 font-medium text-emerald-800">Pull request открыт 🎉</p>
        <p className="mb-3 text-sm text-emerald-700">
          Ветка <code className="rounded bg-white/70 px-1">{state.result.branch}</code> →{' '}
          PR&nbsp;#{state.result.number}. Проверьте изменения и смержите.
        </p>
        <div className="flex gap-3">
          <a
            href={state.result.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
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
    <div className="space-y-3">
      {state.phase === 'error' && <ErrorBox>{state.message}</ErrorBox>}
      <div className="flex items-center gap-3">
        <Button
          onClick={onSubmit}
          disabled={disabled || state.phase === 'working'}
        >
          {state.phase === 'working' ? 'Публикуем…' : submitLabel}
        </Button>
        {disabled && disabledReason && (
          <span className="text-sm text-muted">{disabledReason}</span>
        )}
      </div>
    </div>
  )
}
