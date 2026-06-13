/**
 * Vendored tree-sitter grammar registration (syntax-highlighting language
 * expansion). Layers:
 *   1. config: every manifest grammar has valid vendored assets (wasm magic,
 *      non-empty query) and the built configs point at existing absolute paths.
 *   2. resolution: core's filetype maps route our curated extensions/fence
 *      labels to the registered filetype ids.
 * Visual color is live-smoke territory (highlighting settles async — see
 * codeBlock.tsx); these tests pin the wiring that makes it possible.
 */
import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

import { extToFiletype, infoStringToFiletype, pathToFiletype } from '@opentui/core'
import { describe, expect, test } from 'vitest'

import { registerVendoredParsers, vendoredParsers } from '../boundary/parsers.ts'

const EXPECTED = ['python', 'rust', 'go', 'bash', 'json', 'c', 'html', 'css', 'yaml', 'toml']

describe('vendored grammar configs', () => {
  test('all 10 curated grammars resolve with existing absolute asset paths', () => {
    const configs = vendoredParsers()
    expect(configs.map(c => c.filetype).sort()).toEqual([...EXPECTED].sort())
    for (const config of configs) {
      expect(isAbsolute(config.wasm)).toBe(true)
      expect(isAbsolute(config.queries.highlights[0]!)).toBe(true)
    }
  })

  test('vendored wasm files carry the wasm magic; queries are non-empty', () => {
    for (const config of vendoredParsers()) {
      const wasm = readFileSync(config.wasm)
      expect(wasm.subarray(0, 4).toString('latin1'), config.filetype).toBe('\0asm')
      const query = readFileSync(config.queries.highlights[0]!, 'utf8')
      expect(query.trim().length, config.filetype).toBeGreaterThan(0)
    }
  })

  test('registerVendoredParsers registers and reports the full set', () => {
    const registered = registerVendoredParsers()
    expect(registered.map(r => r.filetype).sort()).toEqual([...EXPECTED].sort())
  })

  test('a missing assets dir degrades to empty (plain-text fallback), no throw', () => {
    expect(vendoredParsers('/nonexistent/parsers')).toEqual([])
  })
})

describe('filetype routing into the registered ids', () => {
  test('tool-body path extensions resolve to curated filetypes', () => {
    expect(pathToFiletype('a/b/script.py')).toBe('python')
    expect(pathToFiletype('src/main.rs')).toBe('rust')
    expect(pathToFiletype('cmd/main.go')).toBe('go')
    expect(pathToFiletype('run.sh')).toBe('bash')
    expect(pathToFiletype('conf.yaml')).toBe('yaml')
    expect(pathToFiletype('conf.yml')).toBe('yaml')
    expect(pathToFiletype('Cargo.toml')).toBe('toml')
    expect(pathToFiletype('lib.c')).toBe('c')
    expect(pathToFiletype('lib.h')).toBe('c')
    expect(pathToFiletype('index.html')).toBe('html')
    expect(pathToFiletype('style.css')).toBe('css')
    expect(pathToFiletype('package.json')).toBe('json')
  })

  test('markdown fence labels resolve to curated filetypes (3b — injections)', () => {
    expect(infoStringToFiletype('python')).toBe('python')
    expect(infoStringToFiletype('py')).toBe('python')
    expect(infoStringToFiletype('rust')).toBe('rust')
    expect(infoStringToFiletype('sh')).toBe('bash')
    expect(infoStringToFiletype('yaml title=x.yml')).toBe('yaml')
    expect(extToFiletype('zsh')).toBe('bash')
  })
})
