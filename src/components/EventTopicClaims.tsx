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
  message: string | null
  onAssign: (topicId: string, topicTitle: string, speakerId: string) => void
  onFree: (topicId: string) => void
  onGenerate: (topicId: string) => void
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
  message,
  onAssign,
  onFree,
  onGenerate,
}: EventTopicClaimsProps) {
  if (!chapterSelected) {
    return (
      <p className="text-sm text-muted">
        Выберите книгу и главу — темы главы появятся здесь как слоты докладов.
      </p>
    )
  }
  if (loading) return <p className="text-sm text-muted">Загружаем темы главы…</p>
  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted">
        В этой главе ещё нет тем. Добавьте их в разделе «Темы» — и они появятся здесь.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {topics.map((topic) => {
        const claim = claimByTopic.get(topic.id)
        const busy = busyTopic === topic.id
        return (
          <div key={topic.id} className="space-y-3 rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{topic.title}</p>
              {claim && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    claim.status === 'confirmed'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
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
                    <span className="ml-2 text-xs text-muted">· из каталога ✓</span>
                  )}
                </p>
                {claim.slides_url && (
                  <a
                    href={claim.slides_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-accent underline"
                  >
                    {claim.slides_url}
                  </a>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" disabled={busy} onClick={() => onFree(topic.id)}>
                    {busy ? '…' : 'Освободить'}
                  </Button>
                  {claim.speaker_id && (
                    <Button
                      variant="ghost"
                      disabled={genBusyId !== null}
                      onClick={() => onGenerate(topic.id)}
                    >
                      {genBusyId === topic.id ? 'Создаём…' : '🎤 Создать презентацию (PR)'}
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
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  )
}
