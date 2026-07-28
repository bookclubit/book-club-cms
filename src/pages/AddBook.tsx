import { useState } from 'react'
import { AuthorPicker } from '../components/AuthorPicker'
import { ImagePicker } from '../components/ImagePicker'
import { PublishPanel } from '../components/PublishPanel'
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../components/ui'
import { newAuthorId } from '../lib/authors'
import { AVATAR_OPTS, COVER_OPTS } from '../lib/image'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadSettings, mediaUrl } from '../lib/repo'
import { slugify } from '../lib/slug'
import {
  BOOK_CATEGORIES,
  type BookCategory,
  type BookMeta,
  type BookStatus,
  type IndexAuthor,
} from '../types'

interface AuthorDraft {
  /** id из каталога — у автора, взятого из другой книги; у нового выводится из имени. */
  id?: string
  name: string
  url?: string // ссылка на автора (сайт/профиль)
  avatar: Uint8Array | null // новая аватарка (у автора из каталога не нужна)
  avatarPath?: string // готовая аватарка в репозитории (автор из каталога)
}

// id автора: у выбранного из каталога — его собственный, у нового — транслит имени.
function draftId(author: AuthorDraft): string {
  return author.id?.trim() || newAuthorId(author.name)
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

  // Автор из каталога: подставляем id, имя, ссылку и готовую аватарку.
  // Первая пустая строка занимается вместо добавления новой.
  function pickAuthor(picked: IndexAuthor) {
    const draft: AuthorDraft = {
      id: picked.id,
      name: picked.name,
      ...(picked.url ? { url: picked.url } : {}),
      avatar: null,
      ...(picked.avatar ? { avatarPath: picked.avatar } : {}),
    }
    setAuthors((prev) => {
      const empty = prev.findIndex((a) => !a.name.trim())
      return empty === -1
        ? [...prev, draft]
        : prev.map((a, i) => (i === empty ? draft : a))
    })
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
          id: draftId(a),
          name: a.name.trim(),
          ...(a.url?.trim() ? { url: a.url.trim() } : {}),
          ...(a.avatarPath
            ? { avatar: a.avatarPath }
            : a.avatar
              ? { avatar: `/media/authors/${draftId(a)}.webp` }
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
        // Автор из каталога уже с аватаркой — заново её не загружаем.
        if (author.avatar && !author.avatarPath) {
          files.push({
            path: `media/authors/${draftId(author)}.webp`,
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
            .filter((a) => a.avatar && !a.avatarPath)
            .map((a) => `- аватар автора \`media/authors/${draftId(a)}.webp\``),
          ...filledAuthors
            .filter((a) => a.avatarPath)
            .map((a) => `- автор \`${draftId(a)}\` — из каталога, аватар уже в репозитории`),
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
      <PageHeader
        title="Новая книга"
        hint="meta.json, обложка и авторы — всё одним pull request."
      />

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
        <p className="mb-1 text-sm font-medium">Авторы</p>
        <p className="mb-3 text-xs text-ink-soft">
          Если у автора уже есть книга в клубе — выберите его, чтобы книги собрались
          на одной странице автора.
        </p>
        <div className="mb-5">
          <AuthorPicker
            authors={index?.authors ?? []}
            usedIds={authors.map(draftId).filter(Boolean)}
            onPick={pickAuthor}
          />
        </div>

        <div className="space-y-4">
          {authors.map((author, i) => (
            <div key={i} className="rounded-card border border-line p-4">
              <div className="mb-3 flex items-end gap-3">
                <div className="grow">
                  <Field
                    label={`Автор ${i + 1}`}
                    hint={author.avatarPath ? `из каталога · id ${author.id}` : undefined}
                  >
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
              {/* У автора из каталога аватарка уже в репозитории — только показываем. */}
              {author.avatarPath ? (
                <div className="flex items-center gap-3">
                  <img
                    src={mediaUrl(author.avatarPath)}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
                  />
                  <p className="text-xs text-ink-soft">
                    Аватар из каталога — заменить его можно на странице той книги, где
                    автор уже есть.
                  </p>
                </div>
              ) : (
                <ImagePicker
                  label="Аватар (опционально)"
                  opts={AVATAR_OPTS}
                  onChange={(bytes) =>
                    setAuthors((prev) => prev.map((a, j) => (j === i ? { ...a, avatar: bytes } : a)))
                  }
                />
              )}
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
