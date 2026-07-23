// Типы данных book-club-data. Схемы повторяют реальные файлы репозитория
// (books/<folder>/meta.json, chapter.json, events/*.json, flashcards.json).

export interface Author {
  name: string
  avatar?: string
  /** Ссылка на автора (сайт/профиль) — показывается в презентациях talks. */
  url?: string
}

export type BookStatus = 'reading' | 'planned' | 'finished'

// Категории книг — внутренние вкладки-фильтры в списке книг.
// Клуб читает несколько книг параллельно (чередуя), категории помогают
// не терять их в общем списке.
export type BookCategory = 'base' | 'algorithms' | 'tools' | 'frameworks' | 'ai'

export const BOOK_CATEGORIES: Array<{ id: BookCategory; label: string }> = [
  { id: 'base', label: 'База' },
  { id: 'algorithms', label: 'Алгоритмы' },
  { id: 'tools', label: 'Инструменты' },
  { id: 'frameworks', label: 'Фреймворки' },
  { id: 'ai', label: 'AI' },
]

export interface BookMeta {
  id: string
  title: string
  title_original?: string
  edition?: number
  authors: Author[]
  status: BookStatus
  category?: BookCategory
  cover?: string
  tags: string[]
  description: string
  total_chapters: number
  /** Код книги для генератора презентаций (talks): DOCKER, REACT… */
  code?: string
  /** Ссылка на книгу (издательство/магазин) — показывается в презентациях talks. */
  url?: string
}

export interface TopicRef {
  id: string
  title: string
  file: string
}

export interface Chapter {
  order: number
  title: string
  description: string
  learning_outcome: string
  topics: TopicRef[]
}

export type FlashcardDifficulty = 'easy' | 'medium' | 'hard'

export interface FlashcardQA {
  id: string
  type: 'qa'
  question: string
  answer: string
  chapter: string
  difficulty: FlashcardDifficulty
}

export interface FlashcardCommand {
  id: string
  type: 'command'
  command: string
  result: string
  chapter: string
  difficulty: FlashcardDifficulty
}

export type Flashcard = FlashcardQA | FlashcardCommand

// Доп. материал встречи (статья, конспект, репозиторий…).
export interface EventMaterial {
  title: string
  url: string
}

/** Модератор открытого обсуждения — из числа спикеров клуба. */
export interface EventModerator {
  speaker_id: string
  name: string
  avatar: string
}

/** «Открытое обсуждение» — разбор главы, прийти может любой (стримы + Meet). */
export interface ClosedChapterEvent {
  id: string
  type: 'closed-chapter'
  title: string
  date: string
  time: string
  timezone: string
  book_id: string
  chapter: string
  pages?: { from: number; to: number }
  notes_board_url?: string // доска — ссылка или загруженный файл (raw URL)
  call_url?: string
  streams?: { youtube?: string; vk?: string }
  stream?: number // номер эфира — показывается как «Книжный клуб <stream>»
  moderators?: EventModerator[]
  materials?: EventMaterial[]
  finished?: boolean
}

/**
 * @deprecated Занятость тем живёт в заявках D1 бота (единый источник),
 * поэтому массив talks в событиях всегда пуст. Тип оставлен только ради
 * обратной совместимости формата events/*.json.
 */
export interface LiveTalk {
  title: string
  speaker: string
  speaker_id: string
  avatar: string
  topic_id?: string // id темы главы, к которой привязан доклад
  slides_url?: string // ссылка на презентацию (talks)
}

/** Монтажные ролики докладов встречи: id темы → ссылки на чистовую запись. */
export type EventRecordings = Record<string, { youtube?: string; vk?: string }>

export interface LiveTalkEvent {
  id: string
  type: 'live-talk'
  title: string
  date: string
  time: string
  timezone: string
  streams: { youtube?: string; vk?: string }
  /**
   * @deprecated Всегда пустой массив: занятость тем — в заявках D1 бота.
   * Поле продолжаем записывать для обратной совместимости потребителей.
   */
  talks: LiveTalk[]
  call_url?: string
  materials?: EventMaterial[]
  /** Книга и глава программы эфира — из них бот предлагает темы спикерам. */
  book_id?: string
  chapter?: string
  finished?: boolean
  /** Номер стрима — часть имени папки доклада в talks (BC-<stream>-…). */
  stream?: number
  /**
   * Темы главы, разбираемые именно на этой встрече (id тем). Нужно, когда главу
   * делят на несколько эфиров: каждый показывает только свои темы. Пусто/нет —
   * вся глава (обратная совместимость: одна встреча на главу).
   */
  topic_ids?: string[]
  /** Монтажные ролики докладов (id темы → ссылки); вносит админ после встречи. */
  recordings?: EventRecordings
}

export type ClubEvent = ClosedChapterEvent | LiveTalkEvent

// Единый реестр контента (index.json в корне book-club-data).
// Решает проблему «raw.githubusercontent.com не листает директории»:
// потребители (miniapp, bot) читают его вместо захардкоженных списков.
// Файл ГЕНЕРИРУЕМЫЙ: GitHub Action в book-club-data пересобирает его после
// каждого мержа из содержимого репозитория (meta.json, chapter.json,
// events/*, speakers.json, settings.json). PR-ы CMS его не трогают.
export interface IndexBook {
  folder: string
  id: string
  title: string
  status: BookStatus
  category?: BookCategory
  chapters: string[]
}

export type SpeakerSocial = 'telegram' | 'github' | 'linkedin' | 'website'

export const SPEAKER_SOCIALS: Array<{ id: SpeakerSocial; label: string; placeholder: string }> = [
  { id: 'telegram', label: 'Telegram', placeholder: 'https://t.me/…' },
  { id: 'github', label: 'GitHub', placeholder: 'https://github.com/…' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…' },
  { id: 'website', label: 'Сайт', placeholder: 'https://…' },
]

export interface IndexSpeaker {
  id: string
  name: string
  aliases: string[]
  avatar: string
  bio?: string
  socials?: Partial<Record<SpeakerSocial, string>>
}

export interface ContentIndex {
  version: 1
  active_book: string
  books: IndexBook[]
  events: string[]
  speakers: IndexSpeaker[]
}

// Спикеры клуба (speakers.json в корне book-club-data) — источник правды:
// генератор index.json переносит их в реестр как есть. CMS правит этот файл.
export interface SpeakersFile {
  version: 1
  speakers: IndexSpeaker[]
}

// Настройки клуба (settings.json в корне book-club-data): ссылки на соцсети.
// Общие параметры, не привязанные к контенту; miniapp читает при старте.
export type SocialPlatform = 'telegram' | 'youtube' | 'vk' | 'boosty' | 'github'

export const SOCIAL_PLATFORMS: Array<{ id: SocialPlatform; label: string; placeholder: string }> = [
  { id: 'telegram', label: 'Telegram', placeholder: 'https://t.me/…' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@…' },
  { id: 'vk', label: 'VK', placeholder: 'https://vk.com/…' },
  { id: 'boosty', label: 'Boosty', placeholder: 'https://boosty.to/…' },
  { id: 'github', label: 'GitHub', placeholder: 'https://github.com/…' },
]

export interface ClubSettings {
  version: 1
  socials: Partial<Record<SocialPlatform, string>>
  /**
   * Папка активной книги (books/<folder>) — книга, которую клуб читает сейчас.
   * Источник правды: генератор index.json переносит значение в active_book реестра.
   */
  active_book?: string
}
