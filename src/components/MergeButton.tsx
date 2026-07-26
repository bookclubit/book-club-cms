import { useState } from 'react'
import { Button } from './ui'
import { GitHubError } from '../lib/github'
import { useDataClient } from '../lib/hooks'

// Мерж pull request-а прямо из CMS — чтобы за каждой правкой не ходить на GitHub.
// Два шага: «Смержить» → «Точно?». Мерж необратим одним кликом, а список PR-ов
// общий (там и чужие правки), поэтому подтверждение стоит одного лишнего клика.
export function MergeButton({
  number,
  branch,
  onMerged,
}: {
  number: number
  /** Ветка PR — удаляем её после мержа, если знаем (иначе спросим у GitHub). */
  branch?: string
  onMerged: (note: string) => void
}) {
  const gh = useDataClient()
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'working'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function merge() {
    setPhase('working')
    setError(null)
    try {
      // Состояние мержа знает только детальный запрос PR (в списке его нет).
      const pr = await gh.getPullRequest(number)
      if (pr.draft) throw new Error('Это черновик PR — сначала снимите статус draft на GitHub')
      if (pr.mergeable === false || pr.mergeable_state === 'dirty') {
        throw new Error('Конфликт с main — разрешите его на GitHub')
      }
      if (pr.mergeable_state === 'blocked') {
        throw new Error('GitHub не даёт смержить: не прошли проверки или нужен ревью')
      }

      await gh.mergePullRequest(number)
      // Ветку убираем за собой; если её уже удалили — не беда.
      const head = branch ?? pr.head?.ref
      if (head) await gh.deleteBranch(head).catch(() => {})

      const unstable = pr.mergeable_state === 'unstable'
      onMerged(
        `PR #${number} смержен.` +
          (unstable ? ' Внимание: проверки в PR были не зелёные.' : '') +
          ' index.json пересоберётся Action-ом — в списках изменения появятся через минуту.',
      )
      setPhase('idle')
    } catch (err) {
      const message =
        err instanceof GitHubError && err.status === 405
          ? `GitHub отказал в мерже: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      setError(message)
      setPhase('idle')
    }
  }

  return (
    <>
      {phase === 'confirm' ? (
        <span className="flex items-center gap-2">
          <Button onClick={() => void merge()}>Точно смержить</Button>
          <Button variant="ghost" onClick={() => setPhase('idle')}>
            Отмена
          </Button>
        </span>
      ) : (
        <Button
          variant="ghost"
          loading={phase === 'working'}
          disabled={phase === 'working'}
          onClick={() => setPhase('confirm')}
        >
          Смержить
        </Button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </>
  )
}

export default MergeButton
