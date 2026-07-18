import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorBox, SectionTitle } from '../components/ui'
import {
  decideClaim,
  fetchClaimPhoto,
  getBotToken,
  listSpeakerClaims,
  type SpeakerClaim,
} from '../lib/botApi'

// Модерация заявок спикеров (данные — из D1 бота, TG у админа лишь уведомляшка).
// Подтвердить/отклонить → бот сам напишет спикеру. «Оформить спикером» ведёт
// в предзаполненную форму спикера (фото подтянется и сконвертируется в WebP).
export function Claims() {
  const [claims, setClaims] = useState<SpeakerClaim[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [photos, setPhotos] = useState<Record<number, string>>({})

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

  async function decide(claim: SpeakerClaim, action: 'confirm' | 'decline') {
    setBusy(claim.id)
    try {
      await decideClaim(claim.id, action)
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

  return (
    <div className="space-y-6">
      <SectionTitle>Заявки спикеров</SectionTitle>

      {error && <ErrorBox>{error}</ErrorBox>}
      {claims === null && !error && <p className="text-sm text-muted">Загружаем заявки…</p>}
      {claims?.length === 0 && (
        <p className="text-sm text-muted">Заявок нет. Участники подают их боту командой /speaker.</p>
      )}

      {claims?.map((claim) => (
        <div key={claim.id} className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-start gap-4">
            {photos[claim.id] ? (
              <img
                src={photos[claim.id]}
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
                {claim.speaker_id && (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    ✓ в каталоге
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

          <div className="mt-4 flex flex-wrap gap-2">
            {claim.status === 'pending' && (
              <Button disabled={busy === claim.id} onClick={() => void decide(claim, 'confirm')}>
                ✅ Подтвердить
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
            {claim.status === 'confirmed' && claim.speaker_id && (
              <span className="self-center text-sm text-muted">
                Спикер уже в каталоге — оформлять не нужно.
              </span>
            )}
            <Button
              variant="danger"
              disabled={busy === claim.id}
              onClick={() => void decide(claim, 'decline')}
            >
              ❌ Отклонить{claim.topic_id ? ' (освободит тему)' : ''}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
