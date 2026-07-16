import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ContentIndex } from '../types'
import { getToken } from './auth'
import { GitHubClient } from './github'
import type { OpenPRResult } from './pr'
import { dataClient, loadIndex } from './repo'

// Клиент book-club-data с токеном из localStorage (страницы под гардом — токен есть).
export function useDataClient(): GitHubClient {
  return useMemo(() => dataClient(getToken() ?? ''), [])
}

export interface Loadable<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

// Универсальная загрузка данных для страниц редактирования.
// loader вызывается заново при смене deps (например, параметров маршрута).
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): Loadable<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loader()
      .then((value) => {
        if (!cancelled) setData(value)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

export function useIndex(gh: GitHubClient): Loadable<ContentIndex> {
  const [data, setData] = useState<ContentIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadIndex(gh)
      .then((index) => {
        if (!cancelled) setData(index)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gh, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

export type PublishState =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'done'; result: OpenPRResult }
  | { phase: 'error'; message: string }

// Общий цикл «собрать файлы → открыть PR» для всех форм.
export function usePublish(): {
  state: PublishState
  publish: (fn: () => Promise<OpenPRResult>) => void
  reset: () => void
} {
  const [state, setState] = useState<PublishState>({ phase: 'idle' })

  const publish = useCallback((fn: () => Promise<OpenPRResult>) => {
    setState({ phase: 'working' })
    fn()
      .then((result) => setState({ phase: 'done', result }))
      .catch((err: unknown) =>
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : String(err),
        }),
      )
  }, [])

  const reset = useCallback(() => setState({ phase: 'idle' }), [])
  return { state, publish, reset }
}
