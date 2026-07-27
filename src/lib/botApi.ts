import type { ClubEvent } from '../types'

// API бота (Cloudflare Worker): заявки спикеров и их модерация.
// Админ-токен (= секрет ADMIN_API_TOKEN воркера) хранится в localStorage,
// как и GitHub-токен.

// URL воркера настраивается через VITE_BOT_API (см. .env.example);
// по умолчанию — прод.
const BOT_API =
  import.meta.env.VITE_BOT_API ?? 'https://book-club-bot.vitrumbeta.workers.dev'
const TOKEN_KEY = 'book-club-bot-admin-token'

export function getBotToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setBotToken(token: string): void {
  if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim())
  else localStorage.removeItem(TOKEN_KEY)
}

/** Заявка спикера (см. speaker_claims в боте). */
export interface SpeakerClaim {
  id: number
  topic_id: string | null
  topic_title: string
  book_id: string | null
  chapter: string | null
  chat_id: number
  username: string | null
  full_name: string | null
  photo_file_id: string | null
  speaker_id: string | null // каталожный спикер, если бот узнал заявителя по Telegram
  slides_url: string | null // ссылка на презентацию (talks)
  status: 'pending' | 'confirmed'
  created_at: number
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getBotToken()
  if (!token) throw new Error('Не задан админ-токен бота (страница входа)')
  const res = await fetch(`${BOT_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const message = await res
      .json()
      .then((d) => (d as { error?: string }).error)
      .catch(() => null)
    throw new Error(message ?? `API бота: HTTP ${res.status}`)
  }
  return res
}

export async function listSpeakerClaims(): Promise<SpeakerClaim[]> {
  const res = await adminFetch('/api/admin/claims')
  const data = (await res.json()) as { claims: SpeakerClaim[] }
  return data.claims
}

export async function decideClaim(id: number, action: 'confirm' | 'decline'): Promise<void> {
  await adminFetch('/api/admin/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action }),
  })
}

async function claimAction(body: Record<string, unknown>): Promise<void> {
  await adminFetch('/api/admin/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Единый источник занятости — D1. CMS назначает/освобождает темы теми же
// заявками, что и бот (см. /api/admin/claims в боте).

/** Назначить спикера каталога на тему — создаёт подтверждённую заявку в D1. */
export async function assignClaim(opts: {
  topicId: string
  topicTitle: string
  bookId: string
  chapter: string
  speakerId: string
  speakerName: string
}): Promise<void> {
  await claimAction({
    action: 'assign',
    topic_id: opts.topicId,
    topic_title: opts.topicTitle,
    book_id: opts.bookId,
    chapter: opts.chapter,
    speaker_id: opts.speakerId,
    speaker_name: opts.speakerName,
  })
}

/** Освободить тему — удаляет заявку по topic_id. */
export async function releaseClaim(topicId: string): Promise<void> {
  await claimAction({ action: 'release', topic_id: topicId })
}

/** Проставить ссылку на презентацию у темы. */
export async function setClaimSlides(topicId: string, slidesUrl: string): Promise<void> {
  await claimAction({ action: 'slides', topic_id: topicId, slides_url: slidesUrl })
}

/** Фото спикера из Telegram (JPEG) — для конвертации в WebP при оформлении. */
export async function fetchClaimPhoto(id: number): Promise<Blob> {
  const res = await adminFetch(`/api/admin/photo?claim=${id}`)
  return res.blob()
}

// ── Заявки на участие в клубе ────────────────────────────────────────────────

/**
 * Заявка на участие (см. membership_requests в боте). Пока её не одобрят,
 * человек не может брать темы докладов — ни в боте, ни в приложении.
 */
export interface MembershipRequest {
  id: number
  chat_id: number
  username: string | null
  full_name: string | null
  /** Сообщение заявителя: о себе и о чём хочет рассказать. */
  about: string | null
  photo_file_id: string | null
  /** Аватар Telegram (у заявок из приложения). */
  photo_url: string | null
  source: 'bot' | 'miniapp'
  status: 'pending' | 'approved' | 'declined'
  created_at: number
  decided_at: number | null
}

export async function listMembers(): Promise<MembershipRequest[]> {
  const res = await adminFetch('/api/admin/members')
  const data = (await res.json()) as { members: MembershipRequest[] }
  return data.members
}

/** Решение по заявке: бот сам сообщит человеку (если он писал боту). */
export async function decideMember(id: number, action: 'approve' | 'decline'): Promise<void> {
  await adminFetch('/api/admin/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action }),
  })
}

/** Фото из заявки на участие (JPEG) — для аватарки при оформлении спикером. */
export async function fetchMemberPhoto(id: number): Promise<Blob> {
  const res = await adminFetch(`/api/admin/photo?member=${id}`)
  return res.blob()
}

// ── Анонсы встреч в группу клуба ─────────────────────────────────────────────

/** Поля встречи, которые бот кладёт в пост (совпадают с events/*.json). */
export interface AnnounceEventPayload {
  id: string
  type: 'closed-chapter' | 'live-talk'
  title: string
  date: string
  time: string
  stream?: number
  book_id?: string
  chapter?: string
  assignment?: string
  pages?: { from: number; to: number }
  streams?: { youtube?: string; vk?: string }
  call_url?: string
  notes_board_url?: string
  materials?: { title: string; url: string }[]
  /** speaker_id нужен боту: по нему он находит Telegram ведущего в каталоге. */
  moderators?: { name: string; speaker_id?: string }[]
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  // Порциями: спред большого массива в String.fromCharCode переполняет стек.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/**
 * Просит бота подготовить посты о встрече: анонс, афишу дня и напоминание.
 * Ничего не публикуется — тексты ждут в разделе «Посты», где их можно
 * поправить и отправить в выбранные группы.
 *
 * Встречу передаём полями формы, а не ссылкой на файл: в book-club-data она
 * появится только после мержа pull request-а, а посты нужны раньше.
 */
export async function announceEvent(
  event: AnnounceEventPayload,
  posters: { announce?: Uint8Array | null; day?: Uint8Array | null },
): Promise<void> {
  await adminFetch('/api/admin/announce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      posters: {
        ...(posters.announce ? { announce: toBase64(posters.announce) } : {}),
        ...(posters.day ? { day: toBase64(posters.day) } : {}),
      },
    }),
  })
}

/**
 * Поля встречи для анонса. Берём только то, что нужно постам: pages,
 * notes_board_url и moderators есть лишь у открытых обсуждений.
 */
export function announcePayload(event: ClubEvent): AnnounceEventPayload {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    date: event.date,
    time: event.time,
    ...(event.stream ? { stream: event.stream } : {}),
    ...(event.book_id ? { book_id: event.book_id } : {}),
    ...(event.chapter ? { chapter: event.chapter } : {}),
    ...(event.assignment ? { assignment: event.assignment } : {}),
    ...(event.streams ? { streams: event.streams } : {}),
    ...(event.call_url ? { call_url: event.call_url } : {}),
    ...(event.materials ? { materials: event.materials } : {}),
    ...(event.type === 'closed-chapter' && event.pages ? { pages: event.pages } : {}),
    ...(event.type === 'closed-chapter' && event.notes_board_url
      ? { notes_board_url: event.notes_board_url }
      : {}),
    ...(event.type === 'closed-chapter' && event.moderators
      ? {
          moderators: event.moderators.map((m) => ({
            name: m.name,
            ...(m.speaker_id ? { speaker_id: m.speaker_id } : {}),
          })),
        }
      : {}),
  }
}

// ── Черновики постов о встрече ───────────────────────────────────────────────

/** Группа или канал клуба, подключённые командой /anons_here. */
export interface AnnounceChat {
  chat_id: number
  title: string | null
  added_at: number
}

/** Пост о встрече, подготовленный ботом и ждущий публикации. */
export interface PostDraft {
  id: number
  event_id: string
  kind: 'announce' | 'day' | 'soon'
  /** «Анонс» / «Афиша дня» / «Напоминание» — заголовок от бота. */
  kind_title: string
  /** Когда такой пост обычно публикуют (подсказка, не расписание). */
  kind_when: string
  event_title: string | null
  event_date: string | null
  event_time: string | null
  text: string
  /** Текст правили руками — пересборка встречи его не затирает. */
  edited: boolean
  has_poster: boolean
  status: 'pending' | 'sent'
  /** Когда админ одобрил текст. Без одобрения расписание недоступно. */
  approved_at: number | null
  /** Время автопубликации (epoch ms) или null — публикуем вручную. */
  scheduled_at: number | null
  /** Куда публиковать по расписанию; null — во все подключённые группы. */
  scheduled_chats: number[] | null
  /** Сколько раз бот уже пытался опубликовать по расписанию. */
  attempts: number
  /** Почему не ушло в последний раз. */
  publish_error: string | null
  /** Подсказанное ботом время публикации — им заполняем поле расписания. */
  suggested_at: number | null
  sent_at: number | null
  sent_to: { chat_id: number; message_id: number | null }[] | null
  updated_at: number
}

export async function listPosts(): Promise<{
  posts: PostDraft[]
  chats: AnnounceChat[]
  max_attempts: number
}> {
  const res = await adminFetch('/api/admin/posts')
  return (await res.json()) as {
    posts: PostDraft[]
    chats: AnnounceChat[]
    max_attempts: number
  }
}

/** Афиша поста для превью: загруженная картинка или файл из Telegram. */
export async function fetchPostPoster(id: number): Promise<Blob> {
  const res = await adminFetch(`/api/admin/posts/poster?id=${id}`)
  return res.blob()
}

async function postAction<T>(body: Record<string, unknown>): Promise<T> {
  const res = await adminFetch('/api/admin/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as T
}

/** Публикация: без chatIds — во все подключённые группы. */
export async function publishPost(
  id: number,
  chatIds?: number[],
): Promise<{ sent_to: { chat_id: number; message_id: number | null }[]; errors: string[] }> {
  return postAction({ action: 'publish', id, ...(chatIds?.length ? { chat_ids: chatIds } : {}) })
}

export async function savePostText(id: number, text: string): Promise<void> {
  await postAction({ action: 'text', id, text })
}

/** Пересобрать текст из данных клуба (книга, глава, спикеры, презентации). */
export async function refreshPostText(id: number): Promise<string> {
  const data = await postAction<{ text: string }>({ action: 'refresh', id })
  return data.text
}

/** «Текст согласован»: открывает планирование публикации. */
export async function approvePost(id: number, approved = true): Promise<void> {
  await postAction({ action: 'approve', id, approved })
}

/**
 * Планирует публикацию на момент `at` (epoch ms) или снимает расписание (null).
 * Бот проверяет расписание каждые 5 минут, поэтому точность — до 5 минут.
 */
export async function schedulePost(
  id: number,
  at: number | null,
  chatIds?: number[],
): Promise<void> {
  await postAction({ action: 'schedule', id, at, ...(chatIds?.length ? { chat_ids: chatIds } : {}) })
}

/** Заменить афишу поста; без `bytes` — убрать картинку совсем. */
export async function setPostPoster(id: number, bytes?: Uint8Array | null): Promise<void> {
  await postAction({ action: 'poster', id, poster: bytes ? toBase64(bytes) : null })
}

export async function deletePost(id: number): Promise<void> {
  await postAction({ action: 'delete', id })
}
