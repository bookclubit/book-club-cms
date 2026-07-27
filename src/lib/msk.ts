// Время клуба — московское. Все встречи и расписания постов задаются в МСК,
// поэтому поле «когда публиковать» не должно зависеть от часового пояса
// браузера: значение input[type=datetime-local] читаем и пишем как МСК (+03:00,
// без переходов на летнее время).

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

/** epoch ms → «2026-07-31T22:50» для input[type=datetime-local] (в МСК). */
export function mskInputValue(ms: number): string {
  return new Date(ms + MSK_OFFSET_MS).toISOString().slice(0, 16)
}

/** «2026-07-31T22:50» из input → epoch ms (значение трактуем как МСК). */
export function mskInputToMs(value: string): number | null {
  const ms = Date.parse(`${value}:00+03:00`)
  return Number.isFinite(ms) ? ms : null
}

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

/** epoch ms → «31 июля, 22:50 МСК» для показа в интерфейсе. */
export function mskLabel(ms: number): string {
  const at = new Date(ms + MSK_OFFSET_MS)
  const day = at.getUTCDate()
  const month = MONTHS[at.getUTCMonth()]
  const time = at.toISOString().slice(11, 16)
  return `${day} ${month}, ${time} МСК`
}
