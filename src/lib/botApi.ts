// API бота (Cloudflare Worker): заявки спикеров и их модерация.
// Админ-токен (= секрет ADMIN_API_TOKEN воркера) хранится в localStorage,
// как и GitHub-токен.

const BOT_API = 'https://book-club-bot.vitrumbeta.workers.dev'
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

/** Фото спикера из Telegram (JPEG) — для конвертации в WebP при оформлении. */
export async function fetchClaimPhoto(id: number): Promise<Blob> {
  const res = await adminFetch(`/api/admin/photo?claim=${id}`)
  return res.blob()
}
