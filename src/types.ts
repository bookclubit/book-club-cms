// Типы данных book-club-data. Схемы повторяют реальные файлы репозитория
// (books/<folder>/meta.json, chapter.json, events/*.json, flashcards.json).

export interface Author {
  name: string
  avatar?: string
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
  notes_board_url?: string
  call_url?: string
  materials?: EventMaterial[]
}

export interface LiveTalk {
  title: string
  speaker: string
  speaker_id: string
  avatar: string
}

export interface LiveTalkEvent {
  id: string
  type: 'live-talk'
  title: string
  date: string
  time: string
  timezone: string
  streams: { youtube?: string; vk?: string }
  talks: LiveTalk[]
  registration_url?: string
  call_url?: string
  materials?: EventMaterial[]
  /** Книга и глава программы эфира — из них бот предлагает темы спикерам. */
  book_id?: string
  chapter?: string
}

export type ClubEvent = ClosedChapterEvent | LiveTalkEvent

// Единый реестр контента (index.json в корне book-club-data).
// Решает проблему «raw.githubusercontent.com не листает директории»:
// потребители (miniapp, bot) читают его вместо захардкоженных списков,
// а CMS обновляет его в каждом PR.
export interface IndexBook {
  folder: string
  id: string
  title: string
  status: BookStatus
  category?: BookCategory
  chapters: string[]
}

export interface IndexSpeaker {
  id: string
  name: string
  aliases: string[]
  avatar: string
}

export interface ContentIndex {
  version: 1
  active_book: string
  books: IndexBook[]
  events: string[]
  speakers: IndexSpeaker[]
}
