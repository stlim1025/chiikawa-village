import { expect, mock, test } from 'claude-code/testing'

// The job board as the hooks module runs it: agents tracked as jobs, the label under
// the prompt, the pane opened only by it, the backdrop redrawn on a start or an end.

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
const PANE = {
  plugin: 'chiikawa-village',
  component: 'Pane',
  requestId: 'village-jobs',
  props: { title: '일거리', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const
const BACKDROP = {
  plugin: 'chiikawa-village',
  component: 'Backdrop',
  props: { id: 'village', scene: 'village', plugin: 'chiikawa-village', glass: { blur: 16, opacity: 0.7, tint: '#1b2233' } },
} as const

// Stands for the engine: what the village reads and asks for, recorded.
const engine = (on, list: () => { id: string; status: string; type: string; description: string }[] = () => []) => {
  const opened = []
  const closed = []
  const toasts = []
  let n = 0
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 1000, percent: 10 } } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
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

  return { opened, closed, toasts }
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
  test(`the label counts jobs and opens the pane (${surface})`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    const seen = engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

    await $.session.start({ ...SESSION, surface })
    await $.agent.spawn(SPAWN)
    const ui = await $.ui.mount({ ...MODE, surface })

    expect(await label(ui)).toBe('일거리 1 ▸ 펼치기')
    await ui.press({ key: 'open-village-jobs' })
    expect(seen.opened).toHaveLength(1)
    expect(seen.opened[0]).toMatchObject({ id: 'village-jobs', title: '일거리' })
    expect(await label(ui)).toBe('일거리 1 ▸ 접기')
    await ui.press({ key: 'open-village-jobs' })
    expect(seen.closed[0]).toMatchObject({ id: 'village-jobs' })
    await ui.unmount()
  })

  test(`the pane draws a note per job (${surface})`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    engine(on, () => [{ id: 'a1', status: 'running', type: 'Explore', description: '찾기' }])

    await $.session.start({ ...SESSION, surface })
    await $.agent.spawn(SPAWN)
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: '치이카와가 맡았어요' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '찾기' })).toBeDefined()
    if (surface === 'desktop') {
      expect(await ui.find({ type: 'Svg' })).toBeDefined()
    } else {
      expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    }
    await ui.unmount()
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
  expect(await label(mode)).toBe('일거리 1 ▸ 펼치기')
  await mode.unmount()
})
