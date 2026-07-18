import { Field, TextInput } from './ui'
import { SPEAKER_SOCIALS } from '../types'
import type { SpeakerSocial } from '../types'

// Поля ссылок на соцсети спикера. Пустое поле = соцсеть не показывается.
export function SpeakerSocialsFields({
  value,
  onChange,
}: {
  value: Record<SpeakerSocial, string>
  onChange: (next: Record<SpeakerSocial, string>) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SPEAKER_SOCIALS.map((s) => (
        <Field key={s.id} label={s.label}>
          <TextInput
            type="url"
            inputMode="url"
            placeholder={s.placeholder}
            value={value[s.id]}
            onChange={(e) => onChange({ ...value, [s.id]: e.target.value })}
          />
        </Field>
      ))}
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

// Собирает объект соцсетей для index.json (только непустые).
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
