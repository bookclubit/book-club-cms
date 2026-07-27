import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  ErrorBox,
  Loading,
  PageHeader,
  TextArea,
  TextInput,
} from '../components/ui'
import {
  approvePost,
  deletePost,
  fetchPostPoster,
  getBotToken,
  listPosts,
  publishPost,
  refreshPostText,
  savePostText,
  schedulePost,
  setPostPoster,
  type AnnounceChat,
  type PostDraft,
} from '../lib/botApi'
import { mskInputToMs, mskInputValue, mskLabel } from '../lib/msk'

// Посты о встречах: бот готовит тексты, админ их проверяет. Дальше два пути —
// опубликовать сразу или одобрить и поставить время: по расписанию уходят
// только одобренные посты, чтобы автоматика не публиковала непрочитанное.
export function Posts() {
  const [posts, setPosts] = useState<PostDraft[] | null>(null)
  const [chats, setChats] = useState<AnnounceChat[]>([])
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [showSent, setShowSent] = useState(false)

  const reload = useCallback(() => {
    setError(null)
    listPosts()
      .then(({ posts: p, chats: c, max_attempts }) => {
        setPosts(p)
        setChats(c)
        if (max_attempts) setMaxAttempts(max_attempts)
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
  const scheduled = pending.filter((p) => p.scheduled_at !== null)
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
        hint="Бот готовит тексты при создании встречи. Проверьте текст и либо опубликуйте сразу, либо одобрите и поставьте время — по расписанию уходят только одобренные посты."
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
          {scheduled.length > 0 && (
            <>
              {' · '}
              запланировано постов: {scheduled.length}
            </>
          )}
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
            <PostCard
              key={post.id}
              post={post}
              chats={chats}
              maxAttempts={maxAttempts}
              onChanged={reload}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

type Busy =
  | 'save'
  | 'refresh'
  | 'publish'
  | 'delete'
  | 'approve'
  | 'schedule'
  | 'poster'
  | null

function PostCard({
  post,
  chats,
  maxAttempts,
  onChanged,
}: {
  post: PostDraft
  chats: AnnounceChat[]
  maxAttempts: number
  onChanged: () => void
}) {
  const [text, setText] = useState(post.text)
  // Пусто = все группы: выбор нужен, только когда групп несколько.
  const [selected, setSelected] = useState<number[]>(post.scheduled_chats ?? [])
  const [when, setWhen] = useState(() =>
    mskInputValue(post.scheduled_at ?? post.suggested_at ?? Date.now()),
  )
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty = text.trim() !== post.text.trim()
  const targets = selected.length > 0 ? selected : chats.map((c) => c.chat_id)
  const approved = post.approved_at !== null

  async function run(kind: Busy, fn: () => Promise<string | null>) {
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
            {post.edited ? ' · текст правили' : ''}
          </p>
        </div>
        <StatusBadge post={post} />
      </div>

      {post.status === 'sent' ? (
        <>
          {sentWhere && (
            <p className="mt-2 text-xs text-ink-soft">
              ушёл в {sentWhere}
              {post.sent_at ? ` · ${mskLabel(post.sent_at)}` : ''}
            </p>
          )}
          <PosterBlock post={post} readOnly />
          <p className="mt-3 whitespace-pre-line rounded-control bg-surface-2 p-3 text-sm text-ink-soft">
            {post.text}
          </p>
        </>
      ) : (
        <>
          <PosterBlock
            post={post}
            busy={busy === 'poster'}
            disabled={busy !== null}
            onPick={(bytes) =>
              void run('poster', async () => {
                await setPostPoster(post.id, bytes)
                onChanged()
                return bytes ? 'Картинка обновлена.' : 'Картинка убрана.'
              })
            }
          />

          <div className="mt-4">
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

          {/* Одобрение и расписание: без одобрения бот сам ничего не отправит. */}
          <div className="mt-4 rounded-card border border-line bg-surface-2 p-3">
            {approved ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-medium">Текст одобрен — можно ставить время</p>
                  <Button
                    variant="ghost"
                    disabled={busy !== null}
                    loading={busy === 'approve'}
                    onClick={() =>
                      void run('approve', async () => {
                        await approvePost(post.id, false)
                        onChanged()
                        return 'Одобрение снято, расписание тоже.'
                      })
                    }
                  >
                    Забрать на доработку
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Поле фиксированной ширины: иначе w-full контрола растягивает
                      строку и подпись «МСК» уезжает на следующую. */}
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="w-44">
                      <TextInput
                        type="datetime-local"
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                        aria-label="Время публикации (МСК)"
                      />
                    </div>
                    <span className="text-xs text-ink-faint">МСК</span>
                  </div>
                  <Button
                    disabled={busy !== null || chats.length === 0}
                    loading={busy === 'schedule'}
                    onClick={() =>
                      void run('schedule', async () => {
                        const at = mskInputToMs(when)
                        if (at === null) return 'Не разобрал дату — проверьте поле.'
                        if (dirty) await savePostText(post.id, text.trim())
                        await schedulePost(post.id, at, selected)
                        onChanged()
                        return `Опубликуем ${mskLabel(at)}.`
                      })
                    }
                  >
                    {post.scheduled_at === null ? 'Запланировать' : 'Перенести'}
                  </Button>
                  {post.scheduled_at !== null && (
                    <Button
                      variant="ghost"
                      disabled={busy !== null}
                      loading={busy === 'schedule'}
                      onClick={() =>
                        void run('schedule', async () => {
                          await schedulePost(post.id, null)
                          onChanged()
                          return 'Расписание снято — публикуйте вручную.'
                        })
                      }
                    >
                      Снять расписание
                    </Button>
                  )}
                </div>
                <p className="text-xs text-ink-faint">
                  Бот сверяется с расписанием раз в 5 минут, поэтому пост уйдёт в течение
                  пяти минут после указанного времени.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-ink-soft">
                  Чтобы поставить публикацию по расписанию, сначала одобрите текст.
                </p>
                <Button
                  disabled={busy !== null}
                  loading={busy === 'approve'}
                  onClick={() =>
                    void run('approve', async () => {
                      if (dirty) await savePostText(post.id, text.trim())
                      await approvePost(post.id)
                      onChanged()
                      return 'Текст одобрен.'
                    })
                  }
                >
                  Одобрить
                </Button>
              </div>
            )}
          </div>

          {post.publish_error && (
            <p className="mt-3 text-sm text-danger">
              Автопубликация не удалась ({post.attempts} из {maxAttempts} попыток):{' '}
              {post.publish_error}
              {post.attempts >= maxAttempts && ' — бот больше не пробует, опубликуйте вручную.'}
            </p>
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
                ? `Опубликовать сейчас (${targets.length})`
                : 'Опубликовать сейчас'}
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

/** Состояние поста одной плашкой: важно, что уже нельзя отменить. */
function StatusBadge({ post }: { post: PostDraft }) {
  if (post.status === 'sent') {
    return (
      <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
        опубликован
      </span>
    )
  }
  if (post.scheduled_at !== null) {
    return (
      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-ink">
        уйдёт {mskLabel(post.scheduled_at)}
      </span>
    )
  }
  if (post.approved_at !== null) {
    return (
      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
        одобрен, время не задано
      </span>
    )
  }
  return (
    <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
      черновик
    </span>
  )
}

/** Telegram принимает фото до 10 МБ. */
const MAX_POSTER_BYTES = 10 * 1024 * 1024

/**
 * Картинка поста: превью + замена. Афиша не попадает в репозиторий — она уходит
 * в Telegram, поэтому в WebP не конвертируется (JPEG/PNG надёжнее для sendPhoto).
 */
function PosterBlock({
  post,
  readOnly = false,
  busy = false,
  disabled = false,
  onPick,
}: {
  post: PostDraft
  readOnly?: boolean
  busy?: boolean
  disabled?: boolean
  onPick?: (bytes: Uint8Array | null) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!post.has_poster) {
      setSrc(null)
      return
    }
    let url: string | null = null
    let alive = true
    fetchPostPoster(post.id)
      .then((blob) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => setSrc(null))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // updated_at меняется при замене картинки — перечитываем превью.
  }, [post.id, post.has_poster, post.updated_at])

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file || !onPick) return
    if (file.size > MAX_POSTER_BYTES) {
      setError(`Файл ${(file.size / 1024 / 1024).toFixed(1)} МБ — Telegram примет до 10 МБ`)
      return
    }
    onPick(new Uint8Array(await file.arrayBuffer()))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-14 w-24 shrink-0 rounded-control border border-line object-cover"
        />
      ) : (
        <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-control border border-dashed border-line text-[11px] text-ink-faint">
          без картинки
        </div>
      )}

      {readOnly ? null : (
        <div className="min-w-0 flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(e) => void handleFile(e.target.files?.[0])}
            className="block w-full text-[13px] text-ink-soft file:mr-3 file:rounded-control file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[13px] file:font-medium file:text-ink hover:file:border-line-strong disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-ink-faint">
            {post.has_poster
              ? 'Выберите файл, чтобы заменить картинку.'
              : 'JPEG или PNG до 10 МБ. У напоминания без своей картинки бот возьмёт афишу дня.'}
          </p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      )}

      {!readOnly && post.has_poster && (
        <Button
          variant="ghost"
          disabled={disabled}
          loading={busy}
          onClick={() => onPick?.(null)}
        >
          Убрать картинку
        </Button>
      )}
    </div>
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
