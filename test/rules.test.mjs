import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findings, pkg } from './helpers.mjs'

const ids = list => list.map(f => f.rule)

describe('typescript7-with-vue-tsc', () => {
  const rule = 'typescript7-with-vue-tsc'
  it('flags TypeScript 7 next to vue-tsc', () => {
    const f = findings({ 'package.json': pkg({}, { 'typescript': '^7.0.2', 'vue-tsc': '^3.3.13' }) }, rule)
    assert.equal(f.length, 1)
    assert.equal(f[0].file, 'package.json')
    assert.match(f[0].message, /TypeScript 7/)
  })
  it('accepts the typescript6 alias', () => {
    assert.deepEqual(findings({ 'package.json': pkg({}, { 'typescript': 'npm:@typescript/typescript6@^6.0.2', 'vue-tsc': '^3.3.13' }) }, rule), [])
  })
  it('resolves pnpm catalogs', () => {
    const f = findings({
      'package.json': pkg({}, { 'typescript': 'catalog:dev', 'vue-tsc': 'catalog:dev' }),
      'pnpm-workspace.yaml': 'catalogs:\n  dev:\n    typescript: ^7.0.0\n    vue-tsc: ^3.3.0\n',
    }, rule)
    assert.equal(f.length, 1)
  })
  it('ignores projects without vue-tsc', () => {
    assert.deepEqual(findings({ 'package.json': pkg({}, { typescript: '^7.0.2' }) }, rule), [])
  })
})

describe('missing-required-peer', () => {
  const rule = 'missing-required-peer'
  it('flags Pinia 4 without @vue/devtools-api', () => {
    assert.equal(findings({ 'package.json': pkg({ pinia: '^4.1.0' }) }, rule).length, 1)
  })
  it('passes when the peer is declared', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ 'pinia': '^4.1.0', '@vue/devtools-api': '^8.2.1' }) }, rule), [])
  })
  it('ignores Pinia 3', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ pinia: '^3.0.4' }) }, rule), [])
  })
  it('flags Vitest 5 without vite', () => {
    assert.equal(findings({ 'package.json': pkg({}, { vitest: '^5.0.4' }) }, rule).length, 1)
  })
})

describe('end-of-life-framework', () => {
  it('flags Nuxt 3 and Vue 2', () => {
    const f = findings({ 'package.json': pkg({ nuxt: '^3.21.11', vue: '^2.7.16' }) }, 'end-of-life-framework')
    assert.equal(f.length, 2)
  })
  it('passes Nuxt 4', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ nuxt: '^4.6.1' }) }, 'end-of-life-framework'), [])
  })
})

describe('prerelease-core-dependency', () => {
  it('flags a Vue release candidate', () => {
    assert.equal(findings({ 'package.json': pkg({ vue: '3.6.0-rc.11' }) }, 'prerelease-core-dependency').length, 1)
  })
  it('passes a stable range', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ vue: '^3.5.44' }) }, 'prerelease-core-dependency'), [])
  })
})

describe('vapor-event-delegation-option', () => {
  it('flags the removed option', () => {
    const f = findings({ 'vite.config.ts': 'export default { plugins: [vue({ template: { compilerOptions: { eventDelegation: true } } })] }' }, 'vapor-event-delegation-option')
    assert.equal(f.length, 1)
  })
  it('ignores the option name inside a comment', () => {
    assert.deepEqual(findings({ 'vite.config.ts': '// eventDelegation: true was removed\nexport default {}' }, 'vapor-event-delegation-option'), [])
  })
})

describe('vitest-removed-config', () => {
  const rule = 'vitest-removed-config'
  it('flags poolOptions on Vitest 4+', () => {
    const f = findings({ 'package.json': pkg({}, { vitest: '^5.0.4' }), 'vitest.config.ts': 'export default { test: { poolOptions: { threads: {} } } }' }, rule)
    assert.equal(f.length, 1)
  })
  it('flags a workspace file', () => {
    const f = findings({ 'package.json': pkg({}, { vitest: '^5.0.4' }), 'vitest.workspace.ts': 'export default []' }, rule)
    assert.equal(f.length, 1)
  })
  it('flags optimizer.web on Vitest 5', () => {
    const f = findings({ 'package.json': pkg({}, { vitest: '^5.0.4' }), 'vitest.config.ts': 'export default { test: { deps: { optimizer: { web: { include: [] } } } } }' }, rule)
    assert.equal(f.length, 1)
  })
  it('leaves Vitest 3 alone', () => {
    assert.deepEqual(findings({ 'package.json': pkg({}, { vitest: '^3.2.0' }), 'vitest.config.ts': 'export default { test: { poolOptions: {} } }' }, rule), [])
  })
})

describe('vite8-legacy-options', () => {
  const rule = 'vite8-legacy-options'
  it('flags rollupOptions and object manualChunks', () => {
    const f = findings({
      'package.json': pkg({}, { vite: '^8.3.4' }),
      'vite.config.ts': 'export default { build: { rollupOptions: { output: { manualChunks: { vendor: [\'vue\'] } } } } }',
    }, rule)
    assert.deepEqual(f.map(x => x.severity), ['warn', 'error'])
  })
  it('leaves Vite 7 configs alone', () => {
    assert.deepEqual(findings({ 'package.json': pkg({}, { vite: '^7.1.0' }), 'vite.config.ts': 'export default { build: { rollupOptions: {} } }' }, rule), [])
  })
})

describe('vitest-artifacts-not-ignored', () => {
  it('flags a missing .vitest entry', () => {
    assert.equal(findings({ 'package.json': pkg({}, { vitest: '^5.0.4' }), '.gitignore': 'node_modules\n' }, 'vitest-artifacts-not-ignored').length, 1)
  })
  it('passes when .vitest is ignored', () => {
    assert.deepEqual(findings({ 'package.json': pkg({}, { vitest: '^5.0.4' }), '.gitignore': 'node_modules\n.vitest\n' }, 'vitest-artifacts-not-ignored'), [])
  })
})

describe('vapor rules', () => {
  it('flags a Vapor template with an Options API script', () => {
    const f = findings({ 'src/A.vue': '<script>\nexport default { data: () => ({ n: 1 }) }\n</script>\n<template vapor><p>{{ n }}</p></template>\n' }, 'vapor-without-script-setup')
    assert.equal(f.length, 1)
  })
  it('accepts the <script vapor> shorthand', () => {
    assert.deepEqual(findings({ 'src/A.vue': '<script vapor>\nconst n = 1\n</script>\n<template><p>{{ n }}</p></template>\n' }, 'vapor-without-script-setup'), [])
  })
  it('flags v-memo and getCurrentInstance in Vapor components', () => {
    const f = findings({ 'src/A.vue': '<script setup vapor>\nconst i = getCurrentInstance()\n</script>\n<template><li v-for="x in xs" :key="x" v-memo="[x]">{{ x }}</li></template>\n' }, 'vapor-unsupported-feature')
    assert.equal(f.length, 2)
  })
  it('ignores the same features in VDOM components', () => {
    assert.deepEqual(findings({ 'src/A.vue': '<script setup>\nconst i = getCurrentInstance()\n</script>\n<template><li v-memo="[x]" /></template>\n' }, 'vapor-unsupported-feature'), [])
  })
})

describe('vueuse rules', () => {
  it('flags templateRef imports as errors on VueUse 15', () => {
    const f = findings({ 'package.json': pkg({ '@vueuse/core': '^15.0.0' }), 'src/a.ts': 'import { useMouse, templateRef } from \'@vueuse/core\'\n' }, 'vueuse-templateref-removed')
    assert.equal(f[0].severity, 'error')
  })
  it('warns before the upgrade on VueUse 14', () => {
    const f = findings({ 'package.json': pkg({ '@vueuse/core': '^14.4.0' }), 'src/a.ts': 'import { templateRef } from \'@vueuse/core\'\n' }, 'vueuse-templateref-removed')
    assert.equal(f[0].severity, 'warn')
  })
  it('flags removed timer options', () => {
    const f = findings({
      'package.json': pkg({ '@vueuse/core': '^15.0.0' }),
      'src/a.ts': 'import { useNow, useWebSocket } from \'@vueuse/core\'\nconst now = useNow({ interval: 1000 })\nuseWebSocket(url, { heartbeat: { message: \'ping\', interval: 5000 } })\n',
    }, 'vueuse-removed-timer-options')
    assert.equal(f.length, 2)
  })
  it('ignores a local function with the same name', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ '@vueuse/core': '^15.0.0' }), 'src/a.ts': 'const now = useNow({ interval: 1000 })\n' }, 'vueuse-removed-timer-options'), [])
  })
})

describe('vitest source rules', () => {
  const base = { 'package.json': pkg({}, { vitest: '^5.0.4' }) }
  it('flags describe.sequential', () => {
    assert.equal(findings({ ...base, 'src/a.test.ts': 'describe.sequential(\'x\', () => {})\n' }, 'vitest-sequential-removed').length, 1)
  })
  it('flags a nested vi.mock', () => {
    assert.equal(findings({ ...base, 'src/a.test.ts': 'describe(\'x\', () => {\n  vi.mock(\'./api\')\n})\n' }, 'vitest-hoisted-not-top-level').length, 1)
  })
  it('passes a top-level vi.mock', () => {
    assert.deepEqual(findings({ ...base, 'src/a.test.ts': 'vi.mock(\'./api\')\n' }, 'vitest-hoisted-not-top-level'), [])
  })
})

describe('router-guard-next-callback', () => {
  it('flags a guard that takes next', () => {
    assert.equal(findings({ 'src/router.ts': 'router.beforeEach((to, from, next) => { next() })\n' }, 'router-guard-next-callback').length, 1)
  })
  it('passes a guard that returns', () => {
    assert.deepEqual(findings({ 'src/router.ts': 'router.beforeEach((to) => { if (!ok) return \'/login\' })\n' }, 'router-guard-next-callback'), [])
  })
})

describe('public-env-secret', () => {
  const rule = 'public-env-secret'
  it('flags a VITE_ secret in code', () => {
    assert.equal(findings({ 'src/a.ts': 'const key = import.meta.env.VITE_STRIPE_SECRET_KEY\n' }, rule).length, 1)
  })
  it('flags a public secret in .env files', () => {
    assert.equal(findings({ '.env.production': 'VITE_API_URL=https://api.example.com\nNUXT_PUBLIC_DB_PASSWORD=x\n' }, rule).length, 1)
  })
  it('flags secrets under runtimeConfig.public', () => {
    assert.equal(findings({ 'nuxt.config.ts': 'export default defineNuxtConfig({ runtimeConfig: { apiSecret: \'\', public: { stripeSecret: \'\' } } })' }, rule).length, 1)
  })
  it('passes public URLs and private config', () => {
    assert.deepEqual(findings({ 'src/a.ts': 'const url = import.meta.env.VITE_API_URL\n', 'nuxt.config.ts': 'export default { runtimeConfig: { apiSecret: \'\' } }' }, rule), [])
  })
})

describe('ssr-module-level-state', () => {
  const rule = 'ssr-module-level-state'
  it('flags module-level refs in Nuxt composables', () => {
    assert.equal(findings({ 'package.json': pkg({ nuxt: '^4.6.1' }), 'app/composables/useCart.ts': 'export const items = ref([])\nexport function useCart() { return { items } }\n' }, rule).length, 1)
  })
  it('passes refs created inside the composable', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ nuxt: '^4.6.1' }), 'app/composables/useCart.ts': 'export function useCart() {\n  const items = ref([])\n  return { items }\n}\n' }, rule), [])
  })
  it('skips SPA mode', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ nuxt: '^4.6.1' }), 'nuxt.config.ts': 'export default defineNuxtConfig({\n  ssr: false,\n})\n', 'composables/useCart.ts': 'export const items = ref([])\n' }, rule), [])
  })
  it('skips plain Vue apps', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ vue: '^3.5.44' }), 'src/composables/useCart.ts': 'export const items = ref([])\n' }, rule), [])
  })
})

describe('nuxt-fetch-in-setup', () => {
  it('flags top-level await $fetch in script setup', () => {
    const f = findings({ 'package.json': pkg({ nuxt: '^4.6.1' }), 'app/pages/index.vue': '<script setup lang="ts">\nconst posts = await $fetch(\'/api/posts\')\n</script>\n<template><div /></template>\n' }, 'nuxt-fetch-in-setup')
    assert.equal(f.length, 1)
    assert.equal(f[0].line, 2)
  })
  it('passes $fetch inside a handler', () => {
    assert.deepEqual(findings({ 'package.json': pkg({ nuxt: '^4.6.1' }), 'app/pages/index.vue': '<script setup lang="ts">\nasync function save() {\n  await $fetch(\'/api/posts\', { method: \'POST\' })\n}\n</script>\n' }, 'nuxt-fetch-in-setup'), [])
  })
})

describe('pinia-store-destructure', () => {
  it('flags destructuring a store', () => {
    assert.equal(findings({ 'src/A.vue': '<script setup>\nconst { count } = useCounterStore()\n</script>\n' }, 'pinia-store-destructure').length, 1)
  })
  it('passes storeToRefs', () => {
    assert.deepEqual(findings({ 'src/A.vue': '<script setup>\nconst { count } = storeToRefs(useCounterStore())\n</script>\n' }, 'pinia-store-destructure'), [])
  })
})

describe('engine', () => {
  it('honors disable comments', () => {
    const f = findings({ 'src/a.ts': '// vue-skills-ci-disable-next-line router-guard-next-callback\nrouter.beforeEach((to, from, next) => next())\n' })
    assert.deepEqual(ids(f), [])
  })
  it('skips node_modules, dist and public', () => {
    const bad = 'router.beforeEach((to, from, next) => next())\n'
    assert.deepEqual(findings({ 'node_modules/x/a.js': bad, 'dist/a.js': bad, 'public/a.js': bad }), [])
  })
})

describe('selectRules', async () => {
  const { GROUPS, rulesInGroup, selectRules } = await import('../src/rules/index.mjs')
  it('puts every rule in exactly one known group', () => {
    const grouped = Object.keys(GROUPS).flatMap(rulesInGroup)
    assert.equal(grouped.length, new Set(grouped).size)
    assert.equal(grouped.length, selectRules().size)
  })
  it('handles all, none, groups, ids and exclusions', () => {
    assert.equal(selectRules({ include: 'all' }).size, 19)
    assert.equal(selectRules({ include: 'none' }).size, 0)
    assert.deepEqual([...selectRules({ include: 'nuxt' })].sort(), ['nuxt-fetch-in-setup', 'ssr-module-level-state'])
    assert.equal(selectRules({ exclude: 'testing,vapor' }).size, 12)
  })
})
