import { Button, Field, Select, TextInput } from './ui'
import type { IndexSpeaker } from '../types'

// Назначение спикера теме доклада (+ ссылка на слайды, если уже сгенерирована).
export interface TalkAssignment {
  speakerId: string
  slidesUrl: string
}

// Строка программы: тема главы (или устаревший доклад «вне плана»).
export interface TalkRow {
  id: string // id темы главы, либо `off:<название>` для доклада вне плана
  title: string
  offPlan?: boolean
}

interface TalkProgramProps {
  chapterSelected: boolean
  loading: boolean
  rows: TalkRow[]
  speakers: IndexSpeaker[]
  assignments: Record<string, TalkAssignment>
  onSpeaker: (rowId: string, speakerId: string) => void
  // Ссылка на слайды и кнопка генерации — только в редактировании встречи.
  onSlides?: (rowId: string, url: string) => void
  generate?: {
    run: (rowId: string) => void
    busyId: string | null
    message: string | null
  }
}

// Программа докладов эфира: список тем выбранной главы. Каждой теме можно
// назначить спикера (или оставить свободной). Темы — из chapter.json, поэтому
// названия гарантированно совпадают с тем, что нужно генератору презентаций.
export function TalkProgram({
  chapterSelected,
  loading,
  rows,
  speakers,
  assignments,
  onSpeaker,
  onSlides,
  generate,
}: TalkProgramProps) {
  if (!chapterSelected) {
    return (
      <p className="text-sm text-muted">
        Выберите книгу и главу — темы главы появятся здесь как слоты докладов.
      </p>
    )
  }
  if (loading) {
    return <p className="text-sm text-muted">Загружаем темы главы…</p>
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        В этой главе ещё нет тем. Добавьте их в разделе «Темы» — и они появятся здесь.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const a = assignments[row.id] ?? { speakerId: '', slidesUrl: '' }
        return (
          <div key={row.id} className="space-y-3 rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{row.title}</p>
              {row.offPlan && (
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  вне плана главы
                </span>
              )}
            </div>
            <div className={`grid gap-3 ${onSlides ? 'sm:grid-cols-2' : ''}`}>
              <Field label="Спикер" hint="пусто — тема свободна для заявок">
                <Select value={a.speakerId} onChange={(e) => onSpeaker(row.id, e.target.value)}>
                  <option value="">— свободна —</option>
                  {speakers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {onSlides && (
                <Field label="Ссылка на презентацию" hint="кнопкой ниже или вручную">
                  <TextInput
                    value={a.slidesUrl}
                    onChange={(e) => onSlides(row.id, e.target.value)}
                    placeholder="https://bc-112-docker-1-pomazkov.pages.dev"
                  />
                </Field>
              )}
            </div>
            {generate && !row.offPlan && (
              <Button
                variant="ghost"
                disabled={generate.busyId !== null || !a.speakerId}
                onClick={() => generate.run(row.id)}
              >
                {generate.busyId === row.id ? 'Создаём…' : '🎤 Создать презентацию (PR)'}
              </Button>
            )}
          </div>
        )
      })}
      {generate?.message && <p className="text-sm text-muted">{generate.message}</p>}
    </div>
  )
}
