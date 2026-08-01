// Программа эфира: список блоков «книга + глава + темы». За вечер клуб
// разбирает несколько глав и даже книг, поэтому одной пары полей не хватает.
// Порядок блоков = порядок вечера: по нему строятся посты и слайд «Программа».

import { useDataClient, useLoad } from '../lib/hooks'
import { loadChapter } from '../lib/repo'
import type { ContentIndex } from '../types'
import { EventTopicsPicker } from './EventTopicsPicker'
import { Button, Field, Select } from './ui'

/** Блок программы в состоянии формы: книга — папкой (маршруты и файлы по ней). */
export interface ProgramFormBlock {
  folder: string
  chapterSlug: string
  /** Темы именно этой встречи. Пусто — вся глава. */
  topicIds: string[]
}

export function emptyProgramBlock(): ProgramFormBlock {
  return { folder: '', chapterSlug: '', topicIds: [] }
}

function BlockRow({
  index,
  block,
  position,
  total,
  onChange,
  onRemove,
}: {
  index: ContentIndex | null
  block: ProgramFormBlock
  position: number
  total: number
  onChange: (next: ProgramFormBlock) => void
  onRemove: () => void
}) {
  const gh = useDataClient()
  const book = index?.books.find((b) => b.folder === block.folder)

  // Темы главы этого блока — свои у каждого блока, поэтому и загрузка своя.
  const chapter = useLoad(
    async () =>
      block.folder && block.chapterSlug
        ? await loadChapter(gh, block.folder, block.chapterSlug)
        : null,
    [gh, block.folder, block.chapterSlug],
  )
  const topics = (chapter.data?.topics ?? []).map((t) => ({ id: t.id, title: t.title }))

  return (
    <div className="border-t border-line pt-4 first:border-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-soft">
          {total > 1 ? `Блок ${position + 1}` : 'Книга и глава'}
        </p>
        {total > 1 ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Убрать блок программы"
            className="rounded-control px-2 py-1 text-xs text-ink-faint transition-colors duration-120 ease-out hover:bg-danger-soft hover:text-danger active:translate-y-px"
          >
            Убрать
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Книга" hint="из глав этой книги бот предложит темы спикерам">
          <Select
            value={block.folder}
            onChange={(e) =>
              onChange({ folder: e.target.value, chapterSlug: '', topicIds: [] })
            }
          >
            <option value="">— выберите —</option>
            {index?.books.map((b) => (
              <option key={b.folder} value={b.folder}>
                {b.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Глава">
          <Select
            value={block.chapterSlug}
            onChange={(e) => onChange({ ...block, chapterSlug: e.target.value, topicIds: [] })}
            disabled={!book}
          >
            <option value="">— выберите —</option>
            {book?.chapters.map((ch) => (
              <option key={ch.slug} value={ch.slug}>
                {ch.order}. {ch.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <EventTopicsPicker
          chapterSelected={Boolean(book && block.chapterSlug)}
          loading={chapter.loading}
          topics={topics}
          selected={block.topicIds}
          onChange={(topicIds) => onChange({ ...block, topicIds })}
        />
      </div>
    </div>
  )
}

export function ProgramEditor({
  index,
  blocks,
  onChange,
}: {
  index: ContentIndex | null
  blocks: ProgramFormBlock[]
  onChange: (next: ProgramFormBlock[]) => void
}) {
  const list = blocks.length > 0 ? blocks : [emptyProgramBlock()]

  return (
    <div className="space-y-4">
      {list.map((block, i) => (
        <BlockRow
          key={i}
          index={index}
          block={block}
          position={i}
          total={list.length}
          onChange={(next) => onChange(list.map((b, j) => (j === i ? next : b)))}
          onRemove={() => onChange(list.filter((_, j) => j !== i))}
        />
      ))}
      <div className="border-t border-line pt-4">
        <Button variant="ghost" onClick={() => onChange([...list, emptyProgramBlock()])}>
          Добавить главу
        </Button>
        <p className="mt-2 text-xs text-ink-soft">
          Порядок блоков — порядок вечера: по нему бот строит программу в постах,
          а генератор — слайд «Программа вечера».
        </p>
      </div>
    </div>
  )
}
