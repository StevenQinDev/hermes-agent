/**
 * Terminal chrome: OSC 0/2 window title + OSC 9/99/777 waiting-on-you
 * notifications. Layers:
 *   1. pure: title shaping, OSC sanitization, the three notification
 *      dialect sequences, the prompt-kind copy, the env kill-switch
 *      (logic/termChrome.ts).
 *   2. wiring: <TerminalChrome> with an injected fake seam over a real
 *      store — the title tracks session.info, prompts and turn-completion
 *      edges notify exactly once, initial state stays silent.
 */
import { createRoot } from 'solid-js'
import { describe, expect, test } from 'vitest'

import type { TerminalChromeSeam } from '../boundary/termChrome.ts'
import { createSessionStore } from '../logic/store.ts'
import {
  notifyEnabled,
  notifySequences,
  promptNotification,
  sanitizeOscText,
  TURN_COMPLETE_NOTIFICATION,
  windowTitleFor
} from '../logic/termChrome.ts'
import { TerminalChrome } from '../view/terminalChrome.tsx'

const ESC = '\u001b'
const BEL = '\u0007'

describe('windowTitleFor — title shaping', () => {
  test('generic until the session is titled', () => {
    expect(windowTitleFor(undefined)).toBe('Hermes Agent')
    expect(windowTitleFor('')).toBe('Hermes Agent')
    expect(windowTitleFor('   ')).toBe('Hermes Agent')
  })

  test('session title gets the — Hermes suffix', () => {
    expect(windowTitleFor('fix the flaky tests')).toBe('fix the flaky tests — Hermes')
  })

  test('long titles are capped', () => {
    const long = 'x'.repeat(200)
    expect(windowTitleFor(long).length).toBeLessThanOrEqual(80 + ' — Hermes'.length)
    expect(windowTitleFor(long)).toContain('…')
  })
})

describe('sanitizeOscText — escape-splice safety', () => {
  test('control chars (incl. ESC/BEL) can never splice a sequence', () => {
    expect(sanitizeOscText(`evil${ESC}]0;pwned${BEL}title`)).toBe('evil ]0;pwned title')
  })

  test('whitespace collapses; ends trimmed', () => {
    expect(sanitizeOscText('  a\n\tb  ')).toBe('a b')
  })
})

describe('notifySequences — the three dialects', () => {
  test('emits OSC 9, kitty OSC 99, and OSC 777', () => {
    const [osc9, osc99, osc777] = notifySequences({ title: 'Hermes', body: 'finished' })
    expect(osc9).toBe(`${ESC}]9;Hermes: finished${BEL}`)
    expect(osc99).toBe(`${ESC}]99;i=hermes;Hermes: finished${ESC}\\`)
    expect(osc777).toBe(`${ESC}]777;notify;Hermes;finished${BEL}`)
  })

  test('semicolons cannot splice OSC 777 fields', () => {
    const [, , osc777] = notifySequences({ title: 'a;b', body: 'c;d' })
    expect(osc777).toBe(`${ESC}]777;notify;a,b;c,d${BEL}`)
  })

  test('an empty title produces nothing', () => {
    expect(notifySequences({ title: '   ' })).toEqual([])
  })
})

describe('promptNotification + env gate', () => {
  test('every known prompt kind has copy; unknown kinds fall back', () => {
    for (const kind of ['clarify', 'approval', 'sudo', 'secret', 'confirm', 'someday-new']) {
      const n = promptNotification(kind)
      expect(n.title).toBe('Hermes')
      expect(n.body).toBeTruthy()
    }
    expect(promptNotification('someday-new').body).toBe('is waiting for your input')
  })

  test('HERMES_TUI_NOTIFY=0/false/off disables; default on', () => {
    expect(notifyEnabled({})).toBe(true)
    expect(notifyEnabled({ HERMES_TUI_NOTIFY: '1' })).toBe(true)
    expect(notifyEnabled({ HERMES_TUI_NOTIFY: '0' })).toBe(false)
    expect(notifyEnabled({ HERMES_TUI_NOTIFY: 'false' })).toBe(false)
    expect(notifyEnabled({ HERMES_TUI_NOTIFY: 'off' })).toBe(false)
  })
})

describe('<TerminalChrome> wiring — store edges drive the seam', () => {
  function mount() {
    const store = createSessionStore()
    const titles: Array<string | undefined> = []
    const notifications: string[] = []
    const seam: TerminalChromeSeam = {
      setTitle: t => titles.push(t),
      notify: n => notifications.push(n.body ?? n.title)
    }
    const dispose = createRoot(d => {
      TerminalChrome({ chrome: seam, store })
      return d
    })
    return { dispose, notifications, store, titles }
  }

  test('sets the generic title immediately, then tracks session.info title', () => {
    const { dispose, store, titles } = mount()
    try {
      expect(titles).toEqual([undefined]) // boot → windowTitleFor(undefined) inside the seam
      store.apply({ type: 'session.info', payload: { title: 'rename the moon' } })
      expect(titles).toEqual([undefined, 'rename the moon'])
    } finally {
      dispose()
    }
  })

  test('a blocking prompt notifies once; initial state is silent', () => {
    const { dispose, notifications, store } = mount()
    try {
      expect(notifications).toEqual([])
      store.apply({
        type: 'clarify.request',
        payload: { choices: null, question: 'which one?', request_id: 'r1' }
      })
      expect(notifications).toEqual(['needs an answer to continue'])
      // clearing the prompt does not notify again
      store.clearPrompt()
      expect(notifications).toEqual(['needs an answer to continue'])
    } finally {
      dispose()
    }
  })

  test('turn completion (running true→false) notifies; boot idle does not', () => {
    const { dispose, notifications, store } = mount()
    try {
      store.apply({ type: 'message.start' })
      expect(notifications).toEqual([])
      store.apply({ type: 'message.complete', payload: { text: 'done' } })
      expect(notifications).toEqual([TURN_COMPLETE_NOTIFICATION.body])
    } finally {
      dispose()
    }
  })
})
