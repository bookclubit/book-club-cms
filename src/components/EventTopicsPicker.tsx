import type { TopicItem } from './EventTopicClaims'

interface EventTopicsPickerProps {
  chapterSelected: boolean
  loading: boolean
  topics: TopicItem[]
  // Выбранные темы встречи (id). Пусто = вся глава.
  selected: string[]
  onChange: (ids: string[]) => void
}

// Выбор тем главы, которые разбирают именно на этой встрече. Нужен, когда главу
// делят на несколько эфиров — иначе каждая встреча показывала бы все темы главы.
// Ничего не отмечено = вся глава (обратная совместимость: одна встреча на главу).
export function EventTopicsPicker({
  chapterSelected,
  loading,
  topics,
  selected,
  onChange,
}: EventTopicsPickerProps) {
  if (!chapterSelected) {
    return (
      <p className="text-sm text-muted">
        Выберите книгу и главу — темы главы появятся здесь.
      </p>
    )
  }
  if (loading) return <p className="text-sm text-muted">Загружаем темы главы…</p>
  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted">
        В этой главе ещё нет тем. Добавьте их в разделе «Темы».
      </p>
    )
  }

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="space-y-2">
      {topics.map((topic) => (
        <label
          key={topic.id}
          className="flex items-start gap-3 rounded-lg border border-line p-3"
        >
          <input
            type="checkbox"
            checked={selected.includes(topic.id)}
            onChange={() => toggle(topic.id)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-sm">{topic.title}</span>
        </label>
      ))}
      <p className="text-xs text-muted">
        {selected.length === 0
          ? 'Ничего не отмечено — на встрече вся глава.'
          : `На встрече ${selected.length} из ${topics.length} тем главы.`}
      </p>
    </div>
  )
}
