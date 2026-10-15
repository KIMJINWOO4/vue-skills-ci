import config from './config.mjs'
import dependencies from './dependencies.mjs'
import source from './source.mjs'
import vapor from './vapor.mjs'

export const rules = [...dependencies, ...config, ...vapor, ...source]

export const ruleById = new Map(rules.map(rule => [rule.id, rule]))

// Each rule's `category` is its group. Groups are what most projects pick from.
export const GROUPS = {
  toolchain: 'Dependency versions and peers, TypeScript 7 with vue-tsc, Vite 8 option names',
  testing: 'Vitest 4 and 5 removals in config and test files',
  vapor: 'Vue 3.6 Vapor Mode options and unsupported features',
  vue: 'VueUse 15 removals, Vue Router next(), Pinia destructuring',
  nuxt: 'SSR state shared between requests, $fetch in setup',
  security: 'Secrets exposed to the browser',
}

export const rulesInGroup = group => rules.filter(r => r.category === group).map(r => r.id)

export class SelectionError extends Error {}

// Accepts "a,b c", an array, or undefined. Names are group names, rule ids, "all" or "none".
export function parseList(value) {
  if (value == null)
    return undefined
  const list = (Array.isArray(value) ? value : String(value).split(/[\s,]+/)).map(s => String(s).trim()).filter(Boolean)
  return list.length ? list : undefined
}

function expand(name) {
  if (name in GROUPS)
    return rulesInGroup(name)
  if (ruleById.has(name))
    return [name]
  throw new SelectionError(`unknown rule or group "${name}". Groups: ${Object.keys(GROUPS).join(', ')}. Run "vue-skills-ci rules" for rule ids.`)
}

// Returns the ids to run: everything in `include` (default all) minus everything in `exclude`.
export function selectRules({ include, exclude } = {}) {
  const inc = parseList(include)
  let selected
  if (!inc || inc.includes('all'))
    selected = new Set(ruleById.keys())
  else if (inc.length === 1 && inc[0] === 'none')
    selected = new Set()
  else
    selected = new Set(inc.flatMap(expand))
  for (const id of (parseList(exclude) ?? []).flatMap(expand))
    selected.delete(id)
  return selected
}
