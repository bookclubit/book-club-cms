import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublishPanel } from '../components/PublishPanel'
import { Button, Card, ErrorBox, Field, SectionTitle, Select, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON } from '../lib/pr'
import { loadFlashcards } from '../lib/repo'
import type { Flashcard, FlashcardDifficulty } from '../types'

// Колода карточек книги: просмотр, правка и удаление существующих карточек.
// Все изменения уходят одним PR (полностью обновлённый flashcards.json).
// Новые карточки добавляются отдельной формой «Добавить карточки».
export function Flashcards() {
  const gh = useDataClient()
  const { data: index, error, loading } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [folder, setFolder] = useState('')
  const [original, setOriginal] = useState<Flashcard[] | null>(null)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  const book = index?.books.find((b) => b.folder === folder)

  useEffect(() => {
    setOriginal(null)
    setCards([])
    setExpanded(null)
    if (!folder) return
    let cancelled = false
    loadFlashcards(gh, folder).then((list) => {
      if (cancelled) return
      setOriginal(list)
      setCards(structuredClone(list))
    })
    return () => {
      cancelled = true
    }
  }, [gh, folder])

  const dirty = original !== null && toJSON(cards) !== toJSON(original)
  const removedCount = original ? original.length - cards.length : 0
  const editedCount = original
    ? cards.filter((c) => {
        const was = original.find((o) => o.id === c.id)
        return was && toJSON(was) !== toJSON(c)
      }).length
    : 0

  function patch(id: string, changes: Partial<Flashcard>) {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? ({ ...c, ...changes } as Flashcard) : c)),
    )
  }

  function submit() {
    if (!book || !dirty) return
    publish(async () =>
      openContentPR(gh, {
        branch: `cms/edit-flashcards-${book.folder}`,
        title: `fix(books): править карточки (${book.title})`,
        body: [
          `Правки колоды **${book.title}**: изменено ${editedCount}, удалено ${removedCount}.`,
          '',
          `- \`books/${book.folder}/flashcards.json\` — теперь ${cards.length} карточек`,
          removedCount > 0
            ? '- у удалённых карточек пропадёт прогресс повторения в боте'
            : null,
          '',
          '_Обновлено через CMS Книжного клуба._',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        files: [
          { path: `books/${book.folder}/flashcards.json`, content: toJSON(cards) },
        ],
      }),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Карточки</SectionTitle>
        <Link
          to="/flashcards/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85"
        >
          + Добавить карточки
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Загружаем реестр…</p>}
      {error && <ErrorBox>{error}</ErrorBox>}

      <Card>
        <Field
          label="Книга"
          hint={
            book && original !== null
              ? `в колоде ${original.length} карточек`
              : undefined
          }
        >
          <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">— выберите книгу —</option>
            {index?.books.map((b) => (
              <option key={b.folder} value={b.folder}>
                {b.title}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {folder && original !== null && original.length === 0 && (
        <p className="text-sm text-muted">У книги пока нет карточек.</p>
      )}

      {cards.map((card) => {
        const open = expanded === card.id
        const front = card.type === 'qa' ? card.question : card.command
        return (
          <div key={card.id} className="rounded-2xl border border-line bg-white">
            <button
              type="button"
              onClick={() => setExpanded(open ? null : card.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{front}</span>
                <span className="text-xs text-muted">
                  <code>{card.id}</code> · глава {card.chapter} · {card.difficulty} ·{' '}
                  {card.type === 'qa' ? 'вопрос/ответ' : 'команда'}
                </span>
              </span>
              <span className="shrink-0 text-sm text-accent">
                {open ? 'Свернуть' : 'Редактировать'}
              </span>
            </button>

            {open && (
              <div className="space-y-4 border-t border-line p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Глава (номер)">
                    <TextInput
                      value={card.chapter}
                      onChange={(e) => patch(card.id, { chapter: e.target.value })}
                    />
                  </Field>
                  <Field label="Сложность">
                    <Select
                      value={card.difficulty}
                      onChange={(e) =>
                        patch(card.id, { difficulty: e.target.value as FlashcardDifficulty })
                      }
                    >
                      <option value="easy">easy</option>
                      <option value="medium">medium</option>
                      <option value="hard">hard</option>
                    </Select>
                  </Field>
                </div>
                {card.type === 'qa' ? (
                  <>
                    <Field label="Вопрос">
                      <TextArea
                        rows={2}
                        value={card.question}
                        onChange={(e) => patch(card.id, { question: e.target.value })}
                      />
                    </Field>
                    <Field label="Ответ">
                      <TextArea
                        rows={3}
                        value={card.answer}
                        onChange={(e) => patch(card.id, { answer: e.target.value })}
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Команда">
                      <TextArea
                        rows={2}
                        value={card.command}
                        onChange={(e) => patch(card.id, { command: e.target.value })}
                      />
                    </Field>
                    <Field label="Результат">
                      <TextArea
                        rows={3}
                        value={card.result}
                        onChange={(e) => patch(card.id, { result: e.target.value })}
                      />
                    </Field>
                  </>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    setCards((prev) => prev.filter((c) => c.id !== card.id))
                    setExpanded(null)
                  }}
                >
                  Удалить карточку
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {original !== null && (
        <div className="space-y-3">
          {dirty && (
            <p className="text-sm text-muted">
              Изменено: {editedCount}, удалено: {removedCount}. Изменения попадут в один PR.
              Отменить всё можно, перевыбрав книгу.
            </p>
          )}
          <PublishPanel
            state={state}
            onSubmit={submit}
            onReset={reset}
            disabled={!dirty}
            disabledReason="Изменений пока нет"
            submitLabel="Создать pull request с правками"
          />
        </div>
      )}
    </div>
  )
}
