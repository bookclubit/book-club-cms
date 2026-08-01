import { useMemo, useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { TopicsEditor } from '../components/TopicsEditor'
import { withBulkTitles } from '../lib/topics'
import { Card, CardTitle, Field, PageHeader, Select, TextInput } from '../components/ui'
import { useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { pad2, slugify } from '../lib/slug'
import type { Chapter, Topic } from '../types'

// Глава создаётся одним файлом вместе с темами: chapter.json — единственный
// файл главы, поэтому один PR закрывает всю работу.
export function AddChapter() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [folder, setFolder] = useState('')
  const [title, setTitle] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  // Набранные, но не добавленные кнопкой названия тем — тоже уходят в PR.
  const [bulk, setBulk] = useState('')

  const book = index?.books.find((b) => b.folder === folder)

  // Существующие папки глав — из дерева репозитория: в реестре могут быть
  // не все главы, если между мержами Action ещё не пересобрал index.json.
  const chapterDirs = useLoad(
    async () => (folder ? ((await gh.listDir(`books/${folder}/chapters`)) ?? []) : []),
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
  const slugTaken = existingChapters.includes(chapterSlug)

  const filledTopics = withBulkTitles(topics, bulk, book?.id ?? 'book', order).filter((t) =>
    t.title.trim(),
  )
  const ready = Boolean(book && title.trim() && !chapterDirs.loading)

  function submit() {
    if (!book) return
    publish(async () => {
      const chapter: Chapter = {
        order,
        title: title.trim(),
        topics: filledTopics.map((t) => ({ ...t, title: t.title.trim() })),
      }

      const path = `books/${book.folder}/chapters/${chapterSlug}/chapter.json`
      const files: FileChange[] = [{ path, content: toJSON(chapter) }]

      return openContentPR(gh, {
        branch: `cms/chapter-${book.folder}-${pad2(order)}`,
        title: `feat(books): глава ${order} «${chapter.title}» (${book.title})`,
        body: [
          `Глава **${order}. ${chapter.title}** книги **${book.title}**.`,
          '',
          `- \`${path}\``,
          '',
          filledTopics.length > 0
            ? `Темы главы (${filledTopics.length}):\n${filledTopics
                .map((t, i) => `${i + 1}. ${t.title.trim()}`)
                .join('\n')}`
            : 'Тем пока нет — их можно добавить правкой главы.',
          '',
          '`index.json` пересоберётся автоматически после мержа.',
          '',
          '_Создано через CMS Книжного клуба._',
        ].join('\n'),
        files,
      })
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Новая глава"
        hint="Глава и её темы — один файл chapter.json и один pull request."
      />

      <Card>
        <CardTitle>Глава</CardTitle>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label="Книга">
              <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
                <option value="">— выберите книгу —</option>
                {index?.books.map((b) => (
                  <option key={b.folder} value={b.folder}>
                    {b.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Номер" hint={`следующий: ${nextOrder}`}>
              <TextInput
                type="number"
                min={1}
                className="nums"
                value={orderOverride}
                onChange={(e) => setOrderOverride(e.target.value)}
                placeholder={String(nextOrder)}
              />
            </Field>
          </div>

          {/* Подсказка занимает строку всегда — появляющаяся ошибка не двигает форму. */}
          <Field
            label="Название главы"
            hint={
              title
                ? `books/${folder || '<книга>'}/chapters/${chapterSlug}/chapter.json`
                : 'из названия соберётся папка главы'
            }
            error={slugTaken ? 'Глава с такой папкой уже есть' : undefined}
          >
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введение в Docker"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Название обязательно, остальное дозаполняется после встречи">
          Темы главы
        </CardTitle>
        <TopicsEditor
          topics={topics}
          speakers={index?.speakers ?? []}
          bookId={book?.id ?? 'book'}
          chapterOrder={order}
          onChange={setTopics}
          bulk={bulk}
          onBulkChange={setBulk}
        />
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready || slugTaken}
        disabledReason={
          slugTaken ? 'Смените номер или название' : 'Выберите книгу и введите название главы'
        }
        summary={`тем в PR: ${filledTopics.length}`}
      />
    </div>
  )
}
