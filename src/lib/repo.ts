// Чтение текущего состояния book-club-data. Реестр index.json — ГЕНЕРИРУЕМЫЙ
// файл: GitHub Action в data-репо пересобирает его после каждого мержа из
// содержимого репозитория, поэтому CMS его только читает и не правит в PR-ах.

import type {
  BookMeta,
  Chapter,
  ClubSettings,
  ContentIndex,
  Flashcard,
  SpeakersFile,
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

// Реестр контента — генерируемый index.json (глав без тем в нём нет).
export async function loadIndex(gh: GitHubClient): Promise<ContentIndex> {
  const existing = await gh.getFileJson<ContentIndex>('index.json')
  if (!existing) {
    throw new Error(
      'index.json не найден в book-club-data — он генерируется автоматически после мержа',
    )
  }
  return existing
}

// Спикеры клуба (speakers.json в корне) — источник правды, который CMS правит.
// Переходный период: пока speakers.json не смержен, берём спикеров из index.json.
export async function loadSpeakers(gh: GitHubClient): Promise<SpeakersFile> {
  const existing = await gh.getFileJson<SpeakersFile>('speakers.json')
  if (existing) return existing
  const index = await gh.getFileJson<ContentIndex>('index.json')
  return { version: 1, speakers: index?.speakers ?? [] }
}

// Настройки клуба (settings.json). Файла может ещё не быть — тогда пустые.
export async function loadSettings(gh: GitHubClient): Promise<ClubSettings> {
  const existing = await gh.getFileJson<ClubSettings>('settings.json')
  return existing ?? { version: 1, socials: {} }
}
