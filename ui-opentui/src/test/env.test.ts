import { describe, expect, test } from 'vitest'

import { envFlag, envOutputLines, envOutputUnlimited, launchCwd } from '../logic/env.ts'

describe('envFlag', () => {
  test('recognizes truthy values regardless of case/whitespace', () => {
    for (const v of ['1', 'true', 'yes', 'on', 'TRUE', 'Yes', ' on ']) {
      expect(envFlag(v, false)).toBe(true)
    }
  })

  test('recognizes falsy values regardless of case/whitespace', () => {
    for (const v of ['0', 'false', 'no', 'off', 'FALSE', 'No', ' off ']) {
      expect(envFlag(v, true)).toBe(false)
    }
  })

  test('returns fallback when unset', () => {
    expect(envFlag(undefined, true)).toBe(true)
    expect(envFlag(undefined, false)).toBe(false)
    expect(envFlag('', true)).toBe(true)
    expect(envFlag('   ', false)).toBe(false)
  })

  test('returns fallback for unrecognized garbage', () => {
    expect(envFlag('maybe', true)).toBe(true)
    expect(envFlag('maybe', false)).toBe(false)
    expect(envFlag('2', true)).toBe(true)
    expect(envFlag('enabled', false)).toBe(false)
  })
})

describe('envOutputLines (HERMES_TUI_TOOL_OUTPUT_LINES)', () => {
  test('unset → Infinity (UNLIMITED by default — the env var RESTORES a cap)', () => {
    expect(envOutputLines(undefined)).toBe(Number.POSITIVE_INFINITY)
    expect(envOutputLines('')).toBe(Number.POSITIVE_INFINITY)
    expect(envOutputLines('   ')).toBe(Number.POSITIVE_INFINITY)
  })

  test('a positive integer → that cap (whitespace-tolerant)', () => {
    expect(envOutputLines('50')).toBe(50)
    expect(envOutputLines(' 50 ')).toBe(50)
    expect(envOutputLines('1')).toBe(1)
    expect(envOutputLines('200')).toBe(200)
    expect(envOutputLines('1000')).toBe(1000)
  })

  test('"0" → Infinity too (back-compat with the old opt-in "unlimited" value)', () => {
    expect(envOutputLines('0')).toBe(Number.POSITIVE_INFINITY)
  })

  test('garbage → Infinity (unrecognized ≙ no cap asked for)', () => {
    expect(envOutputLines('unlimited')).toBe(Number.POSITIVE_INFINITY)
    expect(envOutputLines('-5')).toBe(Number.POSITIVE_INFINITY)
    expect(envOutputLines('1.5')).toBe(Number.POSITIVE_INFINITY)
    expect(envOutputLines('50 lines')).toBe(Number.POSITIVE_INFINITY)
  })

  test('envOutputUnlimited: true unless an explicit finite cap was asked for', () => {
    expect(envOutputUnlimited(undefined)).toBe(true)
    expect(envOutputUnlimited('')).toBe(true)
    expect(envOutputUnlimited('   ')).toBe(true)
    expect(envOutputUnlimited('0')).toBe(true)
    expect(envOutputUnlimited('garbage')).toBe(true)
    expect(envOutputUnlimited('50')).toBe(false)
    expect(envOutputUnlimited('200')).toBe(false)
  })
})

describe('launchCwd (session.create cwd)', () => {
  test('prefers HERMES_CWD (real launch dir the hermes launcher exports)', () => {
    expect(launchCwd({ HERMES_CWD: '/home/u/proj', TERMINAL_CWD: '/other' })).toBe('/home/u/proj')
  })

  test('falls back to TERMINAL_CWD when HERMES_CWD is unset/blank', () => {
    expect(launchCwd({ TERMINAL_CWD: '/home/u/wt' })).toBe('/home/u/wt')
    expect(launchCwd({ HERMES_CWD: '  ', TERMINAL_CWD: '/home/u/wt' })).toBe('/home/u/wt')
  })

  test('falls back to process.cwd() (non-empty) when no launcher env set', () => {
    expect(launchCwd({})).toBe(process.cwd())
  })
})
