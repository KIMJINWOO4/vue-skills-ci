import config from './config.mjs'
import dependencies from './dependencies.mjs'
import source from './source.mjs'
import vapor from './vapor.mjs'

export const rules = [...dependencies, ...config, ...vapor, ...source]

export const ruleById = new Map(rules.map(rule => [rule.id, rule]))
