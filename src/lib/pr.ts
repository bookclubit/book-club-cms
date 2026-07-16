// Движок публикации: набор файлов → ветка → один коммит → pull request.
// Использует Git Data API, чтобы текст и бинарные WebP легли одним коммитом.

import { GitHubClient, GitHubError, type TreeEntry } from './github'

export interface FileChange {
  path: string
  content: string | Uint8Array | null // null — удалить файл (например, при переносе)
}

export interface OpenPROptions {
  branch: string
  title: string
  body: string
  commitMessage?: string
  files: FileChange[]
  base?: string
}

export interface OpenPRResult {
  number: number
  url: string
  branch: string
}

// Если ветка занята (PR с таким slug уже открывали), пробуем -2, -3…
async function createFreeBranch(
  gh: GitHubClient,
  name: string,
  fromSha: string,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? name : `${name}-${attempt + 1}`
    try {
      await gh.createBranch(candidate, fromSha)
      return candidate
    } catch (err) {
      const taken = err instanceof GitHubError && err.status === 422
      if (!taken) throw err
    }
  }
  throw new Error(`Не удалось создать ветку: все имена вида ${name}-N заняты`)
}

export async function openContentPR(
  gh: GitHubClient,
  options: OpenPROptions,
): Promise<OpenPRResult> {
  const base = options.base ?? 'main'
  const baseSha = await gh.getBranchHead(base)
  const baseTreeSha = await gh.getCommitTreeSha(baseSha)

  const branch = await createFreeBranch(gh, options.branch, baseSha)

  const entries: TreeEntry[] = await Promise.all(
    options.files.map(async (file) => ({
      path: file.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: file.content === null ? null : await gh.createBlob(file.content),
    })),
  )

  const treeSha = await gh.createTree(baseTreeSha, entries)
  const commitSha = await gh.createCommit(
    options.commitMessage ?? options.title,
    treeSha,
    baseSha,
  )
  await gh.updateBranchHead(branch, commitSha)

  const pr = await gh.createPullRequest(branch, base, options.title, options.body)
  return { number: pr.number, url: pr.html_url, branch }
}

// JSON в стиле репозитория: 2 пробела, перевод строки в конце (prettier-совместимо).
export function toJSON(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n'
}
