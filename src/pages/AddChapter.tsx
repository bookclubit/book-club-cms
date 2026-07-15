import { useMemo, useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { Card, Field, Select, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { pad2, slugify } from '../lib/slug'
import type { Chapter } from '../types'

export function AddChapter() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [folder, setFolder] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [outcome, setOutcome] = useState('')

  const book = index?.books.find((b) => b.folder === folder)

  // Номер главы = следующий за последним существующим (префикс NN- в slug-ах).
  const nextOrder = useMemo(() => {
    if (!book) return 1
    const numbers = book.chapters
      .map((slug) => Number(slug.split('-')[0]))
      .filter((n) => Number.isFinite(n))
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  }, [book])

  const [orderOverride, setOrderOverride] = useState('')
  const order = Number(orderOverride) > 0 ? Number(orderOverride) : nextOrder
  const chapterSlug = `${pad2(order)}-${slugify(title)}`

  const ready = Boolean(book && title.trim() && description.trim() && outcome.trim())
  const slugTaken = book?.chapters.includes(chapterSlug)

  function submit() {
    if (!index || !book) return
    publish(async () => {
      const chapter: Chapter = {
        order,
        title: title.trim(),
        description: description.trim(),
        learning_outcome: outcome.trim(),
        topics: [],
      }

      const nextIndex = structuredClone(index)
      const target = nextIndex.books.find((b) => b.folder === book.folder)!
      target.chapters = [...target.chapters, chapterSlug].sort()

      const files: FileChange[] = [
        {
          path: `books/${book.folder}/chapters/${chapterSlug}/chapter.json`,
          content: toJSON(chapter),
        },
        { path: 'index.json', content: toJSON(nextIndex) },
      ]

      return openContentPR(gh, {
        branch: `cms/chapter-${book.folder}-${pad2(order)}`,
        title: `feat(books): глава ${order} «${chapter.title}» (${book.title})`,
        body: [
          `Глава **${order}. ${chapter.title}** книги **${book.title}**.`,
          '',
          `- \`books/${book.folder}/chapters/${chapterSlug}/chapter.json\``,
          '- обновлён `index.json`',
          '',
          'Темы добавляются отдельными PR через форму «Тема».',
          '',
          '_Создано через Codex CMS._',
        ].join('\n'),
        files,
      })
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <Field label="Книга">
            <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">— выберите книгу —</option>
              {index?.books.map((b) => (
                <option key={b.folder} value={b.folder}>
                  {b.title} ({b.folder})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label="Номер" hint={`следующий: ${nextOrder}`}>
              <TextInput
                type="number"
                min={1}
                value={orderOverride}
                onChange={(e) => setOrderOverride(e.target.value)}
                placeholder={String(nextOrder)}
              />
            </Field>
            <Field
              label="Название главы"
              hint={title ? `папка: ${chapterSlug}${slugTaken ? ' — ⚠️ уже есть' : ''}` : undefined}
            >
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введение в Docker"
              />
            </Field>
          </div>
          <Field label="Описание">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чём глава"
            />
          </Field>
          <Field label="Что узнаешь (learning outcome)">
            <TextArea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Поймёшь…, узнаешь…, научишься…"
            />
          </Field>
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready || slugTaken}
        disabledReason={
          slugTaken ? 'Глава с такой папкой уже есть' : 'Выберите книгу и заполните все поля'
        }
      />
    </div>
  )
}
