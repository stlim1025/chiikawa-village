import { expect, mock, test } from 'claude-code/testing'

// The job board as the hooks module runs it: agents tracked as jobs, the label under
// the prompt, the notes it unfolds above the prompt (no side pane, so the conversation
// is never pushed aside), the backdrop redrawn on a start or an end.

const SESSION = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const SPAWN = {
  tool_use_id: 'u1',
  prompt: 'look',
  description: '찾기',
  subagentType: 'Explore',
  provider: { plugin: 'engine' },
  parentModel: 'm',
  background: false,
  fork: false,
} as const
const MODE = { plugin: 'chiikawa-village', component: 'SessionMode', props: { modes: [] } } as const
const BAND = {
  plugin: 'chiikawa-village',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const
const BACKDROP = {
  plugin: 'chiikawa-village',
  component: 'Backdrop',
  props: { id: 'village', scene: 'village', plugin: 'chiikawa-village', glass: { blur: 16, opacity: 0.7, tint: '#1b2233' } },
} as const

// A five-hour window that starts over two hours after the tests' clock starts.
const FIVE = (percentUsed: number) => ({ kind: 'five_hour', percentUsed, resetsAt: new Date(1_000_000 + 2 * 3_600_000).toISOString() })

// Stands for the engine: what the village reads and asks for, recorded. `limits` is what
// this session's own last response said of the rate-limit windows; `stored` is the
// plugin's store, the one file every session of the person's reads and writes.
const engine = (
  on,
  list: () => { id: string; status: string; type: string; description: string }[] = () => [],
  { limits = () => [], stored = {} }: { limits?: () => unknown[]; stored?: Record<string, unknown> } = {},
) => {
  const opened = []
  const closed = []
  const toasts = []
  let n = 0
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: limits(), context: { window: 1000, percent: 10 } } }))
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('command.register', () => ({ value: undefined }))
  on('theme.set', () => ({ value: { isDrawn: true } }))
  on('theme.clear', () => ({ value: undefined }))
  on('agent.spawn', () => ({ model: 'm', agentId: `a${++n}` }))
  on('agent.list', () => ({ value: list() }))
  on('ui.open', (_, e) => {
    opened.push(e)

    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    closed.push(e)

    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e)

    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: 'engine' })
  })

  return { opened, closed, toasts, stored }
}

const label = async ui => (await ui.find({ type: 'Button', key: 'open-village-jobs' }))?.text

test('a new agent opens no pane', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const seen = engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

  await $.session.start(SESSION)
  await $.agent.spawn(SPAWN)
  await clock.advance(1000)

  expect(seen.opened).toHaveLength(0)
})

test('no jobs, no label', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  engine(on)

  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...MODE, surface: 'desktop' })

  expect(await label(ui)).toBeUndefined()
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the label comes first, counts jobs and unfolds the notes above the prompt (${surface})`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    const seen = engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

    await $.session.start({ ...SESSION, surface })
    await $.agent.spawn(SPAWN)
    const ui = await $.ui.mount({ ...MODE, surface })
    const band = await $.ui.mount({ ...BAND, surface })

    // First in the footer row: what comes after the first button is cut short there.
    expect((await ui.findAll({ type: 'Button' }))[0]?.key).toBe('open-village-jobs')
    expect(await label(ui)).toBe('📌 1')
    expect(await band.find({ type: 'Text', text: '치이카와가 맡았어요' })).toBeUndefined()

    await ui.press({ key: 'open-village-jobs' })
    expect(await label(ui)).toBe('📌 1 ▾')
    expect(await band.find({ type: 'Text', text: '치이카와가 맡았어요' })).toBeDefined()
    // No side pane: nothing is docked beside the conversation.
    expect(seen.opened).toHaveLength(0)

    await ui.press({ key: 'open-village-jobs' })
    expect(await band.find({ type: 'Text', text: '치이카와가 맡았어요' })).toBeUndefined()
    await band.unmount()
    await ui.unmount()
  })

  test(`the label's words are drawn in a colour of their own, as the day button's are (${surface})`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

    await $.session.start({ ...SESSION, surface })
    await $.agent.spawn(SPAWN)
    const ui = await $.ui.mount({ ...MODE, surface })
    const words = await ui.find({ type: 'Text', text: '📌 1' })

    expect(words).toBeDefined()
    expect(words?.props.color).toBeDefined()
    await ui.unmount()
  })

  test(`the unfolded notes show each job, and give way to a survey (${surface})`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

    await $.session.start({ ...SESSION, surface })
    await $.agent.spawn(SPAWN)
    const mode = await $.ui.mount({ ...MODE, surface })
    await mode.press({ key: 'open-village-jobs' })
    const survey = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
    expect(await survey.find({ type: 'Text', text: '치이카와가 맡았어요' })).toBeUndefined()
    await survey.unmount()
    const ui = await $.ui.mount({ ...BAND, surface })

    expect(await ui.find({ type: 'Text', text: '치이카와가 맡았어요' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '찾기' })).toBeDefined()
    if (surface === 'desktop') {
      expect(await ui.find({ type: 'Svg' })).toBeDefined()
    } else {
      expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    }
    await ui.unmount()
  })

  test(`the unfolded notes hang on the board, in the village board's wood and panel (${surface})`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

    await $.session.start({ ...SESSION, surface })
    await $.agent.spawn(SPAWN)
    const mode = await $.ui.mount({ ...MODE, surface })
    await mode.press({ key: 'open-village-jobs' })
    const ui = await $.ui.mount({ ...BAND, surface })

    // The band is the board itself, not the app's own surface: the frame's wood and the
    // pale panel inside it, the colours the board in the village is drawn in.
    const board = await ui.find({ type: 'Box', key: 'village-job-board' })
    const panel = await ui.find({ type: 'Box', key: 'village-job-panel' })
    expect(board?.props.backgroundColor).toBe('#c9a07e')
    expect(panel?.props.backgroundColor).toBe('#f6e6c8')
    expect(await ui.find({ type: 'Text', text: '치이카와가 맡았어요' })).toBeDefined()
    await ui.unmount()
    await mode.unmount()
  })
}

test('the backdrop key moves on start and end, not on tools', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  // No agent in the engine's list until one is spawned.
  let status = ''
  engine(on, () => (status ? [{ id: 'a1', status, type: 'Explore', description: '찾기' }] : []))
  on('tool.call', () => ({ result: { text: 'ok' } }))

  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = async () => String((await ui.find({ type: 'Svg' }))?.props.source)
  const before = await source()

  status = 'running'
  await $.agent.spawn(SPAWN)
  await clock.advance(1000)
  const started = await source()
  expect(started).not.toBe(before)
  expect(started).toContain('cv-f-chiikawa-')

  await $.tool.call({ tool: 'Read', file_path: '/x.md', agentId: 'a1' })
  await clock.advance(1000)
  expect(await source()).toBe(started)

  status = 'completed'
  await clock.advance(1000)
  expect(await source()).not.toBe(started)
  await ui.unmount()
})

test('an ended job toasts as agent-watch did', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  let status = 'running'
  const seen = engine(on, () => [{ id: 'a1', status, type: 'Explore', description: '찾기' }])

  await $.session.start(SESSION)
  await $.agent.spawn(SPAWN)
  await clock.advance(1000)
  status = 'completed'
  await clock.advance(1000)

  expect(seen.toasts).toHaveLength(1)
  expect(seen.toasts[0].text).toStartWith("✓ 완료 · Explore '찾기' · ")
})

test('cast off keeps face defs', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

  await $.session.start(SESSION)
  await $.agent.spawn(SPAWN)
  await $.command.run({ command: 'village', args: 'cast off' })
  await clock.advance(1000)
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  const used = [...source.matchAll(/href="#(cv-f-[^"]+)"/g)].map(m => m[1])

  expect(used.length).toBeGreaterThan(0)
  for (const id of used) expect(source).toContain(`id="${id}"`)
  await ui.unmount()

  await $.command.run({ command: 'village', args: 'off' })
  const mode = await $.ui.mount({ ...MODE, surface: 'desktop' })
  expect(await label(mode)).toBe('📌 1')
  await mode.unmount()
})

// The rate-limit windows are the account's, but each session knows only what its own
// last response said: the sessions leave their readings in the store for each other.
test('a newer reading another session left shows here, with no chat here', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  engine(on, () => [], { limits: () => [FIVE(40)], stored: { limits: [FIVE(61)] } })

  await $.session.start(SESSION)
  const { text } = await $.command.run({ command: 'village', args: '자동' })

  expect(text).toContain('five_hour 61%')
})

test('a reading measured here is left for the other sessions', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const seen = engine(on)

  await $.session.start(SESSION)
  await $.session.measure({ context: { window: 1000, percent: 10 }, rateLimits: [FIVE(55)], changed: ['rateLimits'] })

  expect(seen.stored.limits).toEqual([FIVE(55)])
})

test('a newer reading from elsewhere redraws the sign within a minute and a half, with no turn here', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const seen = engine(on, () => [], { limits: () => [FIVE(40)] })

  await $.session.start(SESSION)
  // With the cast off a picture stands until what it shows changes; 40 to 42 stays in
  // one 5% step, so only the new figure can make the new picture.
  await $.command.run({ command: 'village', args: 'cast off' })
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = async () => String((await ui.find({ type: 'Svg' }))?.props.source)
  const before = await source()

  await clock.advance(90_000)
  expect(await source()).toBe(before)

  seen.stored.limits = [FIVE(42)]
  await clock.advance(90_000)
  expect(await source()).not.toBe(before)
  await ui.unmount()
})
