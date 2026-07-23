import { useState } from 'react'
import {
  buildEventFiles,
  EventFormFields,
  isEventFormReady,
  useEventFormState,
  type EventKind,
} from '../components/EventForm'
import { PublishPanel } from '../components/PublishPanel'
import { Field, Select } from '../components/ui'
import { useChapterTopics, useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { slugify } from '../lib/slug'

export function AddEvent() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [kind, setKind] = useState<EventKind>('closed-chapter')
  const form = useEventFormState()

  const book = index?.books.find((b) => b.folder === form.folder)
  const slug = slugify(form.title)

  // Темы выбранной главы — для выбора тем этой встречи (при делении главы).
  const { topics, loading: topicsLoading } = useChapterTopics(
    gh,
    form.folder,
    form.chapterSlug,
    kind === 'live-talk',
  )

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

      return openContentPR(gh, {
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
    })
  }

  return (
    <div className="space-y-6">
      <EventFormFields
        kind={kind}
        form={form}
        index={index}
        topics={topics}
        topicsLoading={topicsLoading}
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
