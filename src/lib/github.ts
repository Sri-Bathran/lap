// Thin wrapper over the GitHub REST + Git Data APIs.
//
// The key design idea: every filesystem mutation (delete, rename, move,
// create folder) is expressed as a single commit that rewrites the git tree,
// reusing existing blob shas wherever content doesn't actually change. That
// means moving a 50MB file costs nothing — we never re-upload its bytes.

import type { FsNode, PendingChange, RawTreeEntry, Volume } from '../types'

const API = 'https://api.github.com'

export class GitHubError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'GitHubError'
  }
}

export class GitHubClient {
  constructor(private token: string) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
    if (!res.ok) {
      let detail = ''
      try {
        const body = await res.json()
        detail = body.message ?? JSON.stringify(body)
      } catch {
        /* ignore */
      }
      throw new GitHubError(res.status, detail || `GitHub API error ${res.status}`)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  async verifyToken(): Promise<{ login: string }> {
    return this.req('/user')
  }

  // ---- Repos (volumes) ------------------------------------------------

  async listPrivateRepos(): Promise<
    { name: string; owner: { login: string }; private: boolean; default_branch: string }[]
  > {
    const out: any[] = []
    let page = 1
    for (;;) {
      const batch: any[] = await this.req(
        `/user/repos?visibility=private&per_page=100&page=${page}&sort=updated`,
      )
      out.push(...batch)
      if (batch.length < 100) break
      page++
    }
    return out
  }

  async createVolumeRepo(name: string): Promise<{ owner: string; repo: string; defaultBranch: string }> {
    const repo = await this.req<any>('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        private: true,
        auto_init: true, // creates an initial commit so the tree/ref exist
        description: 'Lap volume — a GitHub-backed drive',
      }),
    })
    return { owner: repo.owner.login, repo: repo.name, defaultBranch: repo.default_branch }
  }

  // ---- Tree read --------------------------------------------------------

  async getDefaultBranchTipSha(v: Volume): Promise<string> {
    const ref = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/ref/heads/${v.defaultBranch}`)
    return ref.object.sha
  }

  /** Fetches the full recursive tree for the volume's current commit. */
  async getFullTree(v: Volume): Promise<{ commitSha: string; treeSha: string; entries: RawTreeEntry[] }> {
    const commitSha = await this.getDefaultBranchTipSha(v)
    const commit = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/commits/${commitSha}`)
    const treeSha = commit.tree.sha
    const tree = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/trees/${treeSha}?recursive=1`)
    const entries: RawTreeEntry[] = (tree.tree as any[])
      .filter((e) => e.type === 'blob')
      .map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha, size: e.size }))
    return { commitSha, treeSha, entries }
  }

  // ---- Blob content -------------------------------------------------------

  async getBlobContent(v: Volume, sha: string): Promise<{ base64: string; size: number }> {
    const blob = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/blobs/${sha}`)
    return { base64: blob.content.replace(/\n/g, ''), size: blob.size }
  }

  async createBlob(v: Volume, base64Content: string): Promise<string> {
    const res = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: base64Content, encoding: 'base64' }),
    })
    return res.sha
  }

  // ---- The one primitive: commit a set of path->sha changes -------------

  /**
   * Applies `changes` (path -> blob sha, or null to delete that path) as a
   * single commit on top of the current tip. Unlisted paths are untouched.
   */
  async commitChanges(v: Volume, changes: PendingChange[], message: string): Promise<string> {
    const commitSha = await this.getDefaultBranchTipSha(v)
    const commit = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/commits/${commitSha}`)
    const baseTreeSha = commit.tree.sha

    const newTree = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: changes.map((c) => ({
          path: c.path,
          mode: '100644',
          type: 'blob',
          sha: c.sha, // null deletes this exact path
        })),
      }),
    })

    const newCommit = await this.req<any>(`/repos/${v.owner}/${v.repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [commitSha],
      }),
    })

    await this.req(`/repos/${v.owner}/${v.repo}/git/refs/heads/${v.defaultBranch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha }),
    })

    return newCommit.sha
  }

  // ---- Convenience wrappers built on commitChanges -----------------------

  async uploadFile(v: Volume, path: string, base64Content: string, message: string): Promise<void> {
    const sha = await this.createBlob(v, base64Content)
    await this.commitChanges(v, [{ path, sha }], message)
  }

  async createFolder(v: Volume, path: string): Promise<void> {
    // EMPTY_BLOB_SHA is deterministic (git hashes empty content the same
    // way everywhere), but that doesn't mean the object already exists in
    // THIS repo's store — a fresh repo has never created it, and GitHub
    // rejects a tree entry pointing at a blob sha it doesn't have. Creating
    // it here is idempotent: it returns that same well-known sha either way.
    const sha = await this.createBlob(v, '')
    await this.commitChanges(v, [{ path: `${path}/.gitkeep`, sha }], `Create folder ${path}`)
  }

  async deletePaths(v: Volume, paths: string[], message: string): Promise<void> {
    await this.commitChanges(
      v,
      paths.map((path) => ({ path, sha: null })),
      message,
    )
  }
}

// ---- Tree building ----------------------------------------------------

/** Builds a nested folder structure from GitHub's flat recursive tree list. */
export function buildFsTree(entries: RawTreeEntry[]): FsNode {
  const root: FsNode = { name: '', path: '', type: 'folder', children: new Map() }
  for (const entry of entries) {
    const parts = entry.path.split('/')
    const fileName = parts[parts.length - 1]
    if (fileName === '.gitkeep' && parts.length > 1) {
      // Placeholder file — ensure the folder exists but don't list it.
      ensureFolderPath(root, parts.slice(0, -1))
      continue
    }
    let cur = root
    for (let i = 0; i < parts.length - 1; i++) {
      cur = ensureFolder(cur, parts[i], parts.slice(0, i + 1).join('/'))
    }
    cur.children!.set(fileName, {
      name: fileName,
      path: entry.path,
      type: 'file',
      sha: entry.sha,
      size: entry.size,
    })
  }
  return root
}

function ensureFolder(parent: FsNode, name: string, path: string): FsNode {
  let node = parent.children!.get(name)
  if (!node || node.type !== 'folder') {
    node = { name, path, type: 'folder', children: new Map() }
    parent.children!.set(name, node)
  }
  return node
}

function ensureFolderPath(root: FsNode, parts: string[]): void {
  let cur = root
  for (let i = 0; i < parts.length; i++) {
    cur = ensureFolder(cur, parts[i], parts.slice(0, i + 1).join('/'))
  }
}

export function findNode(root: FsNode, path: string): FsNode | undefined {
  if (path === '') return root
  const parts = path.split('/')
  let cur = root
  for (const part of parts) {
    const next = cur.children?.get(part)
    if (!next) return undefined
    cur = next
  }
  return cur
}

/** All blob (file) descendants of a folder node, inclusive of nested folders. */
export function collectFiles(node: FsNode): FsNode[] {
  const out: FsNode[] = []
  const walk = (n: FsNode) => {
    if (n.type === 'file') {
      out.push(n)
      return
    }
    for (const child of n.children?.values() ?? []) walk(child)
  }
  walk(node)
  return out
}

/**
 * Every folder in this subtree (including the node itself) that currently
 * has no children — each one exists on GitHub only as a `.gitkeep`
 * placeholder blob, a path collectFiles() never surfaces since buildFsTree
 * deliberately hides that file from the visible tree. Any operation that
 * only walks collectFiles() silently drops empty folders: deleting one
 * does nothing, and moving/copying/renaming a folder that contains an
 * empty subfolder leaves that subfolder behind as an orphan.
 */
export function collectEmptyFolders(node: FsNode): FsNode[] {
  if (node.type === 'file') return []
  const children = [...(node.children?.values() ?? [])]
  if (children.length === 0) return [node]
  return children.flatMap(collectEmptyFolders)
}

/** True size of a node — a file's own size, or a folder's total recursive size. */
export function nodeSize(node: FsNode): number {
  if (node.type === 'file') return node.size ?? 0
  return collectFiles(node).reduce((sum, f) => sum + (f.size ?? 0), 0)
}

/** Picks a non-colliding name for pasting/copying into a folder ("x" -> "x copy" -> "x copy 2"). */
export function uniqueChildName(parent: FsNode | undefined, desired: string): string {
  if (!parent?.children?.has(desired)) return desired
  const dot = desired.lastIndexOf('.')
  const base = dot > 0 ? desired.slice(0, dot) : desired
  const ext = dot > 0 ? desired.slice(dot) : ''
  let candidate = `${base} copy${ext}`
  let i = 2
  while (parent.children!.has(candidate)) {
    candidate = `${base} copy ${i}${ext}`
    i++
  }
  return candidate
}
