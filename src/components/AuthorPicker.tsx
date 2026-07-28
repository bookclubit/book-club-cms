import { mediaUrl } from '../lib/repo'
import type { IndexAuthor } from '../types'

// Выбор автора из уже существующих в клубе (реестр `authors` в index.json).
// Так у человека с несколькими книгами не разъезжаются id, имя и аватар —
// иначе в miniapp он раздвоится и книги не соберутся на одну страницу.
export function AuthorPicker({
  authors,
  usedIds,
  onPick,
}: {
  authors: IndexAuthor[]
  usedIds: string[]
  onPick: (author: IndexAuthor) => void
}) {
  if (authors.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Пока в клубе нет книг с авторами — заполните автора вручную ниже.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {[...authors]
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .map((author) => {
          const used = usedIds.includes(author.id)
          const avatar = mediaUrl(author.avatar)
          return (
            <button
              key={author.id}
              type="button"
              disabled={used}
              onClick={() => onPick(author)}
              title={used ? 'Уже добавлен' : `Книг в клубе: ${author.books.length}`}
              className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-medium transition ${
                used
                  ? 'cursor-default border-line bg-canvas text-ink-faint'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink'
              }`}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : null}
              {author.name}
              {used ? <span aria-hidden="true">✓</span> : null}
            </button>
          )
        })}
    </div>
  )
}
