import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorBox, SectionTitle } from '../components/ui'
import { getToken } from '../lib/auth'
import {
  decideClaim,
  fetchClaimPhoto,
  getBotToken,
  listSpeakerClaims,
  type SpeakerClaim,
} from '../lib/botApi'
import { useDataClient, useIndex, useLoad } from '../lib/hooks'
import { mediaUrl } from '../lib/repo'
import type { ClubEvent } from '../types'
import { cleanupTalkForClaim, generateTalkForClaim } from '../lib/talksApi'

// Встреча заявки: номер стрима + дата + признак завершённости (для архива).
interface Meeting {
  stream: number | null
  date: string
  finished: boolean
}

type Tab = 'active' | 'archive'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Модерация заявок спикеров (данные — из D1 бота, TG у админа лишь уведомляшка).
// Две вкладки: активные (встреча ещё не прошла) и архив; активные сгруппированы
// по «Книжный клуб N». Подтвердить → бот пишет спикеру и запускается генерация
// презентации. «Оформить спикером» ведёт в предзаполненную форму спикера.
export function Claims() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const [claims, setClaims] = useState<SpeakerClaim[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [genMsg, setGenMsg] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Record<number, string>>({})
  const [tab, setTab] = useState<Tab>('active')

  // Карта встреч-«докладов»: `<book_id>:<chapter>` → номер стрима, дата, finished.
  // Нужна, чтобы понять, к какому «Книжному клубу» относится заявка и прошла ли встреча.
  const meetings = useLoad<Record<string, Meeting>>(async () => {
    if (!index) return {}
    const map: Record<string, Meeting> = {}
    await Promise.all(
      index.events
        .filter((p) => p.startsWith('live-talks/'))
        .map(async (path) => {
          const ev = await gh.getFileJson<ClubEvent>(`events/${path}`)
          if (!ev || ev.type !== 'live-talk' || !ev.book_id || !ev.chapter) return
          const file = path.slice(path.indexOf('/') + 1)
          map[`${ev.book_id}:${ev.chapter}`] = {
            stream: ev.stream ?? null,
            date: file.slice(0, 10),
            finished: Boolean(ev.finished),
          }
        }),
    )
    return map
  }, [gh, index])

  const reload = useCallback(() => {
    setError(null)
    listSpeakerClaims()
      .then(setClaims)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Превью фото: <img> не умеет слать Authorization — качаем blob-ом.
  useEffect(() => {
    for (const claim of claims ?? []) {
      if (!claim.photo_file_id || photos[claim.id]) continue
      fetchClaimPhoto(claim.id)
        .then((blob) =>
          setPhotos((prev) => ({ ...prev, [claim.id]: URL.createObjectURL(blob) })),
        )
        .catch(() => {})
    }
  }, [claims, photos])

  // Генерация презентации по заявке (PR в talks + ссылка в заявку; бот уведомит).
  async function generate(claim: SpeakerClaim) {
    setGenMsg(null)
    setBusy(claim.id)
    try {
      if (!index) throw new Error('Реестр ещё грузится — повторите')
      const url = await generateTalkForClaim(gh, index, claim, getToken() ?? '')
      setGenMsg(`Презентация запущена: ${url}. PR появится в book-club-talks, спикеру ушла инструкция.`)
      reload()
    } catch (err) {
      setGenMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function decide(claim: SpeakerClaim, action: 'confirm' | 'decline') {
    setBusy(claim.id)
    try {
      await decideClaim(claim.id, action)
      // Отмена заявки — убираем за ней PR и ветку доклада в book-club-talks.
      if (action === 'decline' && claim.slides_url) {
        try {
          const branch = await cleanupTalkForClaim(claim, getToken() ?? '')
          if (branch) setGenMsg(`Заявка отклонена, PR и ветка ${branch} в talks удалены.`)
        } catch (cleanErr) {
          setGenMsg(
            `Заявка отклонена, но PR/ветку доклада убрать не вышло: ${cleanErr instanceof Error ? cleanErr.message : String(cleanErr)}`,
          )
        }
      }
      // Подтверждение сразу запускает генерацию презентации (если возможно).
      if (action === 'confirm' && claim.topic_id && claim.speaker_id) {
        try {
          if (!index) throw new Error('Реестр ещё грузится')
          const url = await generateTalkForClaim(gh, index, claim, getToken() ?? '')
          setGenMsg(`Подтверждено, презентация запущена: ${url}`)
        } catch (genErr) {
          setGenMsg(
            `Подтверждено, но презентацию не сгенерировать: ${genErr instanceof Error ? genErr.message : String(genErr)}`,
          )
        }
      }
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  if (!getBotToken()) {
    return (
      <ErrorBox>
        Для модерации заявок нужен админ-токен бота — задайте его на странице входа
        (кнопка «Выйти» → вход заново).
      </ErrorBox>
    )
  }

  const meetingOf = (claim: SpeakerClaim): Meeting | null =>
    claim.book_id && claim.chapter ? (meetings.data?.[`${claim.book_id}:${claim.chapter}`] ?? null) : null

  // В архиве — заявки встреч, которые уже завершены или дата которых прошла.
  const isArchived = (claim: SpeakerClaim): boolean => {
    const m = meetingOf(claim)
    if (!m) return false // вне плана / без встречи — всегда среди активных
    return m.finished || m.date < todayIso()
  }

  // Заголовок группы: «Книжный клуб N», иначе — служебные корзины.
  const groupLabel = (claim: SpeakerClaim): string => {
    const m = meetingOf(claim)
    if (m?.stream) return `Книжный клуб ${m.stream}`
    if (!claim.topic_id) return 'Свои темы (вне плана)'
    return 'Без привязки к встрече'
  }

  const all = claims ?? []
  const active = all.filter((c) => !isArchived(c))
  const archive = all.filter((c) => isArchived(c))
  const visible = tab === 'active' ? active : archive

  // Группировка по встрече: стримы по убыванию номера, служебные корзины — в конец.
  const groups = new Map<string, SpeakerClaim[]>()
  for (const claim of visible) {
    const label = groupLabel(claim)
    ;(groups.get(label) ?? groups.set(label, []).get(label)!).push(claim)
  }
  const streamNo = (label: string): number => {
    const m = label.match(/^Книжный клуб (\d+)$/)
    return m ? Number(m[1]) : -1
  }
  const orderedGroups = [...groups.entries()].sort((a, b) => streamNo(b[0]) - streamNo(a[0]))

  function renderClaim(claim: SpeakerClaim) {
    // Аватар: фото из заявки (если прислали) либо каталожный по speaker_id
    // (узнанные по Telegram фото не присылают — берём из каталога).
    const catalogAvatar = claim.speaker_id
      ? mediaUrl(index?.speakers?.find((s) => s.id === claim.speaker_id)?.avatar)
      : undefined
    const avatarSrc = photos[claim.id] ?? catalogAvatar
    return (
      <div key={claim.id} className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start gap-4">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-gray-50 text-xs text-muted">
              нет фото
            </div>
          )}
          <div className="min-w-0 grow">
            <p className="font-medium">{claim.topic_title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {claim.topic_id ? (
                <>
                  тема плана <code>{claim.topic_id}</code>
                  {claim.chapter && <> · глава <code>{claim.chapter}</code></>}
                </>
              ) : (
                'своя тема (вне плана)'
              )}
            </p>
            <p className="mt-1 text-sm">
              {claim.full_name ?? 'Имя не указано'}
              {claim.username && (
                <a
                  href={`https://t.me/${claim.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-muted underline decoration-line underline-offset-2"
                >
                  @{claim.username}
                </a>
              )}
              {claim.speaker_id ? (
                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  узнан по Telegram
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  личность не проверена
                </span>
              )}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              claim.status === 'confirmed'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {claim.status === 'confirmed' ? 'подтверждена' : 'на модерации'}
          </span>
        </div>

        {claim.slides_url && (
          <p className="mt-3 text-sm">
            Презентация:{' '}
            <a
              href={claim.slides_url}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              {claim.slides_url}
            </a>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {claim.status === 'pending' && (
            <Button disabled={busy === claim.id} onClick={() => void decide(claim, 'confirm')}>
              Подтвердить{claim.speaker_id ? ' и сгенерировать' : ''}
            </Button>
          )}
          {claim.status === 'confirmed' && claim.speaker_id && !claim.slides_url && (
            <Button disabled={busy === claim.id} onClick={() => void generate(claim)}>
              Сгенерировать презентацию
            </Button>
          )}
          {claim.status === 'confirmed' && !claim.speaker_id && (
            <Link
              to={`/speakers/new?claim=${claim.id}`}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85"
            >
              Оформить спикером
            </Link>
          )}
          <Button
            variant="danger"
            disabled={busy === claim.id}
            onClick={() => void decide(claim, 'decline')}
          >
            Отклонить{claim.topic_id ? ' (освободит тему)' : ''}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle>Заявки спикеров</SectionTitle>

      {error && <ErrorBox>{error}</ErrorBox>}
      {claims === null && !error && <p className="text-sm text-muted">Загружаем заявки…</p>}

      {claims && claims.length > 0 && (
        <div className="flex gap-2">
          <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
            Активные ({active.length})
          </TabButton>
          <TabButton active={tab === 'archive'} onClick={() => setTab('archive')}>
            Архив ({archive.length})
          </TabButton>
        </div>
      )}

      {claims?.length === 0 && (
        <p className="text-sm text-muted">Заявок нет. Участники подают их боту командой /speaker.</p>
      )}
      {claims && claims.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted">
          {tab === 'active' ? 'Активных заявок нет.' : 'Архив пуст.'}
        </p>
      )}

      {orderedGroups.map(([label, groupClaims]) => (
        <section key={label} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {label} · {groupClaims.length}
          </h2>
          {groupClaims.map(renderClaim)}
        </section>
      ))}

      {genMsg && <p className="text-sm text-muted">{genMsg}</p>}
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
          ? 'rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white'
          : 'rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:text-ink'
      }
    >
      {children}
    </button>
  )
}
