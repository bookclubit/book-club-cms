// Токен хранится только в браузере админа (localStorage). Сайт CMS публичный,
// но без токена ничего не умеет — весь доступ определяется правами токена.

const KEY = 'book-club-cms-token'

export function getToken(): string | null {
  return localStorage.getItem(KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(KEY, token.trim())
}

export function clearToken(): void {
  localStorage.removeItem(KEY)
}
