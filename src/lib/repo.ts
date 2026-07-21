// Чтение текущего состояния book-club-data и работа с единым реестром
// index.json. Если index.json ещё не смержен, реестр собирается «с нуля»
// обходом директорий через Contents API.

import type {
  BookMeta,
  Chapter,
  ClubSettings,
  ContentIndex,
  Flashcard,
  IndexBook,
  IndexSpeaker,
} from '../types'
import { GitHubClient } from './github'

export const DATA_OWNER = 'bookclubit'
export const DATA_REPO = 'book-club-data'
export const RAW_BASE = `https://raw.githubusercontent.com/${DATA_OWNER}/${DATA_REPO}/main`

export function dataClient(token: string): GitHubClient {
  return new GitHubClient(token, DATA_OWNER, DATA_REPO)
}

export function mediaUrl(path?: string): string | undefined {
  if (!path) return undefined
  return path.startsWith('http') ? path : `${RAW_BASE}${path}`
}

// «Чему научишься» хранится списком: по пункту на строку, каждый с «- »
// (miniapp показывает его списком). Нормализуем ввод из textarea к этому виду.
export function toBulletList(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n')
}

export async function loadBookMeta(
  gh: GitHubClient,
  folder: string,
): Promise<BookMeta | null> {
  return gh.getFileJson<BookMeta>(`books/${folder}/meta.json`)
}

export async function loadChapter(
  gh: GitHubClient,
  folder: string,
  chapterSlug: string,
): Promise<Chapter | null> {
  return gh.getFileJson<Chapter>(`books/${folder}/chapters/${chapterSlug}/chapter.json`)
}

export async function loadFlashcards(
  gh: GitHubClient,
  folder: string,
): Promise<Flashcard[]> {
  return (await gh.getFileJson<Flashcard[]>(`books/${folder}/flashcards.json`)) ?? []
}

// Полный обход репозитория — источник истины для первичной сборки реестра.
export async function buildIndexFromRepo(gh: GitHubClient): Promise<ContentIndex> {
  const bookDirs = (await gh.listDir('books')) ?? []
  const books: IndexBook[] = []
  for (const dir of bookDirs.filter((e) => e.type === 'dir')) {
    const meta = await loadBookMeta(gh, dir.name)
    if (!meta) continue
    const chapterDirs = (await gh.listDir(`books/${dir.name}/chapters`)) ?? []
    books.push({
      folder: dir.name,
      id: meta.id,
      title: meta.title,
      status: meta.status,
      ...(meta.category ? { category: meta.category } : {}),
      chapters: chapterDirs
        .filter((e) => e.type === 'dir')
        .map((e) => e.name)
        .sort(),
    })
  }

  const events: string[] = []
  for (const kind of ['closed-chapters', 'live-talks']) {
    const files = (await gh.listDir(`events/${kind}`)) ?? []
    for (const f of files.filter((e) => e.type === 'file' && e.name.endsWith('.json'))) {
      events.push(`${kind}/${f.name}`)
    }
  }
  events.sort()

  const speakerFiles = (await gh.listDir('media/speakers')) ?? []
  const speakers: IndexSpeaker[] = speakerFiles
    .filter((e) => e.type === 'file' && e.name.endsWith('.webp'))
    .map((e) => {
      const id = e.name.replace(/\.webp$/, '')
      // id формата <фамилия>-<имя>: pomazkov-anton → имя-заглушка Pomazkov Anton;
      // реальные имена уточняются в index.json вручную или через форму спикера.
      const parts = id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      return {
        id,
        name: parts.length > 1 ? `${parts[1]} ${parts[0]}` : parts[0],
        aliases: [],
        avatar: `/media/speakers/${e.name}`,
      }
    })

  const active =
    books.find((b) => b.status === 'reading')?.folder ?? books[0]?.folder ?? ''

  return { version: 1, active_book: active, books, events, speakers }
}

// Реестр: смерженный index.json, иначе — обход репозитория.
export async function loadIndex(gh: GitHubClient): Promise<ContentIndex> {
  const existing = await gh.getFileJson<ContentIndex>('index.json')
  if (existing) return existing
  return buildIndexFromRepo(gh)
}

// Настройки клуба (settings.json). Файла может ещё не быть — тогда пустые.
export async function loadSettings(gh: GitHubClient): Promise<ClubSettings> {
  const existing = await gh.getFileJson<ClubSettings>('settings.json')
  return existing ?? { version: 1, socials: {} }
}
