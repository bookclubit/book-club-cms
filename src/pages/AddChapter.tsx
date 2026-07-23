import { useMemo, useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { Card, Field, Select, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { toBulletList } from '../lib/repo'
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

  // Существующие папки глав — из реального дерева репозитория: в генерируемый
  // index.json попадают только главы с темами, поэтому для нумерации и проверки
  // занятости slug-а его недостаточно.
  const chapterDirs = useLoad(
    async () =>
      folder ? ((await gh.listDir(`books/${folder}/chapters`)) ?? []) : [],
    [gh, folder],
  )
  const existingChapters = useMemo(
    () => (chapterDirs.data ?? []).filter((e) => e.type === 'dir').map((e) => e.name),
    [chapterDirs.data],
  )

  // Номер главы = следующий за последним существующим (префикс NN- в slug-ах).
  const nextOrder = useMemo(() => {
    const numbers = existingChapters
      .map((slug) => Number(slug.split('-')[0]))
      .filter((n) => Number.isFinite(n))
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  }, [existingChapters])

  const [orderOverride, setOrderOverride] = useState('')
  const order = Number(orderOverride) > 0 ? Number(orderOverride) : nextOrder
  const chapterSlug = `${pad2(order)}-${slugify(title)}`

  const ready = Boolean(
    book && title.trim() && description.trim() && outcome.trim() && !chapterDirs.loading,
  )
  const slugTaken = existingChapters.includes(chapterSlug)

  function submit() {
    if (!book) return
    publish(async () => {
      const chapter: Chapter = {
        order,
        title: title.trim(),
        description: description.trim(),
        learning_outcome: toBulletList(outcome),
        topics: [],
      }

      const files: FileChange[] = [
        {
          path: `books/${book.folder}/chapters/${chapterSlug}/chapter.json`,
          content: toJSON(chapter),
        },
      ]

      return openContentPR(gh, {
        branch: `cms/chapter-${book.folder}-${pad2(order)}`,
        title: `feat(books): глава ${order} «${chapter.title}» (${book.title})`,
        body: [
          `Глава **${order}. ${chapter.title}** книги **${book.title}**.`,
          '',
          `- \`books/${book.folder}/chapters/${chapterSlug}/chapter.json\``,
          '',
          '`index.json` пересоберётся автоматически после мержа (глава появится в нём после добавления первой темы).',
          '',
          'Темы добавляются отдельными PR через форму «Тема».',
          '',
          '_Создано через CMS Книжного клуба._',
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
              hint={title ? `папка: ${chapterSlug}${slugTaken ? ' — уже есть' : ''}` : undefined}
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
          <Field label="Чему научишься" hint="по пункту на строку — покажется списком">
            <TextArea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder={'Поймёшь, как…\nУзнаешь, что…\nНаучишься…'}
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
