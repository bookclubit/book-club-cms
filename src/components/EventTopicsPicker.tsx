/** Пункт списка — доклад: у объединённых тем он один на всю группу. */
export interface TopicPickerItem {
  id: string
  title: string
  /** Все темы пункта: у объединённых их несколько, отмечаются вместе. */
  ids: string[]
}

interface EventTopicsPickerProps {
  chapterSelected: boolean
  loading: boolean
  topics: TopicPickerItem[]
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
      <p className="text-sm text-ink-soft">
        Выберите книгу и главу — темы главы появятся здесь.
      </p>
    )
  }
  if (loading) return <p className="text-sm text-ink-soft">Загружаем темы главы…</p>
  if (topics.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        В этой главе ещё нет тем. Добавьте их в разделе «Темы».
      </p>
    )
  }

  // Объединённые темы отмечаются целиком: разложить доклад по двум эфирам
  // нельзя, а фильтры встречи всё равно работают по id каждой темы.
  function toggle(ids: string[]) {
    const on = ids.every((id) => selected.includes(id))
    onChange(on ? selected.filter((x) => !ids.includes(x)) : [...selected, ...ids.filter((id) => !selected.includes(id))])
  }

  return (
    <div className="space-y-2">
      {topics.map((topic) => (
        <label
          key={topic.id}
          className="flex items-start gap-3 rounded-control border border-line p-3"
        >
          <input
            type="checkbox"
            checked={topic.ids.every((id) => selected.includes(id))}
            onChange={() => toggle(topic.ids)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-sm">{topic.title}</span>
        </label>
      ))}
      <p className="text-xs text-ink-soft">
        {selected.length === 0
          ? 'Ничего не отмечено — на встрече вся глава.'
          : `На встрече ${selected.length} тем главы (докладов: ${
              topics.filter((t) => t.ids.every((id) => selected.includes(id))).length
            }).`}
      </p>
    </div>
  )
}
