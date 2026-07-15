import { useEffect, useMemo, useState } from 'react'
import { PublishPanel } from '../components/PublishPanel'
import { Button, Card, Field, Select, TextArea, TextInput } from '../components/ui'
import { useDataClient, useIndex, usePublish } from '../lib/hooks'
import { openContentPR, toJSON } from '../lib/pr'
import { loadFlashcards } from '../lib/repo'
import { pad3 } from '../lib/slug'
import type { Flashcard, FlashcardDifficulty } from '../types'

interface CardDraft {
  type: 'qa' | 'command'
  front: string // question | command
  back: string // answer | result
  chapter: string
  difficulty: FlashcardDifficulty
}

const emptyCard = (): CardDraft => ({
  type: 'qa',
  front: '',
  back: '',
  chapter: '1',
  difficulty: 'medium',
})

export function AddFlashcards() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const { state, publish, reset } = usePublish()

  const [folder, setFolder] = useState('')
  const [existing, setExisting] = useState<Flashcard[] | null>(null)
  const [cards, setCards] = useState<CardDraft[]>([emptyCard()])

  const book = index?.books.find((b) => b.folder === folder)

  useEffect(() => {
    setExisting(null)
    if (!folder) return
    let cancelled = false
    loadFlashcards(gh, folder).then((list) => {
      if (!cancelled) setExisting(list)
    })
    return () => {
      cancelled = true
    }
  }, [gh, folder])

  // Префикс и следующий номер выводим из существующих id (docker-001 → docker, 2).
  const { prefix, nextNumber } = useMemo(() => {
    if (!book) return { prefix: '', nextNumber: 1 }
    if (existing && existing.length > 0) {
      const match = existing[existing.length - 1].id.match(/^(.+)-(\d+)$/)
      if (match) {
        const max = Math.max(
          ...existing
            .map((c) => Number(c.id.match(/-(\d+)$/)?.[1]))
            .filter((n) => Number.isFinite(n)),
        )
        return { prefix: match[1], nextNumber: max + 1 }
      }
    }
    return { prefix: book.id.split('-')[0], nextNumber: 1 }
  }, [book, existing])

  const filled = cards.filter((c) => c.front.trim() && c.back.trim())
  const ready = Boolean(book && existing !== null && filled.length > 0)

  function submit() {
    if (!book || existing === null) return
    publish(async () => {
      const newCards: Flashcard[] = filled.map((c, i) => {
        const id = `${prefix}-${pad3(nextNumber + i)}`
        return c.type === 'qa'
          ? {
              id,
              type: 'qa',
              question: c.front.trim(),
              answer: c.back.trim(),
              chapter: c.chapter.trim() || '1',
              difficulty: c.difficulty,
            }
          : {
              id,
              type: 'command',
              command: c.front.trim(),
              result: c.back.trim(),
              chapter: c.chapter.trim() || '1',
              difficulty: c.difficulty,
            }
      })

      return openContentPR(gh, {
        branch: `cms/flashcards-${book.folder}-${pad3(nextNumber)}`,
        title: `feat(books): карточки ${newCards[0].id}…${newCards[newCards.length - 1].id} (${book.title})`,
        body: [
          `Новые флеш-карточки для **${book.title}**: ${newCards.length} шт.`,
          '',
          `- \`books/${book.folder}/flashcards.json\` — теперь ${existing.length + newCards.length} карточек`,
          '',
          '_Создано через CMS Книжного клуба._',
        ].join('\n'),
        files: [
          {
            path: `books/${book.folder}/flashcards.json`,
            content: toJSON([...existing, ...newCards]),
          },
        ],
      })
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <Field
          label="Книга"
          hint={
            book && existing !== null
              ? `в колоде ${existing.length} карточек, новые получат id с ${prefix}-${pad3(nextNumber)}`
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

      {cards.map((card, i) => (
        <Card key={i}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              Карточка {i + 1}
              {book && existing !== null && (
                <span className="ml-2 text-muted">{`${prefix}-${pad3(nextNumber + i)}`}</span>
              )}
            </p>
            {cards.length > 1 && (
              <Button variant="danger" onClick={() => setCards(cards.filter((_, j) => j !== i))}>
                Удалить
              </Button>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Тип">
                <Select
                  value={card.type}
                  onChange={(e) =>
                    setCards(cards.map((c, j) => (j === i ? { ...c, type: e.target.value as CardDraft['type'] } : c)))
                  }
                >
                  <option value="qa">Вопрос → ответ</option>
                  <option value="command">Команда → результат</option>
                </Select>
              </Field>
              <Field label="Глава (номер)">
                <TextInput
                  value={card.chapter}
                  onChange={(e) =>
                    setCards(cards.map((c, j) => (j === i ? { ...c, chapter: e.target.value } : c)))
                  }
                />
              </Field>
              <Field label="Сложность">
                <Select
                  value={card.difficulty}
                  onChange={(e) =>
                    setCards(
                      cards.map((c, j) =>
                        j === i ? { ...c, difficulty: e.target.value as FlashcardDifficulty } : c,
                      ),
                    )
                  }
                >
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </Select>
              </Field>
            </div>
            <Field label={card.type === 'qa' ? 'Вопрос' : 'Команда'}>
              <TextArea
                rows={2}
                value={card.front}
                onChange={(e) =>
                  setCards(cards.map((c, j) => (j === i ? { ...c, front: e.target.value } : c)))
                }
              />
            </Field>
            <Field label={card.type === 'qa' ? 'Ответ' : 'Результат'}>
              <TextArea
                rows={3}
                value={card.back}
                onChange={(e) =>
                  setCards(cards.map((c, j) => (j === i ? { ...c, back: e.target.value } : c)))
                }
              />
            </Field>
          </div>
        </Card>
      ))}

      <Button variant="ghost" onClick={() => setCards([...cards, emptyCard()])}>
        + Ещё карточка
      </Button>

      <PublishPanel
        state={state}
        onSubmit={submit}
        onReset={reset}
        disabled={!ready}
        disabledReason="Выберите книгу и заполните хотя бы одну карточку целиком"
      />
    </div>
  )
}
