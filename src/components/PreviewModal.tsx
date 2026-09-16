import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'
// Core build + a curated language set (scripting/security-tool focused)
// instead of the full ~190-language bundle, to keep the app light.
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import powershell from 'highlight.js/lib/languages/powershell'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import csharp from 'highlight.js/lib/languages/csharp'
import java from 'highlight.js/lib/languages/java'
import ruby from 'highlight.js/lib/languages/ruby'
import php from 'highlight.js/lib/languages/php'
import lua from 'highlight.js/lib/languages/lua'
import cpp from 'highlight.js/lib/languages/cpp'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import ini from 'highlight.js/lib/languages/ini'
import 'highlight.js/styles/xcode.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('powershell', powershell)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('java', java)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('php', php)
hljs.registerLanguage('lua', lua)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('ini', ini)
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { FsNode, Volume } from '../types'
import type { GitHubClient } from '../lib/github'
import { base64ToBytes, formatBytes, guessMime } from '../lib/binary'
import { downloadFile } from '../lib/zip'
import { categoryFor, extOf, isTextLike } from '../lib/extensions'

type Kind = 'markdown' | 'code' | 'image' | 'pdf' | 'unsupported'

function kindFor(name: string): Kind {
  const ext = extOf(name)
  if (ext === 'pdf') return 'pdf'
  const cat = categoryFor(name)
  if (cat === 'markdown') return 'markdown'
  if (cat === 'image') return 'image'
  if (isTextLike(cat)) return 'code'
  return 'unsupported'
}

export default function PreviewModal({
  client, volume, node, onClose,
}: { client: GitHubClient; volume: Volume; node: FsNode; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const kind = kindFor(node.name)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!node.sha) return
      setLoading(true)
      setError(null)
      try {
        const { base64 } = await client.getBlobContent(volume, node.sha)
        if (cancelled) return
        if (kind === 'image' || kind === 'pdf') {
          setDataUrl(`data:${guessMime(node.name)};base64,${base64}`)
        } else if (kind === 'markdown' || kind === 'code') {
          const bytes = base64ToBytes(base64)
          setContent(new TextDecoder('utf-8', { fatal: false }).decode(bytes))
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [client, volume, node, kind])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ext = extOf(node.name)
  const highlighted = (() => {
    if (kind !== 'code' || content == null) return null
    try {
      if (hljs.getLanguage(ext)) return hljs.highlight(content, { language: ext }).value
      return hljs.highlightAuto(content).value
    } catch {
      return null
    }
  })()

  const markdownHtml = kind === 'markdown' && content != null
    ? DOMPurify.sanitize(marked.parse(content, { async: false }) as string)
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-pop-in flex max-h-[85vh] w-[min(900px,90vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-800">{node.name}</div>
            <div className="text-[11px] text-gray-400">{node.size != null ? formatBytes(node.size) : ''}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => downloadFile(client, volume, node)}
              title="Download"
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <Download size={16} />
            </button>
            <button onClick={onClose} title="Close" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-auto bg-gray-50 p-0">
          {loading && <div className="p-8 text-center text-sm text-gray-400">Loading…</div>}
          {error && <div className="p-8 text-center text-sm text-red-500">{error}</div>}

          {!loading && !error && kind === 'image' && dataUrl && (
            <div className="flex items-center justify-center bg-[repeating-conic-gradient(#eee_0%_25%,white_0%_50%)] bg-[length:16px_16px] p-6">
              <img src={dataUrl} alt={node.name} className="max-h-[70vh] max-w-full rounded shadow" />
            </div>
          )}

          {!loading && !error && kind === 'pdf' && dataUrl && (
            <iframe title={node.name} src={dataUrl} className="h-[75vh] w-full border-0" />
          )}

          {!loading && !error && kind === 'markdown' && markdownHtml && (
            <div
              className="prose prose-sm max-w-none bg-white p-6"
              // sanitized above via DOMPurify
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          )}

          {!loading && !error && kind === 'code' && content != null && (
            <pre className="m-0 overflow-auto bg-white p-4 text-[12.5px] leading-relaxed">
              <code
                className="hljs"
                dangerouslySetInnerHTML={highlighted ? { __html: highlighted } : undefined}
              >
                {highlighted ? undefined : content}
              </code>
            </pre>
          )}

          {!loading && !error && kind === 'unsupported' && (
            <div className="p-10 text-center text-sm text-gray-400">
              No preview available for this file type.
              <div className="mt-3">
                <button
                  onClick={() => downloadFile(client, volume, node)}
                  className="rounded-lg bg-mac-accent px-4 py-1.5 text-xs font-medium text-white hover:brightness-90"
                >
                  Download instead
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
