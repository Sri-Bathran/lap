// A pluggable formatter registry, not a monolithic "format everything."
//
// There is no realistic in-browser formatter for most languages (gofmt,
// rustfmt, black, clang-format, shfmt are compiled toolchains, not
// something a browser can run without a multi-MB WASM binary per
// language). Prettier is the exception — a genuinely browser-native
// formatter that covers JS/TS, CSS-family, JSON, YAML, Markdown, and HTML
// well. Each entry below lazy-loads only its own plugin bundle, so
// previewing a Python file never pulls in Prettier's code at all.
//
// Adding support for another language later (if a solid WASM formatter
// ever appears for it) means adding one more registry entry here — not
// restructuring anything.

import { extOf } from './extensions'

type PluginLoader = () => Promise<any[]>

interface FormatterEntry {
  parser: string
  loadPlugins: PluginLoader
}

const REGISTRY: Record<string, FormatterEntry> = {
  js: { parser: 'babel', loadPlugins: loadBabel },
  jsx: { parser: 'babel', loadPlugins: loadBabel },
  mjs: { parser: 'babel', loadPlugins: loadBabel },
  cjs: { parser: 'babel', loadPlugins: loadBabel },
  json: { parser: 'json', loadPlugins: loadBabel },
  ts: { parser: 'typescript', loadPlugins: loadTypescript },
  tsx: { parser: 'typescript', loadPlugins: loadTypescript },
  css: { parser: 'css', loadPlugins: loadPostcss },
  scss: { parser: 'scss', loadPlugins: loadPostcss },
  less: { parser: 'less', loadPlugins: loadPostcss },
  yml: { parser: 'yaml', loadPlugins: loadYaml },
  yaml: { parser: 'yaml', loadPlugins: loadYaml },
  md: { parser: 'markdown', loadPlugins: loadMarkdown },
  markdown: { parser: 'markdown', loadPlugins: loadMarkdown },
  html: { parser: 'html', loadPlugins: loadHtml },
}

async function loadBabel(): Promise<any[]> {
  const [babel, estree] = await Promise.all([
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ])
  return [babel.default, estree.default]
}

async function loadTypescript(): Promise<any[]> {
  const [ts, estree] = await Promise.all([
    import('prettier/plugins/typescript'),
    import('prettier/plugins/estree'),
  ])
  return [ts.default, estree.default]
}

async function loadPostcss(): Promise<any[]> {
  const postcss = await import('prettier/plugins/postcss')
  return [postcss.default]
}

async function loadYaml(): Promise<any[]> {
  const yaml = await import('prettier/plugins/yaml')
  return [yaml.default]
}

async function loadMarkdown(): Promise<any[]> {
  const md = await import('prettier/plugins/markdown')
  return [md.default]
}

async function loadHtml(): Promise<any[]> {
  const html = await import('prettier/plugins/html')
  return [html.default]
}

export function canFormat(filename: string): boolean {
  return extOf(filename) in REGISTRY
}

export async function formatCode(filename: string, content: string): Promise<string> {
  const entry = REGISTRY[extOf(filename)]
  if (!entry) throw new Error('No formatter registered for this file type.')
  const [{ format }, plugins] = await Promise.all([import('prettier/standalone'), entry.loadPlugins()])
  return format(content, { parser: entry.parser, plugins })
}
