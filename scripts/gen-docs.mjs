// Generates docs/rules.md, skills/vue-ci/references/rules.md and the rule table in README.md
// from the rule definitions, so the three never drift apart.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rulesTable } from '../src/report.mjs'
import { rules } from '../src/rules/index.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const detail = rules.map(r => [
  `## ${r.id}`,
  '',
  `Default severity: **${r.severity}**. Area: ${r.category}.`,
  '',
  `**Why.** ${r.why}`,
  '',
  `**Fix.** ${r.fix}`,
  '',
  `Guide: ${r.docs}`,
  '',
].join('\n')).join('\n')

const page = `# Rules\n\nGenerated from \`src/rules\` by \`node scripts/gen-docs.mjs\`.\n\n${rulesTable('markdown')}\n${detail}`

for (const file of ['docs/rules.md', 'skills/vue-ci/references/rules.md']) {
  mkdirSync(join(root, dirname(file)), { recursive: true })
  writeFileSync(join(root, file), page)
}

const readmePath = join(root, 'README.md')
const readme = readFileSync(readmePath, 'utf8')
const re = /(<!-- rules:start -->)[\s\S]*?(<!-- rules:end -->)/
if (re.test(readme))
  writeFileSync(readmePath, readme.replace(re, `$1\n${rulesTable('markdown')}$2`))
console.log(`Documented ${rules.length} rules`)
