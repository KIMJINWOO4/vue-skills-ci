import { findCalls } from '../code.mjs'
import { TEST_FILE } from '../project.mjs'
import { guide } from './shared.mjs'

const VUEUSE_TIMER_OPTIONS = {
  useNow: ['interval', 'immediate'],
  useTimestamp: ['interval', 'immediate'],
  useCountdown: ['interval', 'immediate'],
  useElementByPoint: ['interval', 'immediate'],
  useMemory: ['interval', 'immediate', 'immediateCallback'],
  useTimeAgo: ['updateInterval'],
  useTimeAgoIntl: ['updateInterval'],
  useVibrate: ['interval'],
}

const SECRET_NAME = '[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|PASSWD)[A-Z0-9_]*'
const NUXT_STATE_DIR = /(^|\/)(composables|utils)\/[^/]+\.[cm]?[jt]s$/

function usesVueUse(project, file, raw) {
  return raw.includes('@vueuse/core') || project.hasDep(project.packageFor(file), '@vueuse/nuxt')
}

export default [
  {
    id: 'vueuse-templateref-removed',
    severity: 'error',
    category: 'vue',
    title: 'templateRef imported from VueUse',
    why: 'VueUse 15 removed templateRef. Vue 3.5 provides the same thing as useTemplateRef.',
    fix: 'Replace templateRef(\'name\') with useTemplateRef(\'name\') imported from vue.',
    docs: guide('vue-upgrade/references/vueuse-15.md'),
    check({ project, sourceFiles, script, report }) {
      for (const file of sourceFiles) {
        const code = script(file)
        for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@vueuse\/core['"]/g)) {
          const at = m[1].search(/\btemplateRef\b/)
          if (at === -1)
            continue
          const major = project.major(project.packageFor(file), '@vueuse/core')
          report({
            file,
            index: m.index + m[0].indexOf('{') + 1 + at,
            severity: major != null && major < 15 ? 'warn' : undefined,
            message: major != null && major < 15
              ? 'templateRef is removed in VueUse 15. Switch to useTemplateRef before upgrading.'
              : 'templateRef no longer exists in VueUse 15.',
          })
        }
      }
    },
  },
  {
    id: 'vueuse-removed-timer-options',
    severity: 'error',
    category: 'vue',
    title: 'VueUse timer option removed in v15',
    why: 'VueUse 15 removed interval, immediate, updateInterval and immediateCallback from its timer-based functions in favor of a scheduler option. The old keys are ignored.',
    fix: 'Move the timing into the scheduler option described on the function\'s page.',
    docs: guide('vue-upgrade/references/vueuse-15.md'),
    check({ project, sourceFiles, script, report }) {
      for (const file of sourceFiles) {
        const raw = project.read(file)
        if (!usesVueUse(project, file, raw) || (project.major(project.packageFor(file), '@vueuse/core') ?? 15) < 15)
          continue
        const code = script(file)
        for (const call of findCalls(code, [...Object.keys(VUEUSE_TIMER_OPTIONS), 'useWebSocket'])) {
          if (call.name === 'useWebSocket') {
            const m = call.args.match(/\bheartbeat\s*:\s*\{[^}]*?\binterval\s*:/)
            if (m)
              report({ file, index: call.argsIndex + m.index + m[0].lastIndexOf('interval'), message: 'useWebSocket heartbeat.interval was removed in VueUse 15.' })
            continue
          }
          const keys = VUEUSE_TIMER_OPTIONS[call.name]
          for (const m of call.args.matchAll(new RegExp(`\\b(${keys.join('|')})\\s*:`, 'g')))
            report({ file, index: call.argsIndex + m.index, message: `${call.name} no longer accepts "${m[1]}" in VueUse 15.` })
        }
      }
    },
  },
  {
    id: 'vitest-sequential-removed',
    severity: 'error',
    category: 'testing',
    title: '.sequential test modifier',
    why: 'Vitest 5 removed test.sequential and describe.sequential.',
    fix: 'Pass { concurrent: false } as the test or suite options instead.',
    docs: guide('vue-upgrade/references/vitest-5.md'),
    check({ project, sourceFiles, script, report }) {
      for (const file of sourceFiles.filter(f => TEST_FILE.test(f))) {
        if ((project.major(project.packageFor(file), 'vitest') ?? 0) < 5)
          continue
        for (const m of script(file).matchAll(/\b(describe|test|it|suite)\.sequential\b/g))
          report({ file, index: m.index, message: `${m[1]}.sequential was removed in Vitest 5. Use { concurrent: false }.` })
      }
    },
  },
  {
    id: 'vitest-hoisted-not-top-level',
    severity: 'error',
    category: 'testing',
    title: 'vi.mock, vi.unmock or vi.hoisted below the top level',
    why: 'Vitest hoists these calls to the top of the file. Since Vitest 5 a call nested in a block throws instead of warning.',
    fix: 'Move the call to the top level of the test file, or use vi.doMock for a mock that depends on runtime values.',
    docs: guide('vue-upgrade/references/vitest-5.md'),
    check({ project, sourceFiles, script, report }) {
      for (const file of sourceFiles.filter(f => TEST_FILE.test(f))) {
        if ((project.major(project.packageFor(file), 'vitest') ?? 0) < 5)
          continue
        for (const m of script(file).matchAll(/^([ \t]+)vi\.(mock|unmock|hoisted)\s*\(/gm))
          report({ file, index: m.index + m[1].length, message: `vi.${m[2]} is nested inside a block. Vitest 5 throws for this.` })
      }
    },
  },
  {
    id: 'router-guard-next-callback',
    severity: 'warn',
    category: 'vue',
    title: 'Navigation guard using next()',
    why: 'Vue Router guards can return false, a route location or nothing. The next() callback is deprecated, and calling it twice or not at all is a common source of stuck or doubled navigations.',
    fix: 'Drop the next parameter and return the result instead: return false, return \'/login\', or return nothing to continue.',
    docs: guide('vue/references/router/router-navigation-guard-next-deprecated.md'),
    check({ sourceFiles, script, report }) {
      const guard = /\b(beforeEach|beforeResolve|beforeEnter|beforeRouteEnter|beforeRouteUpdate|beforeRouteLeave)\s*[(:]\s*(?:async\s*)?(?:function\s*\w*\s*)?\(\s*\w+\s*(?::[^,)]+)?,\s*\w+\s*(?::[^,)]+)?,\s*(next)\b/g
      for (const file of sourceFiles) {
        const code = script(file)
        for (const m of code.matchAll(guard))
          report({ file, index: m.index + m[0].lastIndexOf('next'), message: `${m[1]} takes a next callback. Return a value instead.` })
      }
    },
  },
  {
    id: 'public-env-secret',
    severity: 'error',
    category: 'security',
    title: 'Secret exposed through a public env variable',
    why: 'Variables prefixed with VITE_ and NUXT_PUBLIC_, and everything under Nuxt runtimeConfig.public, are bundled into client JavaScript. Anyone who loads the page can read them.',
    fix: 'Keep the value on the server: a server route, Nuxt private runtimeConfig, or a backend that signs requests. Rotate the secret if it was ever deployed.',
    docs: guide('vue-review/references/checklist.md'),
    check({ project, sourceFiles, configFiles, script, report }) {
      const used = new RegExp(`\\b(?:import\\.meta\\.env|process\\.env)\\.((?:VITE_|NUXT_PUBLIC_)${SECRET_NAME})`, 'g')
      for (const file of sourceFiles) {
        for (const m of script(file).matchAll(used))
          report({ file, index: m.index, message: `${m[1]} is shipped to the browser.` })
      }
      const declared = new RegExp(`^\\s*(?:export\\s+)?((?:VITE_|NUXT_PUBLIC_)${SECRET_NAME})\\s*=`, 'gm')
      for (const file of project.files.filter(f => /(^|\/)\.env(\.[\w.-]+)?$/.test(f))) {
        for (const m of project.read(file).matchAll(declared))
          report({ file, index: m.index + m[0].indexOf(m[1]), message: `${m[1]} uses a public prefix, so its value ends up in client code.` })
      }
      for (const file of configFiles.filter(f => /nuxt\.config/.test(f))) {
        const code = script(file)
        const pub = /\bpublic\s*:\s*\{/g.exec(code)
        if (!pub)
          continue
        const block = code.slice(pub.index, code.indexOf('}', pub.index) + 1)
        for (const m of block.matchAll(/\b(\w*(?:secret|password|private)\w*)\s*:/gi))
          report({ file, index: pub.index + m.index, message: `runtimeConfig.public.${m[1]} is sent to the browser.` })
      }
    },
  },
  {
    id: 'ssr-module-level-state',
    severity: 'warn',
    category: 'nuxt',
    title: 'Module-level reactive state in a Nuxt composable',
    why: 'On the server a module is loaded once and shared by every request. A ref created at module level leaks one user\'s data into another user\'s page.',
    fix: 'Use useState(key, init) for shared state, or create the ref inside the composable function.',
    docs: guide('vue-debug/references/guides/state-ssr-cross-request-pollution.md'),
    check({ project, sourceFiles, configFiles, script, report }) {
      // In SPA mode (ssr: false) nothing runs on a shared server, so module state is fine.
      const spaDirs = new Set(configFiles
        .filter(f => /nuxt\.config/.test(f) && /^\s{0,2}ssr\s*:\s*false\b/m.test(script(f)))
        .map(f => project.packageFor(f)?.dir))
      for (const file of sourceFiles.filter(f => NUXT_STATE_DIR.test(f))) {
        const pkg = project.packageFor(file)
        if (!project.hasDep(pkg, 'nuxt') || spaDirs.has(pkg?.dir))
          continue
        for (const m of script(file).matchAll(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(ref|reactive|shallowRef|shallowReactive)\s*[(<]/gm))
          report({ file, index: m.index, message: `${m[1]} is a module-level ${m[2]}, shared by every request on the server.` })
      }
    },
  },
  {
    id: 'nuxt-fetch-in-setup',
    severity: 'warn',
    category: 'nuxt',
    title: '$fetch at the top level of script setup',
    why: 'Top-level $fetch in a Nuxt component runs during server rendering and again during hydration, and the result is not added to the payload.',
    fix: 'Use useFetch or useAsyncData in setup. Keep $fetch for event handlers.',
    docs: guide('nuxt/references/docs/core-data-fetching.md'),
    check({ project, sfc, sourceFiles, script, report }) {
      for (const file of sourceFiles.filter(f => f.endsWith('.vue'))) {
        if (!project.hasDep(project.packageFor(file), 'nuxt'))
          continue
        const code = script(file)
        for (const block of sfc(file).filter(b => b.tag === 'script' && b.setup)) {
          const content = code.slice(block.start, block.end)
          for (const m of content.matchAll(/^(?:(?:const|let)\s+[^=]+=\s*)?await\s+\$fetch\s*[(<]/gm))
            report({ file, index: block.start + m.index + m[0].indexOf('$fetch'), message: '$fetch runs twice here, once on the server and once in the browser.' })
        }
      }
    },
  },
  {
    id: 'pinia-store-destructure',
    severity: 'warn',
    category: 'vue',
    title: 'Pinia store destructured without storeToRefs',
    why: 'Destructuring a store copies the current values of state and getters, so the component stops updating. Actions are plain functions and are safe to destructure.',
    fix: 'Use const { a, b } = storeToRefs(store) for state and getters, and destructure actions from the store itself.',
    docs: guide('vue/references/pinia-gotchas/pinia-store-destructuring-breaks-reactivity.md'),
    check({ sourceFiles, script, report }) {
      for (const file of sourceFiles) {
        for (const m of script(file).matchAll(/\b(?:const|let)\s*\{[^}]*\}\s*=\s*(use[A-Z]\w*Store)\s*\(\s*\)/g))
          report({ file, index: m.index, message: `Destructuring ${m[1]}() loses reactivity for state and getters.` })
      }
    },
  },
]
