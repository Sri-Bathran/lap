// Zips a folder's files (fetched on demand from GitHub blobs) for download,
// so "send someone a folder" works exactly like it would on a real laptop.

import JSZip from 'jszip'
import type { FsNode, Volume } from '../types'
import { collectFiles } from './github'
import type { GitHubClient } from './github'
import { base64ToBytes, triggerBlobDownload } from './binary'

export async function downloadFolderAsZip(
  client: GitHubClient,
  volume: Volume,
  folder: FsNode,
  zipName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const files = collectFiles(folder)
  const zip = new JSZip()
  let done = 0
  for (const f of files) {
    if (!f.sha) continue
    const { base64 } = await client.getBlobContent(volume, f.sha)
    // path relative to the folder being zipped
    const rel = folder.path ? f.path.slice(folder.path.length + 1) : f.path
    zip.file(rel, base64, { base64: true })
    done++
    onProgress?.(done, files.length)
  }
  const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  triggerBlobDownload(blob, `${zipName}.zip`, 'application/zip')
}

export async function downloadFile(client: GitHubClient, volume: Volume, node: FsNode): Promise<void> {
  if (!node.sha) return
  const { base64 } = await client.getBlobContent(volume, node.sha)
  triggerBlobDownload(base64ToBytes(base64), node.name)
}

/** Zips an arbitrary multi-select (mix of files and folders) into one archive. */
export async function downloadSelectionAsZip(
  client: GitHubClient,
  volume: Volume,
  nodes: FsNode[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const zip = new JSZip()
  const allFiles: { node: FsNode; zipPath: string }[] = []
  for (const n of nodes) {
    if (n.type === 'file') {
      allFiles.push({ node: n, zipPath: n.name })
    } else {
      for (const f of collectFiles(n)) {
        allFiles.push({ node: f, zipPath: `${n.name}${f.path.slice(n.path.length)}` })
      }
    }
  }
  let done = 0
  for (const { node, zipPath } of allFiles) {
    if (!node.sha) continue
    const { base64 } = await client.getBlobContent(volume, node.sha)
    zip.file(zipPath, base64, { base64: true })
    done++
    onProgress?.(done, allFiles.length)
  }
  const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  triggerBlobDownload(blob, `${zipName}.zip`, 'application/zip')
}
