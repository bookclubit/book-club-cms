import { useState } from 'react'
import { ImagePicker } from '../components/ImagePicker'
import { PublishPanel } from '../components/PublishPanel'
import {
  Button,
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from '../components/ui'
import { AVATAR_OPTS, COVER_OPTS } from '../lib/image'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadSettings } from '../lib/repo'
import { slugify } from '../lib/slug'
import { BOOK_CATEGORIES, type BookCategory, type BookMeta, type BookStatus } from '../types'

interface AuthorDraft {
  name: string
  url?: string // ссылка на автора (сайт/профиль)
  avatar: Uint8Array | null
}

export function AddBook() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [title, setTitle] = useState('')
  const [titleOriginal, setTitleOriginal] = useState('')
  const [bookId, setBookId] = useState('')
  const [folder, setFolder] = useState('')
  const [edition, setEdition] = useState('')
  const [status, setStatus] = useState<BookStatus>('planned')
  const [category, setCategory] = useState<'' | BookCategory>('')
  const [tags, setTags] = useState('')
  const [code, setCode] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [totalChapters, setTotalChapters] = useState('')
  const [cover, setCover] = useState<Uint8Array | null>(null)
  const [authors, setAuthors] = useState<AuthorDraft[]>([{ name: '', avatar: null }])

  // Slug-и предлагаются из оригинального названия, но их можно поправить.
  function suggestSlugs(original: string) {
    setTitleOriginal(original)
    const slug = slugify(original)
    if (!folder || folder === slugify(titleOriginal)) setFolder(slug)
    if (!bookId || bookId === slugify(titleOriginal)) setBookId(slug)
  }

  const filledAuthors = authors.filter((a) => a.name.trim())
  const ready =
    Boolean(title.trim() && bookId.trim() && folder.trim() && description.trim()) &&
    Number(totalChapters) > 0 &&
    filledAuthors.length > 0 &&
    Boolean(index)

  const folderTaken = index?.books.some((b) => b.folder === folder.trim())

  function submit() {
    if (!index) return
    publish(async () => {
      const files: FileChange[] = []
      const cleanFolder = folder.trim()
      const cleanId = bookId.trim()

      const meta: BookMeta = {
        id: cleanId,
        title: title.trim(),
        ...(titleOriginal.trim() ? { title_original: titleOriginal.trim() } : {}),
        ...(Number(edition) > 0 ? { edition: Number(edition) } : {}),
        authors: filledAuthors.map((a) => ({
          name: a.name.trim(),
          ...(a.url?.trim() ? { url: a.url.trim() } : {}),
          ...(a.avatar
            ? { avatar: `/media/authors/${slugify(a.name)}.webp` }
            : {}),
        })),
        status,
        ...(category ? { category } : {}),
        ...(cover ? { cover: `/media/covers/${cleanId}.webp` } : {}),
        tags: tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        description: description.trim(),
        total_chapters: Number(totalChapters),
        ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
      }

      files.push({ path: `books/${cleanFolder}/meta.json`, content: toJSON(meta) })
      if (cover) {
        files.push({ path: `media/covers/${cleanId}.webp`, content: cover })
      }
      for (const author of filledAuthors) {
        if (author.avatar) {
          files.push({
            path: `media/authors/${slugify(author.name)}.webp`,
            content: author.avatar,
          })
        }
      }

      // Активная книга живёт в settings.json (генератор index.json читает её оттуда).
      let activeBookChanged = false
      if (status === 'reading') {
        const settings = await loadSettings(gh)
        if (settings.active_book !== cleanFolder) {
          activeBookChanged = true
          files.push({
            path: 'settings.json',
            content: toJSON({ ...settings, active_book: cleanFolder }),
          })
        }
      }

      return openContentPR(gh, {
        branch: `cms/book-${cleanFolder}`,
        title: `feat(books): добавить книгу «${meta.title}»`,
        body: [
          `Новая книга **${meta.title}**${meta.title_original ? ` (${meta.title_original})` : ''}.`,
          '',
          `- \`books/${cleanFolder}/meta.json\``,
          cover ? `- обложка \`media/covers/${cleanId}.webp\`` : null,
          ...filledAuthors
            .filter((a) => a.avatar)
            .map((a) => `- аватар автора \`media/authors/${slugify(a.name)}.webp\``),
          activeBookChanged
            ? `- \`settings.json\`: активная книга — \`${cleanFolder}\``
            : null,
          '',
          '`index.json` пересоберётся автоматически после мержа.',
          '',
          '_Создано через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files,
      })
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <Field label="Название (рус)">
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Docker. Вводный курс"
            />
          </Field>
          <Field label="Оригинальное название">
            <TextInput
              value={titleOriginal}
              onChange={(e) => suggestSlugs(e.target.value)}
              placeholder="Docker: Up & Running"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Папка книги"
              hint={folderTaken ? 'такая папка уже есть' : 'books/<папка>/ — kebab-case'}
            >
              <TextInput value={folder} onChange={(e) => setFolder(e.target.value)} />
            </Field>
            <Field label="ID книги" hint="для обложки, событий и карточек">
              <TextInput value={bookId} onChange={(e) => setBookId(e.target.value)} />
            </Field>
          </div>
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
                placeholder="3"
              />
            </Field>
            <Field label="Всего глав">
              <TextInput
                type="number"
                min={1}
                value={totalChapters}
                onChange={(e) => setTotalChapters(e.target.value)}
                placeholder="8"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Теги" hint="через запятую">
              <TextInput
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="docker, devops, containers"
              />
            </Field>
            <Field label="Код (для презентаций)" hint="в имени папки доклада: DOCKER, REACT">
              <TextInput
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DOCKER"
              />
            </Field>
          </div>
          <Field label="Ссылка на книгу" hint="издательство/магазин — попадёт в презентации">
            <TextInput
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Описание">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чём книга и зачем её читать клубу"
            />
          </Field>
          <ImagePicker
            label="Обложка"
            hint="Любой формат — сконвертируем в WebP 400px"
            opts={COVER_OPTS}
            onChange={setCover}
          />
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
                      placeholder="Sean P. Kane"
                    />
                  </Field>
                </div>
                {authors.length > 1 && (
                  <Button variant="danger" onClick={() => setAuthors(authors.filter((_, j) => j !== i))}>
                    Удалить
                  </Button>
                )}
              </div>
              <div className="mb-3">
                <Field label="Ссылка на автора" hint="сайт/профиль — в презентации кликабельна">
                  <TextInput
                    type="url"
                    value={author.url ?? ''}
                    onChange={(e) =>
                      setAuthors(authors.map((a, j) => (j === i ? { ...a, url: e.target.value } : a)))
                    }
                    placeholder="https://..."
                  />
                </Field>
              </div>
              <ImagePicker
                label="Аватар (опционально)"
                opts={AVATAR_OPTS}
                onChange={(bytes) =>
                  setAuthors((prev) => prev.map((a, j) => (j === i ? { ...a, avatar: bytes } : a)))
                }
              />
            </div>
          ))}
          <Button variant="ghost" onClick={() => setAuthors([...authors, { name: '', avatar: null }])}>
            + Ещё автор
          </Button>
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready || folderTaken}
        disabledReason={
          folderTaken
            ? 'Книга с такой папкой уже существует'
            : 'Заполните название, папку, id, описание, число глав и минимум одного автора'
        }
      />
    </div>
  )
}
