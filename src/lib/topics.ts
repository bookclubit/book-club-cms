// Чистая логика тем главы: заготовка темы, нумерация id и разбор набранных
// названий. Вынесено из компонента, чтобы проверялось запуском, а не глазами.

import type { Topic } from '../types'

export function emptyTopic(id: string, title = ''): Topic {
  return {
    id,
    title,
    speakers: [],
    video_youtube: '',
    video_vk: '',
    presentation: '',
    resources: [],
  }
}

// id темы: <book-id>-<номер главы>-<номер темы>. Продолжаем нумерацию с
// максимального занятого номера, чтобы id не столкнулись после удалений.
export function nextTopicId(bookId: string, chapterOrder: number, topics: Topic[]): string {
  const prefix = `${bookId}-${chapterOrder}-`
  const used = topics
    .map((t) => (t.id.startsWith(prefix) ? Number(t.id.slice(prefix.length)) : NaN))
    .filter((n) => Number.isFinite(n))
  const next = used.length > 0 ? Math.max(...used) + 1 : topics.length + 1
  return `${prefix}${next}`
}

/**
 * Дописывает к темам названия, набранные в поле ввода (по одному на строку).
 *
 * Поле ввода — не «черновик»: формы обязаны прогонять его текст через эту
 * функцию перед публикацией. Иначе набранные названия молча теряются, если
 * человек не нажал «Добавить в список» — так уехали пустыми главы книги
 * «React. К вершинам мастерства» (PR #67–74, июль 2026).
 */
export function withBulkTitles(
  topics: Topic[],
  bulk: string,
  bookId: string,
  chapterOrder: number,
): Topic[] {
  const titles = bulk
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
  const next = [...topics]
  for (const title of titles) {
    next.push(emptyTopic(nextTopicId(bookId, chapterOrder, next), title))
  }
  return next
}
