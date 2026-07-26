import type { SpeakerClaim } from '../lib/botApi'
import type { IndexSpeaker } from '../types'
import { Button, Field, Select } from './ui'

export interface TopicItem {
  id: string
  title: string
}

interface EventTopicClaimsProps {
  chapterSelected: boolean
  loading: boolean
  topics: TopicItem[]
  // Заявки этой встречи (единый источник занятости — D1), ключ — topic_id.
  claimByTopic: Map<string, SpeakerClaim>
  speakers: IndexSpeaker[]
  busyTopic: string | null // идёт assign/release для этой темы
  genBusyId: string | null // идёт генерация презентации
  acceptBusyId: string | null // идёт принятие презентации (мерж PR)
  acceptedSlides: Set<string> // slides_url принятых презентаций (PR смержен)
  message: string | null
  onAssign: (topicId: string, topicTitle: string, speakerId: string) => void
  onFree: (topicId: string) => void
  onGenerate: (topicId: string) => void
  onAccept: (topicId: string) => void
}

// Управление темами встречи: занятость берётся из заявок D1 (тот же источник,
// что и бот), поэтому назначение/освобождение здесь мгновенно отражается везде.
export function EventTopicClaims({
  chapterSelected,
  loading,
  topics,
  claimByTopic,
  speakers,
  busyTopic,
  genBusyId,
  acceptBusyId,
  acceptedSlides,
  message,
  onAssign,
  onFree,
  onGenerate,
  onAccept,
}: EventTopicClaimsProps) {
  if (!chapterSelected) {
    return (
      <p className="text-sm text-ink-soft">
        Выберите книгу и главу — темы главы появятся здесь как слоты докладов.
      </p>
    )
  }
  if (loading) return <p className="text-sm text-ink-soft">Загружаем темы главы…</p>
  if (topics.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        В этой главе ещё нет тем. Добавьте их в разделе «Темы» — и они появятся здесь.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {topics.map((topic) => {
        const claim = claimByTopic.get(topic.id)
        const busy = busyTopic === topic.id
        const accepted = Boolean(claim?.slides_url && acceptedSlides.has(claim.slides_url))
        return (
          <div key={topic.id} className="space-y-3 rounded-card border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{topic.title}</p>
              {claim && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    claim.status === 'confirmed'
                      ? 'bg-success-soft text-success'
                      : 'bg-warn-soft text-warn'
                  }`}
                >
                  {claim.status === 'confirmed' ? 'занята' : 'заявка'}
                </span>
              )}
            </div>

            {claim ? (
              <>
                <p className="text-sm">
                  {claim.full_name ?? (claim.username ? `@${claim.username}` : 'участник клуба')}
                  {claim.speaker_id && (
                    <span className="ml-2 text-xs text-ink-soft">· из каталога</span>
                  )}
                </p>
                {claim.slides_url && (
                  <p className="flex items-center gap-2 text-xs">
                    <a
                      href={claim.slides_url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 truncate text-accent underline"
                    >
                      {claim.slides_url}
                    </a>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                        accepted ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn'
                      }`}
                    >
                      {accepted ? 'принята' : 'на ревью'}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" disabled={busy} onClick={() => onFree(topic.id)}>
                    {busy ? '…' : 'Освободить'}
                  </Button>
                  {claim.speaker_id && (
                    <Button
                      variant="ghost"
                      disabled={genBusyId !== null || acceptBusyId !== null}
                      onClick={() => onGenerate(topic.id)}
                    >
                      {genBusyId === topic.id ? 'Создаём…' : 'Создать презентацию (PR)'}
                    </Button>
                  )}
                  {claim.slides_url && !accepted && (
                    <Button
                      disabled={genBusyId !== null || acceptBusyId !== null}
                      onClick={() => onAccept(topic.id)}
                    >
                      {acceptBusyId === topic.id ? 'Принимаем…' : 'Принять презентацию'}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <Field label="Назначить спикера" hint="или оставьте свободной — возьмут через бота">
                <Select
                  value=""
                  disabled={busy}
                  onChange={(e) => e.target.value && onAssign(topic.id, topic.title, e.target.value)}
                >
                  <option value="">— свободна —</option>
                  {speakers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )
      })}
      {message && <p className="text-sm text-ink-soft">{message}</p>}
    </div>
  )
}
