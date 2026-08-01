// Прошедшесть встречи — то же правило, что в miniapp (`src/lib/events.ts`)
// и в боте (`src/lib/events.ts`): времени окончания в данных нет, поэтому
// встреча считается прошедшей через EVENT_HOURS после начала. Флаг `finished`
// админа остаётся: им можно убрать встречу из активных раньше.

import type { ClubEvent, ProgramBlock } from '../types'

/** Сколько часов после начала встреча считается идущей. */
export const EVENT_HOURS = 4

/**
 * Программа эфира блоками — то же правило, что в боте и miniapp: новое поле
 * `program`, а у старых встреч книга с главой лежат прямо в событии (это тот
 * же единственный блок).
 */
export function eventProgram(event: ClubEvent | null | undefined): ProgramBlock[] {
  if (!event || event.type !== 'live-talk') return []
  const blocks = (event.program ?? []).filter((b) => b.book_id && b.chapter)
  if (blocks.length > 0) return blocks
  if (!event.book_id || !event.chapter) return []
  return [{ book_id: event.book_id, chapter: event.chapter, topic_ids: event.topic_ids }]
}

export function eventArchived(event: ClubEvent | null | undefined, now = Date.now()): boolean {
  if (!event) return false
  if (event.finished) return true
  // Время в данных — московское (UTC+3). Без времени — по дате.
  const start = Date.parse(`${event.date}T${event.time}:00+03:00`)
  if (Number.isNaN(start)) return event.date < new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10)
  return now >= start + EVENT_HOURS * 3600 * 1000
}
