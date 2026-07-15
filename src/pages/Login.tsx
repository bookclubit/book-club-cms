import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, ErrorBox, Field, TextInput } from '../components/ui'
import { setToken } from '../lib/auth'
import { dataClient } from '../lib/repo'

export function Login() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }

  async function submit() {
    const token = value.trim()
    if (!token) return
    setChecking(true)
    setError(null)
    try {
      const gh = dataClient(token)
      const login = await gh.getViewerLogin()
      const access = await gh.checkAccess()
      if (!access.canPush) {
        throw new Error(
          `Токен @${login} не может пушить в bookclubit/book-club-data. Нужны права Contents: Read and write.`,
        )
      }
      setToken(token)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">CMS Книжного клуба</h1>
      <p className="mb-6 text-sm text-muted">
        Админка книжного клуба. Контент публикуется pull request-ами в{' '}
        <span className="font-medium text-ink">bookclubit/book-club-data</span>.
      </p>

      <Card>
        <div className="space-y-4">
          <Field
            label="GitHub token"
            hint="Хранится только в этом браузере (localStorage) и уходит только на api.github.com."
          >
            <TextInput
              type="password"
              placeholder="github_pat_… или ghp_…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              autoFocus
            />
          </Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button onClick={() => void submit()} disabled={checking || !value.trim()}>
            {checking ? 'Проверяем…' : 'Войти'}
          </Button>
        </div>
      </Card>

      <div className="mt-6 rounded-xl border border-line bg-white p-5 text-sm text-muted">
        <p className="mb-2 font-medium text-ink">Как получить токен</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            GitHub → Settings → Developer settings →{' '}
            <a
              className="underline underline-offset-2"
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              Fine-grained tokens → Generate new token
            </a>
          </li>
          <li>Resource owner: <b>bookclubit</b>, repository: <b>book-club-data</b></li>
          <li>
            Permissions: <b>Contents — Read and write</b>, <b>Pull requests — Read and
            write</b>
          </li>
        </ol>
      </div>
    </div>
  )
}
