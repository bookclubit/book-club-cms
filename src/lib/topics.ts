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

// ---------- объединение тем в один доклад ----------
// Спикер иногда берёт две-три соседние темы и рассказывает их вместе. Такие
// темы помечены общим `talk_group` (id ведущей темы): в главе они остаются
// отдельными, а всюду, где речь о докладе — слоты вечера, заявка, слайды —
// идут одной строкой через запятую.

export function talkGroupKey(topic: Topic): string {
  return topic.talk_group?.trim() || topic.id
}

export interface TopicGroup {
  key: string
  topics: Topic[]
}

/** Темы главы по докладам, в порядке их появления в главе. */
export function topicGroups(topics: Topic[]): TopicGroup[] {
  const groups: TopicGroup[] = []
  const byKey = new Map<string, TopicGroup>()
  for (const topic of topics) {
    const key = talkGroupKey(topic)
    const group = byKey.get(key)
    if (group) group.topics.push(topic)
    else {
      const created = { key, topics: [topic] }
      byKey.set(key, created)
      groups.push(created)
    }
  }
  return groups
}

export function groupTitle(topics: Topic[]): string {
  return topics.map((t) => t.title).join(', ')
}

function uniq(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))]
}

/**
 * Темы «как их видит доклад»: объединённые склеены в одну с названием через
 * запятую и общими материалами. id группы — id её первой темы: на него
 * заводится заявка в D1 и по нему считается монтажный ролик встречи.
 */
export function mergeTalkTopics<T extends Topic>(topics: T[]): T[] {
  return topicGroups(topics).map(({ topics: group }) => {
    const [lead] = group as T[]
    if (group.length === 1) return lead
    return {
      ...lead,
      title: groupTitle(group),
      speakers: uniq(group.flatMap((t) => t.speakers ?? [])),
      video_youtube: group.map((t) => t.video_youtube?.trim()).find(Boolean) ?? '',
      video_vk: group.map((t) => t.video_vk?.trim()).find(Boolean) ?? '',
      presentation: group.map((t) => t.presentation?.trim()).find(Boolean) ?? '',
      resources: uniq(group.flatMap((t) => t.resources ?? [])),
    }
  })
}

/**
 * Объединяет отмеченные темы в один доклад. Ключ группы — id первой из них
 * по порядку главы; уже объединённые темы, попавшие в выбор, присоединяются
 * целыми группами, иначе группа развалилась бы наполовину.
 */
export function mergeTopics(topics: Topic[], ids: string[]): Topic[] {
  const picked = new Set(ids)
  const keys = new Set(topics.filter((t) => picked.has(t.id)).map(talkGroupKey))
  const members = topics.filter((t) => picked.has(t.id) || keys.has(talkGroupKey(t)))
  if (members.length < 2) return topics
  const key = members[0].id
  return topics.map((t) => (members.includes(t) ? { ...t, talk_group: key } : t))
}

/** Разбирает группу обратно на самостоятельные темы. */
export function splitGroup(topics: Topic[], key: string): Topic[] {
  return topics.map((t) => {
    if (talkGroupKey(t) !== key) return t
    const { talk_group: _drop, ...rest } = t
    return rest
  })
}
