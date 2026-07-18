import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublishPanel } from '../components/PublishPanel'
import { Card, ErrorBox, Field, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, useLoad, usePublish } from '../lib/hooks'
import { openContentPR, toJSON, type FileChange } from '../lib/pr'
import { loadChapter } from '../lib/repo'
import { buildTopicMarkdown, parseTopicMarkdown, type TopicDraft } from '../lib/topicMd'
import type { Chapter } from '../types'

// Редактирование темы: .md пересобирается из формы, название синхронизируется
// в chapter.json. Файл, id и порядковый номер не меняются.
export function EditTopic() {
  const { folder = '', slug = '', file = '' } = useParams()
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const dir = `books/${folder}/chapters/${slug}`

  const loaded = useLoad(async () => {
    const [md, chapter] = await Promise.all([
      gh.getFileText(`${dir}/${file}`),
      loadChapter(gh, folder, slug),
    ])
    if (md === null) return null
    const draft = parseTopicMarkdown(md)
    if (!draft) throw new Error('Не удалось разобрать frontmatter файла темы')
    return { draft, chapter }
  }, [gh, dir, file])

  const [title, setTitle] = useState('')
  const [videoYoutube, setVideoYoutube] = useState('')
  const [videoVk, setVideoVk] = useState('')
  const [presentation, setPresentation] = useState('')
  const [resources, setResources] = useState('')
  const [speakers, setSpeakers] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [insights, setInsights] = useState('')
  const [opinions, setOpinions] = useState<Record<string, string>>({})

  useEffect(() => {
    const draft = loaded.data?.draft
    if (!draft) return
    setTitle(draft.title)
    setVideoYoutube(draft.videoYoutube)
    setVideoVk(draft.videoVk)
    setPresentation(draft.presentation)
    setResources(draft.resources.join('\n'))
    setSpeakers(draft.speakers)
    setDescription(draft.description)
    setInsights(draft.insights.join('\n'))
    setOpinions(
      Object.fromEntries(draft.speakerOpinions.map((o) => [o.speaker, o.text])),
    )
  }, [loaded.data])

  // Описание опционально — тему можно дозаполнять постепенно после встречи.
  const ready = Boolean(loaded.data && title.trim())

  function toggleSpeaker(name: string) {
    setSpeakers((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
  }

  function submit() {
    const data = loaded.data
    if (!data) return
    publish(async () => {
      const next: TopicDraft = {
        id: data.draft.id,
        title,
        order: data.draft.order,
        videoYoutube,
        videoVk,
        presentation,
        resources: resources.split('\n'),
        speakers,
        description,
        insights: insights.split('\n'),
        speakerOpinions: speakers.map((s) => ({ speaker: s, text: opinions[s] ?? '' })),
      }

      const files: FileChange[] = [
        { path: `${dir}/${file}`, content: buildTopicMarkdown(next) },
      ]

      // Синхронизируем название темы в chapter.json.
      if (data.chapter) {
        const nextChapter: Chapter = {
          ...data.chapter,
          topics: data.chapter.topics.map((t) =>
            t.file === file ? { ...t, title: title.trim() } : t,
          ),
        }
        files.push({ path: `${dir}/chapter.json`, content: toJSON(nextChapter) })
      }

      return openContentPR(gh, {
        branch: `cms/edit-topic-${folder}-${data.draft.id || file.replace(/\.md$/, '')}`,
        title: `fix(books): обновить тему «${title.trim()}»`,
        body: [
          `Правки темы **${title.trim()}** (\`${dir}/${file}\`).`,
          '',
          `- \`${dir}/${file}\``,
          data.chapter ? `- название синхронизировано в \`${dir}/chapter.json\`` : null,
          '',
          '_Обновлено через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files,
      })
    })
  }

  if (loaded.loading) return <p className="text-sm text-muted">Загружаем тему…</p>
  if (loaded.error) return <ErrorBox>{loaded.error}</ErrorBox>
  if (!loaded.data) {
    return (
      <ErrorBox>
        Файл <code>{file}</code> не найден.{' '}
        <Link to="/topics" className="underline">К списку</Link>
      </ErrorBox>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Редактирование <code>{dir}/{file}</code> · id <code>{loaded.data.draft.id}</code>,
        номер {loaded.data.draft.order} (файл и id не меняются)
      </p>

      <Card>
        <div className="space-y-4">
          <Field label="Название темы">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Видео YouTube">
              <TextInput value={videoYoutube} onChange={(e) => setVideoYoutube(e.target.value)} />
            </Field>
            <Field label="Видео VK">
              <TextInput value={videoVk} onChange={(e) => setVideoVk(e.target.value)} />
            </Field>
          </div>
          <Field label="Презентация">
            <TextInput value={presentation} onChange={(e) => setPresentation(e.target.value)} />
          </Field>
          <Field label="Доп. материалы" hint="по одной ссылке на строку">
            <TextArea rows={2} value={resources} onChange={(e) => setResources(e.target.value)} />
          </Field>
          <Field label="Спикеры">
            <div className="flex flex-wrap gap-2">
              {index?.speakers.map((s) => {
                const name = s.aliases[0] ?? s.name
                const active = speakers.includes(name)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSpeaker(name)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-white text-muted hover:text-ink'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
              {/* Спикеры из файла, которых нет в реестре — чтобы не потерять при сохранении */}
              {speakers
                .filter((name) => !index?.speakers.some((s) => (s.aliases[0] ?? s.name) === name))
                .map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleSpeaker(name)}
                    className="rounded-full border border-ink bg-ink px-3 py-1.5 text-sm text-white"
                  >
                    {name}
                  </button>
                ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label="Краткое описание">
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Инсайты" hint="по одному на строку — станут списком">
            <TextArea value={insights} onChange={(e) => setInsights(e.target.value)} />
          </Field>
          {speakers.map((s) => (
            <Field key={s} label={`Мнение спикера — ${s}`} hint="опционально">
              <TextArea
                rows={2}
                value={opinions[s] ?? ''}
                onChange={(e) => setOpinions({ ...opinions, [s]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Укажите название темы"
        submitLabel="Создать pull request с правками"
      />
    </div>
  )
}
