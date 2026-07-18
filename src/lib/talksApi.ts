// Интеграция с репозиторием презентаций book-club-talks: запуск генерации
// доклада (repository_dispatch → workflow generate-talk.yml открывает PR) и
// вычисление детерминированного URL опубликованной презентации.

import { GitHubClient } from './github'

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
