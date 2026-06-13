/**
 * Extra Tree-sitter grammar registration — the syntax-highlighting language
 * expansion (docs/plans/opentui-syntax-highlighting-languages.md).
 *
 * @opentui/core@0.4.0 bundles only 5 grammars (ts/js/markdown/markdown_inline/
 * zig); everything else rendered plain text. The cure is the public
 * `addDefaultParsers()` API + the grammars vendored under `parsers/<filetype>/`
 * (committed; refresh via `node scripts/update-parsers.mjs`).
 *
 * Why paths, not the generated import-module: core's `updateAssets` generates
 * a Bun-flavored module (`import(... { with: { type: "file" } })`) that esbuild
 * can't bundle; its own Node fallback resolves plain file paths anyway, and
 * `FiletypeParserOptions.wasm`/`queries.highlights` accept local paths
 * directly. So registration just points at the vendored files — resolved at
 * RUNTIME by walking up from this module to the package root, which works from
 * both the esbuild bundle (dist/main.js → ../parsers) and vitest's src tree
 * (src/boundary → ../../parsers).
 *
 * Must run BEFORE the first `<code>`/`<markdown>` mount (they grab the global
 * tree-sitter client lazily) — the entry imports + calls this at module load,
 * ahead of renderer acquisition. Total: a missing assets dir degrades to
 * core's bundled set (plain text for the extras), never a throw.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { addDefaultParsers } from '@opentui/core'

import manifest from '../../parsers/manifest.json'
import { getLog } from './log.ts'

interface ManifestParser {
  readonly filetype: string
  readonly aliases: readonly string[]
}

/** The registered parser configs (exported shape for tests/diagnostics). */
export interface RegisteredParser {
  filetype: string
  aliases?: string[]
  wasm: string
  queries: { highlights: string[] }
}

/** Walk up from this module (bundle: dist/…; tests: src/boundary/…) to the
 *  package root's vendored `parsers/` dir. */
function findParsersDir(): string | undefined {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let hop = 0; hop < 5; hop += 1) {
    const candidate = join(dir, 'parsers')
    if (existsSync(join(candidate, 'manifest.json'))) return candidate
    dir = dirname(dir)
  }
  return undefined
}

/** Build the parser configs for every vendored grammar whose files exist. */
export function vendoredParsers(parsersDir: string | undefined = findParsersDir()): RegisteredParser[] {
  if (!parsersDir) return []
  const configs: RegisteredParser[] = []
  for (const parser of (manifest as { parsers: ManifestParser[] }).parsers) {
    const wasm = join(parsersDir, parser.filetype, `tree-sitter-${parser.filetype}.wasm`)
    const highlights = join(parsersDir, parser.filetype, 'highlights.scm')
    if (!existsSync(wasm) || !existsSync(highlights)) continue
    configs.push({
      filetype: parser.filetype,
      ...(parser.aliases.length ? { aliases: [...parser.aliases] } : {}),
      wasm,
      queries: { highlights: [highlights] }
    })
  }
  return configs
}

/** Register the vendored grammars with core's global default-parser list.
 *  Returns what was registered (empty on any failure — plain-text fallback). */
export function registerVendoredParsers(): RegisteredParser[] {
  try {
    const parsers = vendoredParsers()
    if (!parsers.length) {
      getLog().warn('parsers', 'no vendored tree-sitter grammars found — extras render plain', {})
      return []
    }
    addDefaultParsers(parsers)
    return parsers
  } catch (cause) {
    getLog().warn('parsers', 'tree-sitter registration failed — extras render plain', {
      cause: String(cause)
    })
    return []
  }
}
