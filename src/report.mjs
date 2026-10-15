import { fingerprint } from './baseline.mjs'
import { ruleById, rules } from './rules/index.mjs'

const LABEL = { error: 'error', warn: 'warn', info: 'info' }

function palette(enabled) {
  const wrap = (open, close) => s => (enabled ? `\x1B[${open}m${s}\x1B[${close}m` : String(s))
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    yellow: wrap(33, 39),
    cyan: wrap(36, 39),
    green: wrap(32, 39),
    underline: wrap(4, 24),
  }
}

export function summarize(findings) {
  const active = findings.filter(f => !f.baseline)
  const count = sev => active.filter(f => f.severity === sev).length
  return {
    total: active.length,
    error: count('error'),
    warn: count('warn'),
    info: count('info'),
    files: new Set(active.map(f => f.file)).size,
    known: findings.length - active.length,
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Rules that fired, each with the guides of its findings (one rule can point to several guides).
function hitRules(findings) {
  return [...new Set(findings.map(f => f.rule))].map(id => ({
    ...ruleById.get(id),
    guides: [...new Set(findings.filter(f => f.rule === id).map(f => f.docs))],
  }))
}

function wrap(text, width) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line)
      line = word
    }
    else {
      line = line ? `${line} ${word}` : word
    }
  }
  return [...lines, line]
}

// OSC 8 hyperlink: short visible text that modern terminals open on click.
const link = (url, text) => `\x1B]8;;${url}\x1B\\${text}\x1B]8;;\x1B\\`
const guideLabel = url => url.replace(/^.*\/skills\//, 'vue-skills/')

export function pretty(result, { color = false, version = '', columns = process.stdout.columns || 100 } = {}) {
  const c = palette(color)
  const tint = { error: c.red, warn: c.yellow, info: c.cyan }
  const active = result.findings.filter(f => !f.baseline)
  const out = []
  let current = null
  for (const f of active) {
    if (f.file !== current) {
      if (current)
        out.push('')
      out.push(c.underline(f.file))
      current = f.file
    }
    const pos = `${f.line}:${f.column}`.padEnd(7)
    out.push(`  ${c.dim(pos)} ${tint[f.severity](LABEL[f.severity].padEnd(5))}  ${f.message}  ${c.dim(f.rule)}`)
  }

  const s = summarize(result.findings)
  if (out.length)
    out.push('')
  if (s.total === 0) {
    out.push(c.green(`No problems found in ${plural(result.files, 'file')}.`))
  }
  else {
    const parts = [plural(s.error, 'error'), plural(s.warn, 'warning'), `${s.info} info`].join(', ')
    out.push((s.error ? c.red : c.yellow)(c.bold(`${plural(s.total, 'problem')} (${parts}) in ${plural(s.files, 'file')}`)))
  }
  if (s.known)
    out.push(c.dim(`${plural(s.known, 'known finding')} hidden by the baseline`))

  const hit = hitRules(active)
  if (hit.length) {
    out.push('', c.bold('How to fix'))
    const width = Math.max(...hit.map(r => r.id.length))
    const indent = ' '.repeat(width + 4)
    for (const rule of hit) {
      const [first, ...rest] = wrap(rule.fix, Math.max(40, columns - indent.length))
      out.push(`  ${tint[rule.severity](rule.id.padEnd(width))}  ${first}`)
      for (const line of rest)
        out.push(`${indent}${line}`)
      for (const url of rule.guides)
        out.push(`${indent}${c.dim(color ? link(url, `guide: ${guideLabel(url)}`) : url)}`)
    }
  }
  if (version)
    out.push('', c.dim(`vue-skills-ci ${version}`))
  return `${out.join('\n')}\n`
}

export function json(result, { version = '' } = {}) {
  return `${JSON.stringify({ tool: 'vue-skills-ci', version, summary: summarize(result.findings), findings: result.findings }, null, 2)}\n`
}

export function markdown(result) {
  const s = summarize(result.findings)
  const active = result.findings.filter(f => !f.baseline)
  if (!s.total)
    return `### vue-skills-ci\n\nNo problems found.${s.known ? ` ${plural(s.known, 'known finding')} stay in the baseline.` : ''}\n`
  const rows = active.map(f => `| ${f.severity} | \`${f.file}:${f.line}\` | ${f.message.replace(/\|/g, '\\|')} | [${f.rule}](${f.docs}) |`)
  const fixes = hitRules(active).map(r => `- **${r.id}**: ${r.fix} ${r.guides.map(url => `[Guide](${url})`).join(' ')}`)
  return [
    `### vue-skills-ci: ${plural(s.error, 'error')}, ${plural(s.warn, 'warning')}, ${s.info} info`,
    '',
    '| Severity | Location | Problem | Rule |',
    '|----------|----------|---------|------|',
    ...rows,
    '',
    '#### How to fix',
    '',
    ...fixes,
    ...(s.known ? ['', `${plural(s.known, 'known finding')} stay in the baseline and are not listed.`] : []),
    '',
  ].join('\n')
}

const escapeData = s => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const escapeProp = s => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C')
const COMMAND = { error: 'error', warn: 'warning', info: 'notice' }

// GitHub Actions workflow commands: each finding becomes an annotation on the pull request diff.
export function github(result) {
  return result.findings
    .filter(f => !f.baseline)
    .map((f) => {
      const props = `file=${escapeProp(f.file)},line=${f.line},col=${f.column},title=${escapeProp(`vue-skills-ci: ${f.rule}`)}`
      return `::${COMMAND[f.severity]} ${props}::${escapeData(`${f.message}\nFix: ${f.fix}\nGuide: ${f.docs}`)}`
    })
    .join('\n')
    .concat('\n')
}

const LEVEL = { error: 'error', warn: 'warning', info: 'note' }

export function sarif(result, { version = '' } = {}) {
  const log = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'vue-skills-ci',
          version,
          informationUri: 'https://github.com/KIMJINWOO4/vue-skills-ci',
          rules: rules.map(r => ({
            id: r.id,
            name: r.id,
            shortDescription: { text: r.title },
            fullDescription: { text: r.why },
            help: { text: `${r.fix}\n${r.docs}`, markdown: `${r.fix}\n\n[Guide](${r.docs})` },
            helpUri: r.docs,
            defaultConfiguration: { level: LEVEL[r.severity] },
            properties: { tags: [r.category] },
          })),
        },
      },
      results: result.findings.filter(f => !f.baseline).map(f => ({
        ruleId: f.rule,
        level: LEVEL[f.severity],
        message: { text: f.message },
        locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: f.line, startColumn: f.column } } }],
        partialFingerprints: { 'vueSkillsCi/v1': fingerprint(f) },
      })),
    }],
  }
  return `${JSON.stringify(log, null, 2)}\n`
}

export function rulesTable(format) {
  if (format === 'json')
    return `${JSON.stringify(rules.map(({ check, ...meta }) => meta), null, 2)}\n`
  const rows = rules.map(r => `| [\`${r.id}\`](${r.docs}) | ${r.severity} | ${r.category} | ${r.title} |`)
  return ['| Rule | Default | Area | Catches |', '|------|---------|------|---------|', ...rows, ''].join('\n')
}
