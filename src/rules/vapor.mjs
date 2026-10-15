import { guide } from './shared.mjs'

const UNSUPPORTED_IN_TEMPLATE = [
  { re: /\sv-memo\b/g, what: 'v-memo is ignored in Vapor components.' },
  { re: /\s@vue:\w+/g, what: '@vue:* element lifecycle events are ignored in Vapor components.' },
]
const UNSUPPORTED_IN_SCRIPT = [
  { re: /\bgetCurrentInstance\s*\(/g, what: 'getCurrentInstance() returns null in Vapor components.' },
  { re: /\bglobalProperties\b/g, what: 'app.config.globalProperties is not available in Vapor components.' },
  { re: /\.\$(el|props|attrs|slots|refs)\b/g, what: 'Vapor component refs do not expose $el, $props, $attrs, $slots or $refs.' },
]

const isVapor = blocks => blocks.some(b => b.vapor)

export default [
  {
    id: 'vapor-without-script-setup',
    severity: 'error',
    category: 'vue',
    title: 'Vapor component without script setup',
    why: 'Vapor Mode supports script setup and template-only components, not the Options API. Since Vue 3.6.0-rc.11 a Vapor SFC whose script is a plain script block fails to compile.',
    fix: 'Move the component to <script setup vapor>, or remove the vapor marker.',
    docs: guide('vue/references/vue-36-vapor.md'),
    check({ sourceFiles, sfc, report }) {
      for (const file of sourceFiles.filter(f => f.endsWith('.vue'))) {
        const blocks = sfc(file)
        if (!isVapor(blocks))
          continue
        // <script vapor> is shorthand for <script setup vapor>, so either attribute counts as setup.
        const scripts = blocks.filter(b => b.tag === 'script')
        const plain = scripts.filter(b => !b.setup && !b.vapor)
        if (plain.length && plain.length === scripts.length)
          report({ file, index: plain[0].start, message: 'A Vapor component needs <script setup>. A plain <script> block is rejected by the compiler.' })
      }
    },
  },
  {
    id: 'vapor-unsupported-feature',
    severity: 'warn',
    category: 'vue',
    title: 'Feature that Vapor Mode does not support',
    why: 'Vapor Mode supports a subset of Vue. v-memo, @vue:* element hooks, getCurrentInstance(), globalProperties and the $el family on component refs do not work inside Vapor components.',
    fix: 'Rewrite the part without the feature, or keep this component in VDOM mode behind vaporInteropPlugin.',
    docs: guide('vue/references/vue-36-vapor.md'),
    check({ sourceFiles, sfc, script, template, report }) {
      for (const file of sourceFiles.filter(f => f.endsWith('.vue'))) {
        if (!isVapor(sfc(file)))
          continue
        const tpl = template(file)
        for (const { re, what } of UNSUPPORTED_IN_TEMPLATE) {
          for (const m of tpl.matchAll(re))
            report({ file, index: m.index + 1, message: what })
        }
        const code = script(file)
        for (const { re, what } of UNSUPPORTED_IN_SCRIPT) {
          for (const m of code.matchAll(re))
            report({ file, index: m.index, message: what })
        }
      }
    },
  },
]
