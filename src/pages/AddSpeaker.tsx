import { useState } from 'react'
import { ImagePicker } from '../components/ImagePicker'
import { PublishPanel } from '../components/PublishPanel'
import { Card, Field, TextInput } from '../components/ui'
import { AVATAR_OPTS } from '../lib/image'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { slugify } from '../lib/slug'

export function AddSpeaker() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [avatar, setAvatar] = useState<Uint8Array | null>(null)

  // id формата <фамилия>-<имя>: pomazkov-anton
  const speakerId =
    surname.trim() && firstName.trim()
      ? `${slugify(surname)}-${slugify(firstName)}`
      : ''
  const taken = Boolean(speakerId && index?.speakers.some((s) => s.id === speakerId))
  const ready = Boolean(speakerId && avatar && index)

  function submit() {
    if (!index || !avatar) return
    publish(async () => {
      const fullName = `${firstName.trim()} ${surname.trim()}`
      const avatarPath = `/media/speakers/${speakerId}.webp`

      const nextIndex = structuredClone(index)
      nextIndex.speakers.push({
        id: speakerId,
        name: fullName,
        aliases: [firstName.trim(), fullName],
        avatar: avatarPath,
      })

      const files: FileChange[] = [
        { path: `media/speakers/${speakerId}.webp`, content: avatar },
        { path: 'index.json', content: toJSON(nextIndex) },
      ]

      return openContentPR(gh, {
        branch: `cms/speaker-${speakerId}`,
        title: `feat(media): спикер ${fullName}`,
        body: [
          `Новый спикер **${fullName}** (\`${speakerId}\`).`,
          '',
          `- аватарка \`media/speakers/${speakerId}.webp\` (WebP, квадрат)`,
          '- обновлён `index.json`',
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
          {speakerId && (
            <p className="text-xs text-muted">
              id: <code>{speakerId}</code>
              {taken && ' — ⚠️ такой спикер уже есть'}
            </p>
          )}
          <ImagePicker
            label="Аватарка"
            hint="Квадрат 400×400, кроп по центру, WebP"
            opts={AVATAR_OPTS}
            onChange={setAvatar}
          />
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
