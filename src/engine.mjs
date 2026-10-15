import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lineCol, scriptView, sfcBlocks, templateView } from './code.mjs'
import { CONFIG_FILE, loadProject, SOURCE_EXT } from './project.mjs'
import { rules, selectRules } from './rules/index.mjs'

export const SEVERITIES = ['info', 'warn', 'error']
export const CONFIG_NAME = 'vue-skills-ci.config.json'

export function loadConfig(root) {
  const path = join(root, CONFIG_NAME)
  if (!existsSync(path))
    return { rules: {}, ignore: [] }
  const config = JSON.parse(readFileSync(path, 'utf8'))
  return { include: config.include, exclude: config.exclude, rules: config.rules ?? {}, ignore: config.ignore ?? [] }
}

function memo(fn) {
  const cache = new Map()
  return (key) => {
    if (!cache.has(key))
      cache.set(key, fn(key))
    return cache.get(key)
  }
}

// `// vue-skills-ci-disable-next-line rule-a, rule-b` on the line above, or `vue-skills-ci-disable-line` on the same line.
function isSuppressed(lines, line, ruleId) {
  const check = (text, marker) => {
    const at = text?.indexOf(marker) ?? -1
    if (at === -1)
      return false
    const ids = text.slice(at + marker.length).replace(/(\*\/|-->).*$/, '').split(/[\s,]+/).filter(Boolean)
    return ids.length === 0 || ids.includes(ruleId)
  }
  return check(lines[line - 1], 'vue-skills-ci-disable-line') || check(lines[line - 2], 'vue-skills-ci-disable-next-line')
}

// `include` and `exclude` take group names or rule ids. When given, they replace the config file's lists.
export function run(root, { include, exclude } = {}) {
  const config = loadConfig(root)
  const selected = selectRules({ include: include ?? config.include, exclude: exclude ?? config.exclude })
  const project = loadProject(root, { ignore: config.ignore })
  const ctx = {
    project,
    sourceFiles: project.files.filter(f => SOURCE_EXT.test(f)),
    configFiles: project.files.filter(f => CONFIG_FILE.test(f)),
    script: memo(file => scriptView(file, project.read(file))),
    template: memo(file => templateView(project.read(file))),
    sfc: memo(file => sfcBlocks(project.read(file))),
  }
  const lines = memo(file => project.read(file).split(/\r?\n/))

  const findings = []
  for (const rule of rules) {
    if (!selected.has(rule.id))
      continue
    const setting = config.rules[rule.id]
    if (setting === 'off')
      continue
    rule.check({
      ...ctx,
      report(f) {
        const pos = f.line ? { line: f.line, column: f.column ?? 1 } : lineCol(project.read(f.file), f.index ?? 0)
        if (isSuppressed(lines(f.file), pos.line, rule.id))
          return
        findings.push({
          rule: rule.id,
          severity: SEVERITIES.includes(setting) ? setting : (f.severity ?? rule.severity),
          file: f.file,
          line: pos.line,
          column: pos.column,
          message: f.message,
          fix: rule.fix,
          docs: f.docs ?? rule.docs,
          source: (lines(f.file)[pos.line - 1] ?? '').trim(),
        })
      },
    })
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
  return { root, files: project.files.length, findings, rules: [...selected] }
}
