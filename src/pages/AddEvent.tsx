import { useState } from 'react'
import {
  buildEventFiles,
  EventFormFields,
  isEventFormReady,
  useEventFormState,
  type EventKind,
} from '../components/EventForm'
import { PublishPanel } from '../components/PublishPanel'
import { ErrorBox, Field, PageHeader, Select, SuccessBox } from '../components/ui'
import { announceEvent, announcePayload } from '../lib/botApi'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { slugify } from '../lib/slug'

export function AddEvent() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [kind, setKind] = useState<EventKind>('closed-chapter')
  // Итог анонса в группе: сообщение об успехе или причина, почему не ушло.
  // PR при этом уже создан, поэтому это предупреждение, а не ошибка формы.
  const [announceNote, setAnnounceNote] = useState<{ ok: boolean; text: string } | null>(null)
  const form = useEventFormState()

  const book = index?.books.find((b) => b.folder === form.folder)
  const slug = slugify(form.title)

  const ready = isEventFormReady(kind, form, book)

  function submit() {
    if (!index) return
    publish(async () => {
      const fileDir = kind === 'closed-chapter' ? 'closed-chapters' : 'live-talks'
      const filePath = `events/${fileDir}/${form.date}-${slug}.json`

      const { event, extraFiles } = buildEventFiles({ kind, form, index, slug })
      const files: FileChange[] = [
        { path: filePath, content: toJSON(event) },
        ...extraFiles,
      ]

      const result = await openContentPR(gh, {
        branch: `cms/event-${form.date}-${slug}`,
        title: `feat(events): ${form.title.trim()} (${form.date})`,
        body: [
          kind === 'closed-chapter'
            ? `Открытое обсуждение: разбор главы \`${form.chapterSlug}\` книги **${book!.title}**.`
            : `Доклады по главе — спикеры назначаются через бота/редактирование.`,
          '',
          `- \`${filePath}\``,
          '',
          '`index.json` пересоберётся автоматически после мержа.',
          '',
          '_Создано через CMS Книжного клуба._',
        ].join('\n'),
        files,
      })

      // Посты о встрече: встречи ещё нет в book-club-data (PR открыт), поэтому
      // бот получает поля формы. Он только готовит тексты — публикуете вы
      // в разделе «Посты». Сбой подготовки не отменяет PR.
      if (form.announce) {
        try {
          await announceEvent(announcePayload(event), {
            announce: form.posterAnnounce,
            day: form.posterDay,
          })
          setAnnounceNote({
            ok: true,
            text: 'Посты подготовлены — проверьте текст и опубликуйте в разделе «Посты».',
          })
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err)
          setAnnounceNote({
            ok: false,
            text: `Пул-реквест создан, но посты не подготовились: ${reason}`,
          })
        }
      }

      return result
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Новая встреча"
        hint="Обсуждение главы или эфир докладов; темы берутся из главы."
      />

      <EventFormFields
        kind={kind}
        form={form}
        index={index}
        kindSelector={
          <Field label="Тип встречи">
            <Select value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
              <option value="closed-chapter">Открытое обсуждение — разбор главы</option>
              <option value="live-talk">Доклады — записи докладов</option>
            </Select>
          </Field>
        }
        titlePlaceholder={
          kind === 'closed-chapter'
            ? 'Обсуждение главы 2 «Образы Docker»'
            : 'Доклады: Docker на практике'
        }
      />

      {announceNote ? (
        announceNote.ok ? (
          <SuccessBox>{announceNote.text}</SuccessBox>
        ) : (
          <ErrorBox>{announceNote.text}</ErrorBox>
        )
      ) : null}

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Заполните название, дату и обязательные поля типа встречи"
      />
    </div>
  )
}
