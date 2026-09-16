// Core domain types for Lap.
// A "Volume" is one GitHub private repo, mounted like a disk.
// A "Node" is a file or folder inside a volume's git tree.

export interface Volume {
  owner: string
  repo: string
  defaultBranch: string
  private: boolean
  addedAt: number
  color?: string // accent color for the drive icon
}

export type NodeType = 'file' | 'folder'

/** Flat entry as returned by the GitHub recursive tree API. */
export interface RawTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

/** A node in the in-memory folder tree we build from RawTreeEntry[]. */
export interface FsNode {
  name: string
  path: string // full path from volume root, '' = root
  type: NodeType
  sha?: string // blob sha (files only) — used for updates/deletes/reads
  size?: number
  children?: Map<string, FsNode> // folders only
}

export interface Selection {
  volume: Volume | null
  path: string // current folder path, '' = root
  selected: Set<string> // selected node paths within current folder
}

export interface PendingChange {
  path: string
  sha: string | null // null = delete this path
}
