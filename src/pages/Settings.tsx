import { useEffect, useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { Card, ErrorBox, Field, SectionTitle, TextInput } from '../components/ui'
import { useDataClient, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadSettings } from '../lib/repo'
import { SOCIAL_PLATFORMS } from '../types'
import type { ClubSettings, SocialPlatform } from '../types'

// Настройки клуба: ссылки на соцсети. Пустое поле = платформа скрыта в miniapp.
// Сохраняются в settings.json одним pull request-ом.
export function Settings() {
  const gh = useDataClient()
  const { data: settings, error, loading } = useLoad(() => loadSettings(gh), [gh])
  const { state, publish, reset } = usePublish()

  const [urls, setUrls] = useState<Record<SocialPlatform, string>>({
    telegram: '',
    youtube: '',
    vk: '',
    boosty: '',
    github: '',
  })

  useEffect(() => {
    if (!settings) return
    setUrls((prev) => ({
      ...prev,
      ...Object.fromEntries(
        SOCIAL_PLATFORMS.map((p) => [p.id, settings.socials[p.id] ?? '']),
      ),
    }))
  }, [settings])

  function submit() {
    publish(async () => {
      const socials: ClubSettings['socials'] = {}
      for (const p of SOCIAL_PLATFORMS) {
        const url = urls[p.id].trim()
        if (url) socials[p.id] = url
      }
      const next: ClubSettings = { version: 1, socials }
      const files: FileChange[] = [{ path: 'settings.json', content: toJSON(next) }]

      return openContentPR(gh, {
        branch: 'cms/settings',
        title: 'chore(settings): обновить ссылки на соцсети',
        body: [
          'Правки настроек клуба (`settings.json`).',
          '',
          ...SOCIAL_PLATFORMS.map(
            (p) => `- ${p.label}: ${socials[p.id] ? `\`${socials[p.id]}\`` : '—'}`,
          ),
          '',
          '_Обновлено через CMS Книжного клуба._',
        ].join('\n'),
        files,
      })
    })
  }

  if (loading) return <p className="text-sm text-muted">Загружаем настройки…</p>
  if (error) return <ErrorBox>{error}</ErrorBox>

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Ссылки на соцсети клуба. Показываются в шапке miniapp едиными иконками —
        пустое поле скрывает платформу.
      </p>

      <Card>
        <SectionTitle>Соцсети</SectionTitle>
        <div className="space-y-4">
          {SOCIAL_PLATFORMS.map((p) => (
            <Field key={p.id} label={p.label}>
              <TextInput
                type="url"
                inputMode="url"
                placeholder={p.placeholder}
                value={urls[p.id]}
                onChange={(e) => setUrls((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        submitLabel="Создать pull request с настройками"
      />
    </div>
  )
}
