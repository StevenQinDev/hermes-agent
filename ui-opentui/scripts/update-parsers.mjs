/**
 * Vendor the extra Tree-sitter grammars listed in parsers/manifest.json into
 * parsers/<filetype>/ (wasm + highlights.scm). Plain Node fetch — no Bun
 * (core's update-assets.js is bun-shebanged; its download logic is just
 * fetch+fs, so we do the same two writes ourselves and keep the generated
 * import-module out of the esbuild bundle entirely — registration reads the
 * vendored files by PATH at runtime, see src/boundary/parsers.ts).
 *
 * Idempotent: existing valid files are kept unless --force. Validates wasm
 * magic and a non-empty query so a bad download can never be committed.
 *
 *   node scripts/update-parsers.mjs [--force]
 *
 * The vendored files are COMMITTED (build inputs, like @opentui/core's own
 * assets/) — builds and offline machines never re-download.
 */
import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const parsersDir = join(root, 'parsers')
const force = process.argv.includes('--force')

const manifest = JSON.parse(await readFile(join(parsersDir, 'manifest.json'), 'utf8'))

const wasmUrl = p =>
  `https://github.com/${p.org}/tree-sitter-${p.filetype}/releases/download/${p.tag}/tree-sitter-${p.filetype}.wasm`
const scmUrl = p =>
  `https://raw.githubusercontent.com/${p.org}/tree-sitter-${p.filetype}/${p.tag}/queries/highlights.scm`

async function fetchBytes(url) {
  const response = await globalThis.fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function haveValid(path, validate) {
  try {
    return validate(await readFile(path))
  } catch {
    return false
  }
}

const isWasm = bytes => bytes.length > 8 && bytes.subarray(0, 4).toString('latin1') === '\0asm'
const isQuery = bytes => bytes.length > 0 && bytes.toString('utf8').trim().length > 0

let downloaded = 0
for (const parser of manifest.parsers) {
  const dir = join(parsersDir, parser.filetype)
  await mkdir(dir, { recursive: true })
  const targets = [
    { name: `tree-sitter-${parser.filetype}.wasm`, url: wasmUrl(parser), validate: isWasm },
    { name: 'highlights.scm', url: scmUrl(parser), validate: isQuery }
  ]
  for (const target of targets) {
    const path = join(dir, target.name)
    if (!force && (await haveValid(path, target.validate))) {
      console.log(`✓ kept    ${parser.filetype}/${target.name}`)
      continue
    }
    const bytes = await fetchBytes(target.url)
    if (!target.validate(bytes)) throw new Error(`validation failed for ${target.url}`)
    await writeFile(path, bytes)
    downloaded += 1
    console.log(`↓ fetched ${parser.filetype}/${target.name} (${(bytes.length / 1024).toFixed(0)} KB)`)
  }
}
console.log(`done — ${downloaded} file(s) fetched, ${manifest.parsers.length} grammars vendored`)
