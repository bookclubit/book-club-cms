import { useCallback, useEffect, useState } from 'react'
import { Button, Card, ErrorBox, Loading, PageHeader, TextArea } from '../components/ui'
import {
  deletePost,
  getBotToken,
  listPosts,
  publishPost,
  refreshPostText,
  savePostText,
  type AnnounceChat,
  type PostDraft,
} from '../lib/botApi'

// Посты о встречах: бот готовит тексты, публикует админ. Расписания нет — здесь
// видно, что ждёт публикации, текст можно поправить и отправить в выбранные
// группы (по умолчанию — во все подключённые).
export function Posts() {
  const [posts, setPosts] = useState<PostDraft[] | null>(null)
  const [chats, setChats] = useState<AnnounceChat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showSent, setShowSent] = useState(false)

  const reload = useCallback(() => {
    setError(null)
    listPosts()
      .then(({ posts: p, chats: c }) => {
        setPosts(p)
        setChats(c)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (!getBotToken()) {
    return (
      <ErrorBox>
        Для постов нужен админ-токен бота — задайте его на странице входа
        (кнопка «Выйти» → вход заново).
      </ErrorBox>
    )
  }

  const all = posts ?? []
  const pending = all.filter((p) => p.status === 'pending')
  const sent = all.filter((p) => p.status === 'sent')
  const visible = showSent ? sent : pending

  // Группируем по встрече: три поста одной встречи — рядом.
  const groups = new Map<string, PostDraft[]>()
  for (const post of visible) {
    const group = groups.get(post.event_id) ?? []
    group.push(post)
    groups.set(post.event_id, group)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Посты о встречах"
        hint="Бот готовит тексты при создании встречи. Публикуете вы — расписания нет: проверьте текст и отправьте в нужные группы."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {posts === null && !error && <Loading label="Загружаем посты…" />}

      {posts !== null && chats.length === 0 && (
        <Card>
          <p className="text-[13px] font-medium">Ни одна группа не подключена</p>
          <p className="mt-1.5 text-sm text-ink-soft">
            Отправьте <code>/anons_here</code> в группе клуба от имени администратора — бот
            запомнит чат. Отключить потом — <code>/anons_stop</code>.
          </p>
        </Card>
      )}

      {posts !== null && chats.length > 0 && (
        <p className="text-[13px] text-ink-soft">
          Подключено групп: {chats.length} —{' '}
          {chats.map((c) => c.title ?? `чат ${c.chat_id}`).join(', ')}
        </p>
      )}

      {all.length > 0 && (
        <div className="flex gap-2">
          <TabButton active={!showSent} onClick={() => setShowSent(false)}>
            Ждут публикации ({pending.length})
          </TabButton>
          <TabButton active={showSent} onClick={() => setShowSent(true)}>
            Опубликованные ({sent.length})
          </TabButton>
        </div>
      )}

      {posts !== null && visible.length === 0 && (
        <p className="text-sm text-ink-soft">
          {showSent
            ? 'Опубликованных постов пока нет.'
            : 'Постов, ждущих публикации, нет. Они появятся, когда создадите встречу с галочкой «Подготовить посты».'}
        </p>
      )}

      {[...groups.entries()].map(([eventId, group]) => (
        <section key={eventId} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            {group[0].event_title ?? eventId}
            {group[0].event_date ? ` · ${group[0].event_date}` : ''}
            {group[0].event_time ? `, ${group[0].event_time} МСК` : ''}
          </h2>
          {group.map((post) => (
            <PostCard key={post.id} post={post} chats={chats} onChanged={reload} />
          ))}
        </section>
      ))}
    </div>
  )
}

function PostCard({
  post,
  chats,
  onChanged,
}: {
  post: PostDraft
  chats: AnnounceChat[]
  onChanged: () => void
}) {
  const [text, setText] = useState(post.text)
  // Пусто = все группы: выбор нужен, только когда групп несколько.
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState<'save' | 'refresh' | 'publish' | 'delete' | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty = text.trim() !== post.text.trim()
  const targets = selected.length > 0 ? selected : chats.map((c) => c.chat_id)

  async function run(kind: typeof busy, fn: () => Promise<string | null>) {
    setBusy(kind)
    setNote(null)
    try {
      const message = await fn()
      if (message) setNote({ ok: true, text: message })
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  const sentWhere = (post.sent_to ?? [])
    .map((s) => chats.find((c) => c.chat_id === s.chat_id)?.title ?? `чат ${s.chat_id}`)
    .join(', ')

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold">{post.kind_title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            обычно — {post.kind_when}
            {post.has_poster ? ' · с афишей' : ' · без афиши'}
            {post.edited ? ' · текст правили' : ''}
          </p>
        </div>
        {post.status === 'sent' ? (
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
            опубликован{sentWhere ? ` → ${sentWhere}` : ''}
          </span>
        ) : (
          <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
            ждёт публикации
          </span>
        )}
      </div>

      {post.status === 'sent' ? (
        <p className="mt-3 whitespace-pre-line rounded-control bg-surface-2 p-3 text-sm text-ink-soft">
          {post.text}
        </p>
      ) : (
        <>
          <div className="mt-3">
            <TextArea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Разметка Telegram (HTML): <code>&lt;b&gt;</code>, <code>&lt;a href&gt;</code>.
              Ссылки и спикеров бот уже подставил.
            </p>
          </div>

          {chats.length > 1 && (
            <div className="mt-4">
              <p className="text-[13px] font-medium">Куда публиковать</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={selected.length === 0}
                    onChange={() => setSelected([])}
                  />
                  Во все группы
                </label>
                {chats.map((chat) => (
                  <label key={chat.chat_id} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={selected.includes(chat.chat_id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, chat.chat_id]
                            : prev.filter((id) => id !== chat.chat_id),
                        )
                      }
                    />
                    {chat.title ?? `чат ${chat.chat_id}`}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              disabled={busy !== null || chats.length === 0}
              loading={busy === 'publish'}
              onClick={() =>
                void run('publish', async () => {
                  // Правку сохраняем перед отправкой, иначе уйдёт старый текст.
                  if (dirty) await savePostText(post.id, text.trim())
                  const result = await publishPost(post.id, selected)
                  onChanged()
                  const where = result.sent_to.length
                  return (
                    `Опубликовано в ${where} ${where === 1 ? 'группу' : 'группы'}.` +
                    (result.errors.length > 0 ? ` Не ушло: ${result.errors.join('; ')}` : '')
                  )
                })
              }
            >
              {chats.length > 1 && selected.length > 0
                ? `Опубликовать (${targets.length})`
                : 'Опубликовать'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== null || !dirty}
              loading={busy === 'save'}
              onClick={() =>
                void run('save', async () => {
                  await savePostText(post.id, text.trim())
                  onChanged()
                  return 'Текст сохранён.'
                })
              }
            >
              Сохранить текст
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== null}
              loading={busy === 'refresh'}
              onClick={() =>
                void run('refresh', async () => {
                  const fresh = await refreshPostText(post.id)
                  setText(fresh)
                  onChanged()
                  return 'Текст пересобран из данных клуба.'
                })
              }
            >
              Пересобрать из данных
            </Button>
            <Button
              variant="danger"
              disabled={busy !== null}
              loading={busy === 'delete'}
              onClick={() =>
                void run('delete', async () => {
                  await deletePost(post.id)
                  onChanged()
                  return null
                })
              }
            >
              Убрать
            </Button>
          </div>
        </>
      )}

      {note && (
        <p className={`mt-3 text-sm ${note.ok ? 'text-ink-soft' : 'text-danger'}`}>{note.text}</p>
      )}
    </Card>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-control bg-surface-2 px-2.5 py-1 text-[13px] font-medium text-ink'
          : 'rounded-control px-2.5 py-1 text-[13px] text-ink-soft hover:bg-surface-2 hover:text-ink'
      }
    >
      {children}
    </button>
  )
}

export default Posts
