// Клиент GitHub REST API. Работает и в браузере (fetch + btoa), и в Node
// (fetch + Buffer) — один и тот же код используется страницами CMS и
// скриптами в scripts/. api.github.com отдаёт CORS-заголовки, поэтому
// бэкенд не нужен: токен админа остаётся в его браузере.

const API = 'https://api.github.com'

export class GitHubError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

export interface TreeEntry {
  path: string
  mode: '100644'
  type: 'blob'
  sha: string | null // null — удалить файл из дерева
}

export interface DirEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

export interface PullRequestInfo {
  number: number
  html_url: string
  title: string
  head: { ref: string }
  created_at: string
}

function bytesToBase64(data: Uint8Array): string {
  // В Node (scripts/) есть Buffer; в браузере кодируем через btoa.
  const nodeBuffer = (
    globalThis as {
      Buffer?: { from(d: Uint8Array): { toString(enc: 'base64'): string } }
    }
  ).Buffer
  if (nodeBuffer) {
    return nodeBuffer.from(data).toString('base64')
  }
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function encodeContent(content: string | Uint8Array): string {
  const bytes =
    typeof content === 'string' ? new TextEncoder().encode(content) : content
  return bytesToBase64(bytes)
}

export class GitHubClient {
  private token: string
  readonly owner: string
  readonly repo: string

  constructor(token: string, owner: string, repo: string) {
    this.token = token
    this.owner = owner
    this.repo = repo
  }

  private async request<T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init?.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    if (!res.ok) {
      let message = `GitHub API ${res.status}`
      try {
        const data = (await res.json()) as { message?: string }
        if (data.message) message = data.message
      } catch {
        // тело не JSON — оставляем статус
      }
      throw new GitHubError(res.status, message)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  private get repoPath(): string {
    return `/repos/${this.owner}/${this.repo}`
  }

  async getViewerLogin(): Promise<string> {
    const user = await this.request<{ login: string }>('/user')
    return user.login
  }

  // repository_dispatch — запускает workflow этого репозитория с полезной нагрузкой.
  async repositoryDispatch(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.request(`${this.repoPath}/dispatches`, {
      method: 'POST',
      body: { event_type: eventType, client_payload: payload },
    })
  }

  // Проверка доступа: токен должен видеть репозиторий и иметь право пушить.
  async checkAccess(): Promise<{ canPush: boolean; defaultBranch: string }> {
    const repo = await this.request<{
      permissions?: { push?: boolean }
      default_branch: string
    }>(this.repoPath)
    return {
      canPush: Boolean(repo.permissions?.push),
      defaultBranch: repo.default_branch,
    }
  }

  async getBranchHead(branch: string): Promise<string> {
    const ref = await this.request<{ object: { sha: string } }>(
      `${this.repoPath}/git/ref/${encodeURIComponent(`heads/${branch}`)}`,
    )
    return ref.object.sha
  }

  async getCommitTreeSha(commitSha: string): Promise<string> {
    const commit = await this.request<{ tree: { sha: string } }>(
      `${this.repoPath}/git/commits/${commitSha}`,
    )
    return commit.tree.sha
  }

  async createBranch(name: string, fromSha: string): Promise<void> {
    await this.request(`${this.repoPath}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/heads/${name}`, sha: fromSha },
    })
  }

  async createBlob(content: string | Uint8Array): Promise<string> {
    const blob = await this.request<{ sha: string }>(
      `${this.repoPath}/git/blobs`,
      {
        method: 'POST',
        body: { content: encodeContent(content), encoding: 'base64' },
      },
    )
    return blob.sha
  }

  async createTree(baseTreeSha: string, entries: TreeEntry[]): Promise<string> {
    const tree = await this.request<{ sha: string }>(
      `${this.repoPath}/git/trees`,
      {
        method: 'POST',
        body: { base_tree: baseTreeSha, tree: entries },
      },
    )
    return tree.sha
  }

  async createCommit(
    message: string,
    treeSha: string,
    parentSha: string,
  ): Promise<string> {
    const commit = await this.request<{ sha: string }>(
      `${this.repoPath}/git/commits`,
      {
        method: 'POST',
        body: { message, tree: treeSha, parents: [parentSha] },
      },
    )
    return commit.sha
  }

  async updateBranchHead(branch: string, sha: string): Promise<void> {
    await this.request(
      `${this.repoPath}/git/refs/${encodeURIComponent(`heads/${branch}`)}`,
      { method: 'PATCH', body: { sha } },
    )
  }

  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<PullRequestInfo> {
    return this.request<PullRequestInfo>(`${this.repoPath}/pulls`, {
      method: 'POST',
      body: { head, base, title, body },
    })
  }

  async listOpenPullRequests(): Promise<PullRequestInfo[]> {
    return this.request<PullRequestInfo[]>(
      `${this.repoPath}/pulls?state=open&per_page=30`,
    )
  }

  // Содержимое файла с ветки. null — файла нет (404).
  async getFileText(path: string, ref = 'main'): Promise<string | null> {
    const res = await fetch(
      `${API}${this.repoPath}/contents/${path}?ref=${encodeURIComponent(ref)}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.raw+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )
    if (res.status === 404) return null
    if (!res.ok) throw new GitHubError(res.status, `GitHub API ${res.status}`)
    return res.text()
  }

  async getFileJson<T>(path: string, ref = 'main'): Promise<T | null> {
    const text = await this.getFileText(path, ref)
    if (text === null) return null
    return JSON.parse(text) as T
  }

  // Список записей директории. null — директории нет.
  async listDir(path: string, ref = 'main'): Promise<DirEntry[] | null> {
    try {
      const entries = await this.request<
        Array<{ name: string; path: string; type: string }>
      >(`${this.repoPath}/contents/${path}?ref=${encodeURIComponent(ref)}`)
      if (!Array.isArray(entries)) return null
      return entries.map((e) => ({
        name: e.name,
        path: e.path,
        type: e.type === 'dir' ? 'dir' : 'file',
      }))
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null
      throw err
    }
  }
}
