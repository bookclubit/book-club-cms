import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublishPanel } from '../components/PublishPanel'
import { Card, ErrorBox, Field, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON } from '../lib/pr'
import { loadChapter } from '../lib/repo'
import type { Chapter } from '../types'

// Редактирование главы: chapter.json. Папка (NN-slug) не переименовывается —
// на неё ссылаются index.json, события и маршруты miniapp.
export function EditChapter() {
  const { folder = '', slug = '' } = useParams()
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const chapter = useLoad(() => loadChapter(gh, folder, slug), [gh, folder, slug])
  const book = index?.books.find((b) => b.folder === folder)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [outcome, setOutcome] = useState('')

  useEffect(() => {
    const ch = chapter.data
    if (!ch) return
    setTitle(ch.title)
    setDescription(ch.description)
    setOutcome(ch.learning_outcome)
  }, [chapter.data])

  const ready = Boolean(chapter.data && title.trim() && description.trim() && outcome.trim())

  function submit() {
    const current = chapter.data
    if (!current) return
    publish(async () => {
      const next: Chapter = {
        ...current,
        title: title.trim(),
        description: description.trim(),
        learning_outcome: outcome.trim(),
      }

      return openContentPR(gh, {
        branch: `cms/edit-chapter-${folder}-${slug.slice(0, 2)}`,
        title: `fix(books): обновить главу «${next.title}»${book ? ` (${book.title})` : ''}`,
        body: [
          `Правки главы **${current.order}. ${next.title}**.`,
          '',
          `- \`books/${folder}/chapters/${slug}/chapter.json\``,
          '',
          '_Обновлено через CMS Книжного клуба._',
        ].join('\n'),
        files: [
          {
            path: `books/${folder}/chapters/${slug}/chapter.json`,
            content: toJSON(next),
          },
        ],
      })
    })
  }

  if (chapter.loading) return <p className="text-sm text-muted">Загружаем chapter.json…</p>
  if (chapter.error) return <ErrorBox>{chapter.error}</ErrorBox>
  if (!chapter.data) {
    return (
      <ErrorBox>
        Глава <code>{slug}</code> не найдена.{' '}
        <Link to="/chapters" className="underline">К списку</Link>
      </ErrorBox>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Редактирование <code>books/{folder}/chapters/{slug}</code> · глава №{chapter.data.order},
        тем: {chapter.data.topics.length} (папка и номер не меняются)
      </p>

      <Card>
        <div className="space-y-4">
          <Field label="Название главы">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Описание">
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Что узнаешь (learning outcome)">
            <TextArea value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </Field>
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Заполните все поля"
        submitLabel="Создать pull request с правками"
      />
    </div>
  )
}
