import { useState } from 'react'
import type { IndexSpeaker, Topic } from '../types'
import { Badge, Button, Field, Mono, TextArea, TextInput } from './ui'

// Редактор тем главы. Тема — строка списка: название всегда на виду,
// ссылки и спикеры раскрываются по клику (их заполняют уже после встречи).

export function emptyTopic(id: string, title = ''): Topic {
  return {
    id,
    title,
    speakers: [],
    video_youtube: '',
    video_vk: '',
    presentation: '',
    resources: [],
  }
}

// id темы: <book-id>-<номер главы>-<номер темы>. Продолжаем нумерацию с
// максимального занятого номера, чтобы id не столкнулись после удалений.
export function nextTopicId(bookId: string, chapterOrder: number, topics: Topic[]): string {
  const prefix = `${bookId}-${chapterOrder}-`
  const used = topics
    .map((t) => (t.id.startsWith(prefix) ? Number(t.id.slice(prefix.length)) : NaN))
    .filter((n) => Number.isFinite(n))
  const next = used.length > 0 ? Math.max(...used) + 1 : topics.length + 1
  return `${prefix}${next}`
}

function speakerName(s: IndexSpeaker): string {
  return s.aliases[0] ?? s.name
}

// Заполненность темы: сколько ссылок уже есть — видно, что осталось дозаполнить.
function materialCount(topic: Topic): number {
  return (
    (topic.video_youtube ? 1 : 0) +
    (topic.video_vk ? 1 : 0) +
    (topic.presentation ? 1 : 0) +
    topic.resources.filter(Boolean).length
  )
}

function TopicRow({
  topic,
  index,
  total,
  speakers,
  onChange,
  onMove,
  onRemove,
}: {
  topic: Topic
  index: number
  total: number
  speakers: IndexSpeaker[]
  onChange: (next: Topic) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const materials = materialCount(topic)

  // Спикеры из файла, которых нет в реестре, тоже показываем — иначе потеряются.
  const known = speakers.map(speakerName)
  const extra = topic.speakers.filter((n) => !known.includes(n))

  function toggleSpeaker(name: string) {
    onChange({
      ...topic,
      speakers: topic.speakers.includes(name)
        ? topic.speakers.filter((s) => s !== name)
        : [...topic.speakers, name],
    })
  }

  return (
    <li className="border-b border-line py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="nums w-6 shrink-0 text-sm text-ink-faint">{index + 1}</span>

        <div className="min-w-32 flex-1">
          <TextInput
            value={topic.title}
            onChange={(e) => onChange({ ...topic, title: e.target.value })}
            placeholder="Название темы"
            aria-label={`Название темы ${index + 1}`}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {topic.speakers.length > 0 ? (
            <Badge tone="accent">{topic.speakers.join(', ')}</Badge>
          ) : (
            <Badge>без спикера</Badge>
          )}
          {materials > 0 ? <Badge>ссылок: {materials}</Badge> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="rounded-control px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-120 ease-out hover:bg-surface-2 hover:text-ink active:translate-y-px"
          >
            {open ? 'Свернуть' : 'Материалы'}
          </button>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Выше"
            className="rounded-control px-2 py-1.5 text-xs text-ink-faint transition-colors duration-120 ease-out hover:bg-surface-2 hover:text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Ниже"
            className="rounded-control px-2 py-1.5 text-xs text-ink-faint transition-colors duration-120 ease-out hover:bg-surface-2 hover:text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Удалить тему"
            className="rounded-control px-2 py-1.5 text-xs text-ink-faint transition-colors duration-120 ease-out hover:bg-danger-soft hover:text-danger active:translate-y-px"
          >
            ✕
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-4 pl-9">
          <p className="text-xs">
            <Mono>id {topic.id}</Mono>{' '}
            <span className="text-ink-faint">
              — на него ссылаются встречи и заявки на доклады, он не меняется
            </span>
          </p>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Спикеры</span>
            <div className="flex flex-wrap gap-1.5">
              {speakers.map((s) => {
                const name = speakerName(s)
                const active = topic.speakers.includes(name)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSpeaker(name)}
                    className={`whitespace-nowrap rounded-control border px-2.5 py-1 text-xs transition-colors duration-120 ease-out ${
                      active
                        ? 'bg-surface-2 font-medium text-ink'
                        : 'text-ink-soft hover:bg-surface-2 hover:text-ink active:translate-y-px'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
              {extra.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={true}
                  onClick={() => toggleSpeaker(name)}
                  className="whitespace-nowrap rounded-control bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Видео YouTube">
              <TextInput
                value={topic.video_youtube}
                onChange={(e) => onChange({ ...topic, video_youtube: e.target.value })}
                placeholder="https://youtu.be/…"
              />
            </Field>
            <Field label="Видео VK">
              <TextInput
                value={topic.video_vk}
                onChange={(e) => onChange({ ...topic, video_vk: e.target.value })}
                placeholder="https://vk.com/video…"
              />
            </Field>
          </div>

          <Field label="Презентация">
            <TextInput
              value={topic.presentation}
              onChange={(e) => onChange({ ...topic, presentation: e.target.value })}
              placeholder="https://…"
            />
          </Field>

          <Field label="Доп. материалы" hint="по одной ссылке на строку">
            <TextArea
              rows={2}
              value={topic.resources.join('\n')}
              onChange={(e) =>
                onChange({ ...topic, resources: e.target.value.split('\n') })
              }
              placeholder={'https://docs.docker.com\nhttps://github.com/…'}
            />
          </Field>
        </div>
      ) : null}
    </li>
  )
}

export function TopicsEditor({
  topics,
  speakers,
  bookId,
  chapterOrder,
  onChange,
}: {
  topics: Topic[]
  speakers: IndexSpeaker[]
  bookId: string
  chapterOrder: number
  onChange: (next: Topic[]) => void
}) {
  const [bulk, setBulk] = useState('')

  function addBulk() {
    const titles = bulk
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
    if (titles.length === 0) return
    const next = [...topics]
    for (const title of titles) {
      next.push(emptyTopic(nextTopicId(bookId, chapterOrder, next), title))
    }
    onChange(next)
    setBulk('')
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= topics.length) return
    const next = [...topics]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      {topics.length > 0 ? (
        <ul className="mb-4">
          {topics.map((topic, i) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              index={i}
              total={topics.length}
              speakers={speakers}
              onChange={(next) => onChange(topics.map((t, j) => (j === i ? next : t)))}
              onMove={(delta) => move(i, delta)}
              onRemove={() => onChange(topics.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-ink-faint">
          Тем пока нет. Впиши названия ниже — по одному на строку.
        </p>
      )}

      {/* Без второй рамки: карточка уже есть, поле ввода отделено линией. */}
      <div className={topics.length > 0 ? 'border-t border-line pt-4' : ''}>
        <Field
          label={topics.length > 0 ? 'Добавить темы' : 'Названия тем'}
          hint="по одному названию на строку; ссылки и спикеров можно проставить позже"
        >
          <TextArea
            rows={3}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'Почему Docker\nАрхитектура Docker\nЖизненный цикл контейнера'}
          />
        </Field>
        <div className="mt-2.5 flex items-center gap-2">
          <Button variant="ghost" onClick={addBulk} disabled={bulk.trim() === ''}>
            Добавить в список
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              onChange([...topics, emptyTopic(nextTopicId(bookId, chapterOrder, topics))])
            }
          >
            Пустая тема
          </Button>
        </div>
      </div>
    </div>
  )
}
