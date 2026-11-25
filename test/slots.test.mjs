/**
 * Parsing tests against the real `client.js`.
 *
 * The browser half registers itself on `window.__ModuleLoader__`, so a small vm
 * context loads the shipped file and hands back its factory: the assertions
 * below run the same functions the plugin runs, not a copy of them.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function loadInternals() {
  let factory = null
  const window = {
    __ModuleLoader__: {
      load(spec) {
        factory = spec.factory
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  }
  const context = vm.createContext({
    window,
    console,
    setTimeout,
    clearTimeout,
  })
  vm.runInContext(source, context, { filename: 'client.js' })

  assert.equal(typeof factory, 'function', 'client.js must register a factory')

  const react = {
    createElement: () => null,
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useMemo: () => undefined,
    useRef: () => ({ current: null }),
  }
  const plugin = factory(() => react)
  assert.ok(plugin.__internals, 'client.js must expose its parsing helpers')
  return plugin.__internals
}

const api = loadInternals()

test('counts every occurrence, not every name', () => {
  assert.equal(api.scanSlots('【一】【二】【三】').length, 3)
  assert.equal(api.scanSlots('【项目名】和【项目名】').length, 2)
})

test('empty brackets count and get positional keys', () => {
  const slots = api.scanSlots('请填写：【】和【】')
  assert.equal(slots.length, 2)
  assert.deepEqual(Array.from(slots, (slot) => slot.key), ['a:0', 'a:1'])
  assert.deepEqual(Array.from(slots, (slot) => slot.raw), ['【】', '【】'])
})

test('a repeated name shares one key', () => {
  const slots = api.scanSlots('【项目名】和【项目名】')
  assert.deepEqual(Array.from(slots, (slot) => slot.key), ['n:项目名', 'n:项目名'])
})

test('accepts names up to 200 characters and rejects longer ones', () => {
  assert.equal(api.scanSlots('【' + '字'.repeat(200) + '】').length, 1)
  assert.equal(api.scanSlots('【' + '字'.repeat(201) + '】').length, 0)
})

test('fills what was answered and keeps skipped brackets', () => {
  const body = '你是【角色】。请用【语气】回答。'
  const slots = api.scanSlots(body)
  assert.equal(api.assemble(body, slots, { 'n:角色': '编辑' }), '你是编辑。请用【语气】回答。')
  assert.equal(
    api.assemble(body, slots, { 'n:角色': '编辑', 'n:语气': '简洁' }),
    '你是编辑。请用简洁回答。',
  )
})

test('values saved by the first build under a bare name still resolve', () => {
  const body = '【旧名】'
  assert.equal(api.assemble(body, api.scanSlots(body), { 旧名: '兼容' }), '兼容')
})

test('an unclosed bracket is not a slot', () => {
  assert.equal(api.scanSlots('前缀【未闭合').length, 0)
})

test('a value may itself contain brackets and newlines', () => {
  const body = 'A【x】B'
  assert.equal(api.assemble(body, api.scanSlots(body), { 'n:x': '多\n行【保留】' }), 'A多\n行【保留】B')
})
