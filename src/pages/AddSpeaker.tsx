import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ImagePicker } from '../components/ImagePicker'
import { PublishPanel } from '../components/PublishPanel'
import {
  collectSocials,
  EMPTY_SOCIALS,
  SpeakerSocialsFields,
} from '../components/SpeakerSocialsFields'
import { Card, Field, TextArea, TextInput } from '../components/ui'
import { fetchClaimPhoto, listSpeakerClaims } from '../lib/botApi'
import { AVATAR_OPTS, fileToWebP } from '../lib/image'
import { useDataClient, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadSpeakers } from '../lib/repo'
import { slugify } from '../lib/slug'
import type { SpeakerSocial } from '../types'

export function AddSpeaker() {
  const gh = useDataClient()
  // Спикеры живут в speakers.json (генератор index.json читает их оттуда).
  const speakersFile = useLoad(() => loadSpeakers(gh), [gh])
  const { state, publish, reset } = usePublish()
  const [params] = useSearchParams()

  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [bio, setBio] = useState('')
  const [socials, setSocials] = useState<Record<SpeakerSocial, string>>(EMPTY_SOCIALS)
  const [avatar, setAvatar] = useState<Uint8Array | null>(null)
  const [prefillPreview, setPrefillPreview] = useState<string | null>(null)
  const [prefillNote, setPrefillNote] = useState<string | null>(null)

  // ?claim=<id> — предзаполнение из заявки спикера (страница «Заявки»).
  const claimId = Number(params.get('claim'))
  useEffect(() => {
    if (!Number.isFinite(claimId) || claimId <= 0) return
    let cancelled = false
    ;(async () => {
      try {
        const claim = (await listSpeakerClaims()).find((c) => c.id === claimId)
        if (!claim || cancelled) return
        const parts = (claim.full_name ?? '').trim().split(/\s+/)
        if (parts.length > 0) setFirstName(parts[0])
        if (parts.length > 1) setSurname(parts.slice(1).join(' '))
        setPrefillNote(`Из заявки #${claim.id}: «${claim.topic_title}»`)
        if (claim.photo_file_id) {
          const blob = await fetchClaimPhoto(claim.id)
          const file = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })
          const bytes = await fileToWebP(file, AVATAR_OPTS)
          if (cancelled) return
          setAvatar(bytes)
          setPrefillPreview(URL.createObjectURL(new Blob([bytes.slice()], { type: 'image/webp' })))
        }
      } catch (err) {
        if (!cancelled) setPrefillNote(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId])

  // id формата <фамилия>-<имя>: pomazkov-anton
  const speakerId =
    surname.trim() && firstName.trim()
      ? `${slugify(surname)}-${slugify(firstName)}`
      : ''
  const taken = Boolean(
    speakerId && speakersFile.data?.speakers.some((s) => s.id === speakerId),
  )
  const ready = Boolean(speakerId && avatar && speakersFile.data)

  function submit() {
    const current = speakersFile.data
    if (!current || !avatar) return
    publish(async () => {
      const fullName = `${firstName.trim()} ${surname.trim()}`
      const avatarPath = `/media/speakers/${speakerId}.webp`

      const socialLinks = collectSocials(socials)
      const next = structuredClone(current)
      next.speakers.push({
        id: speakerId,
        name: fullName,
        aliases: [firstName.trim(), fullName],
        avatar: avatarPath,
        ...(bio.trim() ? { bio: bio.trim() } : {}),
        ...(Object.keys(socialLinks).length > 0 ? { socials: socialLinks } : {}),
      })

      const files: FileChange[] = [
        { path: `media/speakers/${speakerId}.webp`, content: avatar },
        { path: 'speakers.json', content: toJSON(next) },
      ]

      return openContentPR(gh, {
        branch: `cms/speaker-${speakerId}`,
        title: `feat(media): спикер ${fullName}`,
        body: [
          `Новый спикер **${fullName}** (\`${speakerId}\`).`,
          '',
          `- аватарка \`media/speakers/${speakerId}.webp\` (WebP, квадрат)`,
          '- обновлён `speakers.json`',
          '',
          '`index.json` пересоберётся автоматически после мержа.',
          '',
          '_Создано через CMS Книжного клуба._',
        ].join('\n'),
        files,
      })
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Имя">
              <TextInput
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Антон"
              />
            </Field>
            <Field label="Фамилия">
              <TextInput
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Помазков"
              />
            </Field>
          </div>
          {prefillNote && <p className="text-xs text-muted">{prefillNote}</p>}
          {speakerId && (
            <p className="text-xs text-muted">
              id: <code>{speakerId}</code>
              {taken && ' — такой спикер уже есть'}
            </p>
          )}
          <div className="flex items-start gap-4">
            {prefillPreview && (
              <img
                src={prefillPreview}
                alt="фото из заявки"
                className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
              />
            )}
            <div className="grow">
              <ImagePicker
                label="Аватарка"
                hint={
                  prefillPreview
                    ? 'Фото из заявки уже подставлено — можно заменить'
                    : 'Квадрат 400×400, кроп по центру, WebP'
                }
                opts={AVATAR_OPTS}
                onChange={(bytes) => {
                  if (bytes) setPrefillPreview(null)
                  if (bytes || !prefillPreview) setAvatar(bytes)
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label="О себе" hint="краткое описание — покажется в профиле спикера">
            <TextArea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Фронтендер, любит Docker и доклады про инфраструктуру"
            />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Соцсети</p>
            <SpeakerSocialsFields value={socials} onChange={setSocials} />
          </div>
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready || taken}
        disabledReason={taken ? 'Спикер уже существует' : 'Укажите имя, фамилию и аватарку'}
      />
    </div>
  )
}
