import { Field, TextInput } from './ui'
import { SPEAKER_SOCIALS } from '../types'
import type { SpeakerSocial } from '../types'

/**
 * Telegram спикера обязателен и должен быть разбираем ботом: по нику бот
 * узнаёт участника клуба и открывает ему темы докладов. Правило повторяет
 * `telegramHandle` в боте (src/lib/speakers.ts) — иначе форма примет ссылку,
 * которую бот не поймёт, и спикер попадёт в заявки как новый человек.
 */
const TELEGRAM_HANDLE =
  /^(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/|@)?([A-Za-z0-9_]{4,32})$/i

/** Ник из ссылки/строки Telegram, иначе null (инвайты t.me/+hash не проходят). */
export function telegramHandle(value: string): string | null {
  const m = value.trim().match(TELEGRAM_HANDLE)
  return m ? m[1].toLowerCase() : null
}

/** Ошибка поля Telegram: пустое или неразбираемое значение. */
export function telegramError(value: string): string | undefined {
  const raw = value.trim()
  if (!raw) return 'обязательно — без него бот не узнает спикера'
  if (!telegramHandle(raw)) return 'нужен ник или ссылка вида t.me/username'
  return undefined
}

/** Готовы ли соцсети к публикации (Telegram обязателен и валиден). */
export function socialsReady(value: Record<SpeakerSocial, string>): boolean {
  return telegramError(value.telegram) === undefined
}

// Поля ссылок на соцсети спикера. Пустое поле = соцсеть не показывается,
// кроме Telegram — он обязателен.
export function SpeakerSocialsFields({
  value,
  onChange,
}: {
  value: Record<SpeakerSocial, string>
  onChange: (next: Record<SpeakerSocial, string>) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SPEAKER_SOCIALS.map((s) => {
        const isTelegram = s.id === 'telegram'
        // Пустое поле ошибкой не мигаем: об обязательности говорит подсказка,
        // а публикацию всё равно не пустит PublishPanel.
        const error = isTelegram && value.telegram.trim() ? telegramError(value.telegram) : undefined
        return (
          <Field
            key={s.id}
            label={isTelegram ? `${s.label} *` : s.label}
            error={error}
            hint={
              isTelegram
                ? 'обязательно: по нику бот узнаёт спикера и открывает ему темы докладов'
                : undefined
            }
          >
            <TextInput
              type={isTelegram ? 'text' : 'url'}
              inputMode="url"
              placeholder={isTelegram ? 'https://t.me/username или @username' : s.placeholder}
              value={value[s.id]}
              onChange={(e) => onChange({ ...value, [s.id]: e.target.value })}
              aria-invalid={error ? true : undefined}
            />
          </Field>
        )
      })}
    </div>
  )
}

// Пустой набор соцсетей — начальное состояние формы.
export const EMPTY_SOCIALS: Record<SpeakerSocial, string> = {
  telegram: '',
  github: '',
  linkedin: '',
  website: '',
}

// Собирает объект соцсетей для speakers.json (только непустые).
export function collectSocials(
  value: Record<SpeakerSocial, string>,
): Partial<Record<SpeakerSocial, string>> {
  const out: Partial<Record<SpeakerSocial, string>> = {}
  for (const s of SPEAKER_SOCIALS) {
    const url = value[s.id].trim()
    if (url) out[s.id] = url
  }
  return out
}
