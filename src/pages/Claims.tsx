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
import { useDataClient, useIndex } from '../lib/hooks'
import { cleanupTalkForClaim, generateTalkForClaim } from '../lib/talksApi'

// Модерация заявок спикеров (данные — из D1 бота, TG у админа лишь уведомляшка).
// Подтвердить → бот пишет спикеру и запускается генерация презентации (PR в
// book-club-talks, ссылка проставляется в заявку). «Оформить спикером» ведёт
// в предзаполненную форму спикера (фото подтянется и сконвертируется в WebP).
export function Claims() {
  const gh = useDataClient()
  const { data: index } = useIndex(gh)
  const [claims, setClaims] = useState<SpeakerClaim[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [genMsg, setGenMsg] = useState<string | null>(null)
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

  // Генерация презентации по заявке (PR в talks + ссылка в заявку; бот уведомит).
  async function generate(claim: SpeakerClaim) {
    setGenMsg(null)
    setBusy(claim.id)
    try {
      if (!index) throw new Error('Реестр ещё грузится — повторите')
      const url = await generateTalkForClaim(gh, index, claim, getToken() ?? '')
      setGenMsg(`✓ Презентация запущена: ${url}. PR появится в book-club-talks, спикеру ушла инструкция.`)
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
          if (branch) setGenMsg(`✓ Заявка отклонена, PR и ветка ${branch} в talks удалены.`)
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
          setGenMsg(`✓ Подтверждено, презентация запущена: ${url}`)
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
                {claim.speaker_id ? (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    ✓ узнан по Telegram
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
              🎤 Презентация:{' '}
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
                ✅ Подтвердить{claim.speaker_id ? ' и сгенерировать' : ''}
              </Button>
            )}
            {claim.status === 'confirmed' && claim.speaker_id && !claim.slides_url && (
              <Button disabled={busy === claim.id} onClick={() => void generate(claim)}>
                🎤 Сгенерировать презентацию
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
              ❌ Отклонить{claim.topic_id ? ' (освободит тему)' : ''}
            </Button>
          </div>
        </div>
      ))}

      {genMsg && <p className="text-sm text-muted">{genMsg}</p>}
    </div>
  )
}
