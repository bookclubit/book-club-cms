import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublishPanel } from '../components/PublishPanel'
import { TopicsEditor } from '../components/TopicsEditor'
import {
  Card,
  CardTitle,
  ErrorBox,
  Field,
  Loading,
  Mono,
  PageHeader,
  TextInput,
} from '../components/ui'
import { useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON } from '../lib/pr'
import { loadChapter } from '../lib/repo'
import type { Chapter, Topic } from '../types'

// Редактирование главы вместе с темами: всё лежит в одном chapter.json.
// Папка (NN-slug) не переименовывается — на неё ссылаются реестр, события
// и маршруты miniapp.
export function EditChapter() {
  const { folder = '', slug = '' } = useParams()
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const chapter = useLoad(() => loadChapter(gh, folder, slug), [gh, folder, slug])
  const book = index?.books.find((b) => b.folder === folder)

  const [title, setTitle] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])

  useEffect(() => {
    const ch = chapter.data
    if (!ch) return
    setTitle(ch.title)
    // Файлы, написанные руками, могут не иметь новых полей — добираем пустыми.
    setTopics(
      ch.topics.map((t) => ({
        id: t.id,
        title: t.title,
        speakers: t.speakers ?? [],
        video_youtube: t.video_youtube ?? '',
        video_vk: t.video_vk ?? '',
        presentation: t.presentation ?? '',
        resources: t.resources ?? [],
      })),
    )
  }, [chapter.data])

  const ready = Boolean(chapter.data && title.trim())

  function submit() {
    const current = chapter.data
    if (!current) return
    publish(async () => {
      const next: Chapter = {
        order: current.order,
        title: title.trim(),
        topics: topics
          .filter((t) => t.title.trim())
          .map((t) => ({
            ...t,
            title: t.title.trim(),
            resources: t.resources.map((r) => r.trim()).filter(Boolean),
          })),
      }

      const path = `books/${folder}/chapters/${slug}/chapter.json`
      const removed = current.topics.filter((t) => !next.topics.some((n) => n.id === t.id))

      return openContentPR(gh, {
        branch: `cms/edit-chapter-${folder}-${slug.slice(0, 2)}`,
        title: `fix(books): обновить главу «${next.title}»${book ? ` (${book.title})` : ''}`,
        body: [
          `Правки главы **${current.order}. ${next.title}**.`,
          '',
          `- \`${path}\``,
          `- тем в главе: ${next.topics.length} (было ${current.topics.length})`,
          removed.length > 0
            ? `- удалены темы: ${removed.map((t) => `\`${t.id}\``).join(', ')} — проверьте ссылки на них в событиях`
            : null,
          '',
          '_Обновлено через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files: [{ path, content: toJSON(next) }],
      })
    })
  }

  if (chapter.loading) return <Loading label="Загружаем главу…" />
  if (chapter.error) return <ErrorBox>{chapter.error}</ErrorBox>
  if (!chapter.data) {
    return (
      <ErrorBox>
        Глава <span className="font-mono text-xs">{slug}</span> не найдена.{' '}
        <Link to="/chapters" className="underline">
          К списку
        </Link>
      </ErrorBox>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Глава ${chapter.data.order}`}
        hint={
          <>
            {book ? `${book.title} · ` : ''}
            <Mono>books/{folder}/chapters/{slug}</Mono>
          </>
        }
      />

      <Card>
        <CardTitle>Глава</CardTitle>
        <div className="space-y-4">
          <Field label="Название главы">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Ссылки и спикеров проставляют после встречи — прямо здесь">
          Темы главы
        </CardTitle>
        <TopicsEditor
          topics={topics}
          speakers={index?.speakers ?? []}
          bookId={book?.id ?? folder}
          chapterOrder={chapter.data.order}
          onChange={setTopics}
        />
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Заполните поля главы"
        submitLabel="Создать pull request с правками"
      />
    </div>
  )
}
