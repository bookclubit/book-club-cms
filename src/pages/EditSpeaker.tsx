import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ImagePicker } from '../components/ImagePicker'
import { PublishPanel } from '../components/PublishPanel'
import {
  collectSocials,
  EMPTY_SOCIALS,
  SpeakerSocialsFields,
} from '../components/SpeakerSocialsFields'
import { Card, ErrorBox, Field, TextArea, TextInput } from '../components/ui'
import { AVATAR_OPTS } from '../lib/image'
import { useDataClient, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadSpeakers, mediaUrl } from '../lib/repo'
import type { SpeakerSocial } from '../types'

// Редактирование спикера: имя и алиасы в speakers.json, замена аватарки.
// id не меняется — на него ссылаются события и доклады. index.json
// пересобирается автоматически после мержа.
export function EditSpeaker() {
  const { id = '' } = useParams()
  const gh = useDataClient()
  const { data: speakersFile, loading, error } = useLoad(() => loadSpeakers(gh), [gh])
  const { state, publish, reset } = usePublish()

  const speaker = speakersFile?.speakers.find((s) => s.id === id)

  const [name, setName] = useState('')
  const [aliases, setAliases] = useState('')
  const [bio, setBio] = useState('')
  const [socials, setSocials] = useState<Record<SpeakerSocial, string>>(EMPTY_SOCIALS)
  const [newAvatar, setNewAvatar] = useState<Uint8Array | null>(null)

  useEffect(() => {
    if (!speaker) return
    setName(speaker.name)
    setAliases(speaker.aliases.join(', '))
    setBio(speaker.bio ?? '')
    setSocials({ ...EMPTY_SOCIALS, ...speaker.socials })
  }, [speaker])

  const ready = Boolean(speaker && name.trim())

  function submit() {
    if (!speakersFile || !speaker) return
    publish(async () => {
      const next = structuredClone(speakersFile)
      const entry = next.speakers.find((s) => s.id === id)!
      entry.name = name.trim()
      entry.aliases = aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
      const trimmedBio = bio.trim()
      if (trimmedBio) entry.bio = trimmedBio
      else delete entry.bio
      const socialLinks = collectSocials(socials)
      if (Object.keys(socialLinks).length > 0) entry.socials = socialLinks
      else delete entry.socials

      const files: FileChange[] = [{ path: 'speakers.json', content: toJSON(next) }]
      if (newAvatar) {
        files.push({ path: speaker.avatar.replace(/^\//, ''), content: newAvatar })
      }

      return openContentPR(gh, {
        branch: `cms/edit-speaker-${id}`,
        title: `fix(media): обновить спикера ${entry.name}`,
        body: [
          `Правки спикера **${entry.name}** (\`${id}\`).`,
          '',
          '- обновлён `speakers.json`',
          newAvatar ? `- заменена аватарка \`${speaker.avatar.replace(/^\//, '')}\`` : null,
          '',
          '`index.json` пересоберётся автоматически после мержа.',
          '',
          '_Обновлено через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files,
      })
    })
  }

  if (loading) return <p className="text-sm text-muted">Загружаем спикеров…</p>
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!speaker) {
    return (
      <ErrorBox>
        Спикер <code>{id}</code> не найден.{' '}
        <Link to="/speakers" className="underline">К списку</Link>
      </ErrorBox>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Редактирование спикера <code>{id}</code> (id не меняется).
      </p>

      <Card>
        <div className="space-y-4">
          <Field label="Имя и фамилия">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Алиасы" hint="через запятую — под этими именами спикер указывается в темах">
            <TextInput value={aliases} onChange={(e) => setAliases(e.target.value)} />
          </Field>
          <div className="flex items-start gap-4">
            {!newAvatar && (
              <img
                src={mediaUrl(speaker.avatar)}
                alt="текущая аватарка"
                className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
              />
            )}
            <div className="grow">
              <ImagePicker
                label="Аватарка"
                hint="Выберите файл, чтобы заменить текущую"
                opts={AVATAR_OPTS}
                onChange={setNewAvatar}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label="О себе" hint="краткое описание — покажется в профиле спикера">
            <TextArea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
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
        disabled={!ready}
        disabledReason="Имя не может быть пустым"
        submitLabel="Создать pull request с правками"
      />
    </div>
  )
}
