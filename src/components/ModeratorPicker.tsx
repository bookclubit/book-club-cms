import type { IndexSpeaker } from '../types'

// Выбор модераторов открытого обсуждения из числа спикеров (чекбоксы).
export function ModeratorPicker({
  speakers,
  selected,
  onChange,
}: {
  speakers: IndexSpeaker[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  if (speakers.length === 0) {
    return (
      <p className="text-sm text-muted">
        Пока нет спикеров — добавьте их на вкладке «Спикеры», чтобы назначать модераторов.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {speakers.map((s) => {
        const on = selected.includes(s.id)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            aria-pressed={on}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              on
                ? 'bg-ink text-white'
                : 'border border-line bg-white text-muted hover:text-ink'
            }`}
          >
            {s.name}
          </button>
        )
      })}
    </div>
  )
}
