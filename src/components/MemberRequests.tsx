import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorBox, Loading } from './ui'
import {
  decideMember,
  fetchMemberPhoto,
  listMembers,
  type MembershipRequest,
} from '../lib/botApi'

// Заявки на участие в клубе: без одобренной заявки человек не может взять тему
// доклада (ни в боте, ни в приложении). Решение — здесь; бот сам напишет
// человеку. Дальше «Оформить спикером» создаёт профиль в каталоге.
export function MemberRequests() {
  const [members, setMembers] = useState<MembershipRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [photos, setPhotos] = useState<Record<number, string>>({})
  const [showDecided, setShowDecided] = useState(false)

  const reload = useCallback(() => {
    setError(null)
    listMembers()
      .then(setMembers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Превью фото: <img> не умеет слать Authorization — качаем blob-ом.
  useEffect(() => {
    for (const member of members ?? []) {
      if (!member.photo_file_id || photos[member.id]) continue
      fetchMemberPhoto(member.id)
        .then((blob) => setPhotos((prev) => ({ ...prev, [member.id]: URL.createObjectURL(blob) })))
        .catch(() => {})
    }
  }, [members, photos])

  async function decide(member: MembershipRequest, action: 'approve' | 'decline') {
    setBusy(member.id)
    try {
      await decideMember(member.id, action)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const all = members ?? []
  const pending = all.filter((m) => m.status === 'pending')
  const decided = all.filter((m) => m.status !== 'pending')
  const visible = showDecided ? all : pending

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Заявки на участие · {pending.length}
        </h2>
        {decided.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDecided((v) => !v)}
            className="text-[13px] text-ink-soft underline decoration-line underline-offset-2 hover:text-ink"
          >
            {showDecided ? 'Только новые' : `Показать решённые (${decided.length})`}
          </button>
        )}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {members === null && !error && <Loading label="Загружаем заявки на участие…" />}
      {members !== null && pending.length === 0 && !showDecided && (
        <p className="text-sm text-ink-soft">
          Новых заявок нет. Их отправляют из приложения клуба или боту командой /speaker.
        </p>
      )}

      {visible.map((member) => (
        <article key={member.id} className="rounded-card border border-line bg-surface p-5">
          <div className="flex items-start gap-4">
            {photos[member.id] || member.photo_url ? (
              <img
                src={photos[member.id] ?? member.photo_url ?? ''}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-xs text-ink-soft">
                нет фото
              </div>
            )}
            <div className="min-w-0 grow">
              <p className="font-medium">{member.full_name ?? 'Имя не указано'}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {member.username ? (
                  <a
                    href={`https://t.me/${member.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-line underline-offset-2"
                  >
                    @{member.username}
                  </a>
                ) : (
                  <>без Telegram-ника</>
                )}
                {' · '}
                {member.source === 'miniapp' ? 'из приложения' : 'из бота'}
                {' · '}
                {new Date(member.created_at).toLocaleDateString('ru-RU')}
              </p>
            </div>
            <StatusBadge status={member.status} />
          </div>

          {/* Профиль спикера заводится по @username: без него бот не узнает человека. */}
          {!member.username && (
            <p className="mt-3 rounded-control bg-warn-soft p-3 text-xs text-warn">
              У человека не задан @username в Telegram — попросите завести, иначе профиль спикера
              не оформить и темы не откроются.
            </p>
          )}

          {member.about && (
            <p className="mt-3 whitespace-pre-line rounded-control bg-surface-2 p-3 text-sm text-ink-soft">
              {member.about}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {member.status !== 'approved' && (
              <Button disabled={busy === member.id} onClick={() => void decide(member, 'approve')}>
                Принять в клуб
              </Button>
            )}
            {member.status === 'approved' && (
              <Link
                to={`/speakers/new?member=${member.id}`}
                className="inline-flex h-8 items-center rounded-control bg-ink px-3 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
              >
                Оформить спикером
              </Link>
            )}
            {member.status !== 'declined' && (
              <Button
                variant="danger"
                disabled={busy === member.id}
                onClick={() => void decide(member, 'decline')}
              >
                Отклонить
              </Button>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

function StatusBadge({ status }: { status: MembershipRequest['status'] }) {
  const label =
    status === 'approved' ? 'в клубе' : status === 'declined' ? 'отклонена' : 'на модерации'
  const tone =
    status === 'approved'
      ? 'bg-success-soft text-success'
      : status === 'declined'
        ? 'bg-surface-2 text-ink-soft'
        : 'bg-warn-soft text-warn'
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  )
}

export default MemberRequests
