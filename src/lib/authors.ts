// Авторы книг. Отдельного файла-каталога в данных нет: автор живёт в meta.json
// своих книг, а `index.json` собирает из них список `authors` — по нему формы
// книги предлагают выбрать уже существующего автора.

import { slugify } from './slug'
import type { Author } from '../types'

/**
 * Ключ автора — то, по чему его книги связываются в одного человека.
 * Правило повторяет генератор реестра (book-club-data/scripts/build-index.mjs)
 * и miniapp: стабильный `id`, иначе имя файла аватарки, иначе имя.
 */
export function authorKey(author: Author): string {
  if (author.id) return author.id
  const file = (author.avatar ?? '').split('/').pop() ?? ''
  const base = file.replace(/\.[a-z0-9]+$/i, '')
  return base || author.name
}

/** id для нового автора: транслит имени в kebab-case. */
export function newAuthorId(name: string): string {
  return slugify(name)
}
