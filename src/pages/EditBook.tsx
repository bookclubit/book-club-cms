import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ImagePicker } from '../components/ImagePicker'
import { PublishPanel } from '../components/PublishPanel'
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Select,
  TextArea,
  TextInput,
} from '../components/ui'
import { AVATAR_OPTS, COVER_OPTS } from '../lib/image'
import { useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadBookMeta, mediaUrl } from '../lib/repo'
import { slugify } from '../lib/slug'
import { BOOK_CATEGORIES, type BookCategory, type BookMeta, type BookStatus } from '../types'

interface AuthorEdit {
  name: string
  avatarPath?: string // существующая аватарка в репозитории
  newAvatar: Uint8Array | null // замена (если выбрана)
}

// Редактирование книги: meta.json + при необходимости обложка/аватарки/index.json.
// Папка и id не меняются — на них завязаны пути файлов и ссылки потребителей.
export function EditBook() {
  const { folder = '' } = useParams()
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const meta = useLoad(() => loadBookMeta(gh, folder), [gh, folder])

  const [title, setTitle] = useState('')
  const [titleOriginal, setTitleOriginal] = useState('')
  const [edition, setEdition] = useState('')
  const [status, setStatus] = useState<BookStatus>('planned')
  const [category, setCategory] = useState<'' | BookCategory>('')
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [totalChapters, setTotalChapters] = useState('')
  const [newCover, setNewCover] = useState<Uint8Array | null>(null)
  const [authors, setAuthors] = useState<AuthorEdit[]>([])

  // Предзаполнение формы загруженным meta.json.
  useEffect(() => {
    const m = meta.data
    if (!m) return
    setTitle(m.title)
    setTitleOriginal(m.title_original ?? '')
    setEdition(m.edition ? String(m.edition) : '')
    setStatus(m.status)
    setCategory(m.category ?? '')
    setTags(m.tags.join(', '))
    setDescription(m.description)
    setTotalChapters(String(m.total_chapters))
    setAuthors(
      m.authors.map((a) => ({ name: a.name, avatarPath: a.avatar, newAvatar: null })),
    )
  }, [meta.data])

  const filledAuthors = authors.filter((a) => a.name.trim())
  const ready =
    Boolean(meta.data && index && title.trim() && description.trim()) &&
    Number(totalChapters) > 0 &&
    filledAuthors.length > 0

  function submit() {
    const current = meta.data
    if (!current || !index) return
    publish(async () => {
      const files: FileChange[] = []

      const coverPath = current.cover ?? `/media/covers/${current.id}.webp`
      const next: BookMeta = {
        id: current.id,
        title: title.trim(),
        ...(titleOriginal.trim() ? { title_original: titleOriginal.trim() } : {}),
        ...(Number(edition) > 0 ? { edition: Number(edition) } : {}),
        authors: filledAuthors.map((a) => ({
          name: a.name.trim(),
          ...(a.newAvatar
            ? { avatar: `/media/authors/${slugify(a.name)}.webp` }
            : a.avatarPath
              ? { avatar: a.avatarPath }
              : {}),
        })),
        status,
        ...(category ? { category } : {}),
        ...(newCover || current.cover ? { cover: coverPath } : {}),
        tags: tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        description: description.trim(),
        total_chapters: Number(totalChapters),
      }

      files.push({ path: `books/${folder}/meta.json`, content: toJSON(next) })
      if (newCover) {
        files.push({ path: coverPath.replace(/^\//, ''), content: newCover })
      }
      for (const a of filledAuthors) {
        if (a.newAvatar) {
          files.push({
            path: `media/authors/${slugify(a.name)}.webp`,
            content: a.newAvatar,
          })
        }
      }

      const nextIndex = structuredClone(index)
      const entry = nextIndex.books.find((b) => b.folder === folder)
      if (entry) {
        entry.title = next.title
        entry.status = status
        if (category) entry.category = category
        else delete entry.category
      }
      if (status === 'reading') nextIndex.active_book = folder
      files.push({ path: 'index.json', content: toJSON(nextIndex) })

      return openContentPR(gh, {
        branch: `cms/edit-book-${folder}`,
        title: `fix(books): обновить книгу «${next.title}»`,
        body: [
          `Правки книги **${next.title}** (\`books/${folder}\`).`,
          '',
          `- \`books/${folder}/meta.json\``,
          newCover ? `- заменена обложка \`${coverPath.replace(/^\//, '')}\`` : null,
          ...filledAuthors
            .filter((a) => a.newAvatar)
            .map((a) => `- заменён аватар \`media/authors/${slugify(a.name)}.webp\``),
          '- обновлён `index.json`',
          '',
          '_Обновлено через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files,
      })
    })
  }

  if (meta.loading) return <p className="text-sm text-muted">Загружаем meta.json…</p>
  if (meta.error) return <ErrorBox>{meta.error}</ErrorBox>
  if (!meta.data) {
    return (
      <ErrorBox>
        Книга <code>{folder}</code> не найдена. <Link to="/books" className="underline">К списку</Link>
      </ErrorBox>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Редактирование <code>books/{folder}</code> · id <code>{meta.data.id}</code>{' '}
        (папка и id не меняются)
      </p>

      <Card>
        <div className="space-y-4">
          <Field label="Название (рус)">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Оригинальное название">
            <TextInput
              value={titleOriginal}
              onChange={(e) => setTitleOriginal(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Статус">
              <Select value={status} onChange={(e) => setStatus(e.target.value as BookStatus)}>
                <option value="planned">planned — в планах</option>
                <option value="reading">reading — читаем</option>
                <option value="finished">finished — прочитана</option>
              </Select>
            </Field>
            <Field label="Категория" hint="вкладка в списке книг">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as '' | BookCategory)}
              >
                <option value="">— без категории —</option>
                {BOOK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Издание">
              <TextInput
                type="number"
                min={1}
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
              />
            </Field>
            <Field label="Всего глав">
              <TextInput
                type="number"
                min={1}
                value={totalChapters}
                onChange={(e) => setTotalChapters(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Теги" hint="через запятую">
            <TextInput value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <Field label="Описание">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="flex items-start gap-4">
            {meta.data.cover && !newCover && (
              <img
                src={mediaUrl(meta.data.cover)}
                alt="текущая обложка"
                className="h-20 w-14 shrink-0 rounded-lg border border-line object-cover"
              />
            )}
            <div className="grow">
              <ImagePicker
                label="Обложка"
                hint={meta.data.cover ? 'Выберите файл, чтобы заменить текущую' : 'Обложки ещё нет'}
                opts={COVER_OPTS}
                onChange={setNewCover}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-medium">Авторы</p>
        <div className="space-y-4">
          {authors.map((author, i) => (
            <div key={i} className="rounded-xl border border-line p-4">
              <div className="mb-3 flex items-end gap-3">
                <div className="grow">
                  <Field label={`Автор ${i + 1}`}>
                    <TextInput
                      value={author.name}
                      onChange={(e) =>
                        setAuthors(authors.map((a, j) => (j === i ? { ...a, name: e.target.value } : a)))
                      }
                    />
                  </Field>
                </div>
                {authors.length > 1 && (
                  <Button variant="danger" onClick={() => setAuthors(authors.filter((_, j) => j !== i))}>
                    Удалить
                  </Button>
                )}
              </div>
              <div className="flex items-start gap-4">
                {author.avatarPath && !author.newAvatar && (
                  <img
                    src={mediaUrl(author.avatarPath)}
                    alt="текущий аватар"
                    className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
                  />
                )}
                <div className="grow">
                  <ImagePicker
                    label="Аватар"
                    hint={author.avatarPath ? 'Выберите файл, чтобы заменить' : 'опционально'}
                    opts={AVATAR_OPTS}
                    onChange={(bytes) =>
                      setAuthors((prev) => prev.map((a, j) => (j === i ? { ...a, newAvatar: bytes } : a)))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() => setAuthors([...authors, { name: '', newAvatar: null }])}
          >
            + Ещё автор
          </Button>
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Название, описание, число глав и минимум один автор обязательны"
        submitLabel="Создать pull request с правками"
      />
    </div>
  )
}
