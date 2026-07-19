// Интеграция с репозиторием презентаций book-club-talks: запуск генерации
// доклада (repository_dispatch → workflow generate-talk.yml открывает PR) и
// вычисление детерминированного URL опубликованной презентации.

import type { SpeakerClaim } from './botApi'
import { listSpeakerClaims, setClaimSlides } from './botApi'
import { GitHubClient } from './github'
import { loadBookMeta, loadChapter } from './repo'
import type { ContentIndex, LiveTalkEvent } from '../types'

export const TALKS_OWNER = 'bookclubit'
export const TALKS_REPO = 'book-club-talks'

export function talksClient(token: string): GitHubClient {
  return new GitHubClient(token, TALKS_OWNER, TALKS_REPO)
}

export interface NewTalkPayload {
  book: string // folder или id книги в book-club-data
  chapter: string // slug главы или её номер
  topic: string // индекс (с 1), id или точное название темы
  speaker: string // id спикера
  stream: number // номер стрима
  seq?: string // порядковый (если у спикера в стриме несколько докладов)
}

/** Запускает генерацию доклада и открытие PR в book-club-talks. */
export async function dispatchNewTalk(token: string, payload: NewTalkPayload): Promise<void> {
  await talksClient(token).repositoryDispatch('new-talk', {
    ...payload,
    stream: String(payload.stream),
    seq: payload.seq ?? '',
  })
}

/**
 * Детерминированный URL опубликованной презентации.
 * Папка доклада: BC-<stream>-<CODE>-<номер главы>-<ФАМИЛИЯ>[-<seq>];
 * проект/адрес — то же имя в нижнем регистре: https://<project>.pages.dev
 */
export function slidesUrl(opts: {
  stream: number
  code: string
  chapterOrder: number
  speakerId: string
  seq?: string
}): string {
  const surname = opts.speakerId.split('-')[0].toUpperCase()
  const parts = ['BC', String(opts.stream), opts.code, String(opts.chapterOrder), surname]
  if (opts.seq) parts.push(opts.seq)
  return `https://${parts.join('-').toLowerCase()}.pages.dev`
}

// Порядковый номер темы внутри главы (хвост topic_id: «...-1-4» → 4).
function topicOrder(topicId: string): number {
  const n = Number(topicId.split('-').pop())
  return Number.isFinite(n) ? n : 0
}

// Суффикс seq для имени папки доклада. Нужен, только когда у ОДНОГО спикера в
// этой главе несколько тем — иначе папки/URL совпадут (BC-<стрим>-<КНИГА>-<глава>-<ФАМИЛИЯ>
// темы не различает). seq = порядок темы среди тем этого спикера (1-based, по topic_id).
// Одна тема у спикера → без суффикса (чистое имя, как раньше).
function seqForClaim(claim: SpeakerClaim, all: SpeakerClaim[]): string | undefined {
  const siblings = all
    .filter(
      (c) =>
        c.topic_id &&
        c.speaker_id === claim.speaker_id &&
        c.book_id === claim.book_id &&
        c.chapter === claim.chapter,
    )
    .sort((a, b) => topicOrder(a.topic_id!) - topicOrder(b.topic_id!))
  if (siblings.length <= 1) return undefined
  const idx = siblings.findIndex((c) => c.topic_id === claim.topic_id)
  return String(idx + 1)
}

// Номер стрима встречи-«доклады» по книге+главе (из JSON событий).
async function findStream(
  gh: GitHubClient,
  index: ContentIndex,
  bookId: string,
  chapter: string,
): Promise<number | null> {
  for (const path of index.events.filter((p) => p.startsWith('live-talks/'))) {
    const ev = await gh.getFileJson<LiveTalkEvent>(`events/${path}`)
    if (ev?.book_id === bookId && ev.chapter === chapter && ev.stream) return ev.stream
  }
  return null
}

// Имя ветки/папки доклада из URL слайдов: хост в верхнем регистре
// (https://bc-114-ai-1-nikiforov-1.pages.dev → BC-114-AI-1-NIKIFOROV-1).
export function branchFromSlides(slidesUrl: string): string | null {
  try {
    return new URL(slidesUrl).hostname.split('.')[0].toUpperCase()
  } catch {
    return null
  }
}

/**
 * Убирает за отменённой заявкой хвост в book-club-talks: закрывает открытый PR
 * доклада и удаляет его ветку. Best-effort — молча пропускает, если ветки/PR уже
 * нет. Возвращает имя вычищенной ветки (или null, если чистить нечего).
 */
export async function cleanupTalkForClaim(
  claim: SpeakerClaim,
  githubToken: string,
): Promise<string | null> {
  if (!claim.slides_url) return null
  const branch = branchFromSlides(claim.slides_url)
  if (!branch) return null

  const gh = talksClient(githubToken)
  const prs = await gh.listPullRequestsByHead(branch)
  for (const pr of prs) await gh.closePullRequest(pr.number)
  await gh.deleteBranch(branch)
  return branch
}

/**
 * Генерация презентации по заявке (единый источник — D1): считает URL, открывает
 * PR в book-club-talks и проставляет slides_url в заявку (бот уведомит спикера).
 * Возвращает URL слайдов. Бросает понятную ошибку, если данных не хватает.
 */
export async function generateTalkForClaim(
  gh: GitHubClient,
  index: ContentIndex,
  claim: SpeakerClaim,
  githubToken: string,
): Promise<string> {
  if (!claim.topic_id) throw new Error('Тема вне плана — генерация недоступна')
  if (!claim.speaker_id) {
    throw new Error('У заявки нет каталожного спикера (укажите Telegram спикера, чтобы связать)')
  }
  if (!claim.book_id || !claim.chapter) throw new Error('У заявки нет книги/главы')

  const book = index.books.find((b) => b.id === claim.book_id)
  if (!book) throw new Error('Книга заявки не найдена в реестре')

  const meta = await loadBookMeta(gh, book.folder)
  if (!meta?.code) throw new Error('У книги нет кода (задайте в форме книги: DOCKER, REACT…)')

  const chapter = await loadChapter(gh, book.folder, claim.chapter)
  if (!chapter) throw new Error('Глава не найдена в book-club-data')

  const stream = await findStream(gh, index, claim.book_id, claim.chapter)
  if (!stream) throw new Error('У встречи не задан номер стрима — укажите его в форме встречи')

  // Несколько тем одного спикера в главе → уникальный суффикс, иначе папки совпадут.
  const seq = seqForClaim(claim, await listSpeakerClaims())

  const url = slidesUrl({
    stream,
    code: meta.code,
    chapterOrder: chapter.order,
    speakerId: claim.speaker_id,
    seq,
  })
  await dispatchNewTalk(githubToken, {
    book: book.folder,
    chapter: claim.chapter,
    topic: claim.topic_title,
    speaker: claim.speaker_id,
    stream,
    seq,
  })
  await setClaimSlides(claim.topic_id, url)
  return url
}
