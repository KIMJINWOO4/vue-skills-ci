#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { applyBaseline, writeBaseline } from './baseline.mjs'
import { detect } from './detect.mjs'
import { run, SEVERITIES } from './engine.mjs'
import { github, json, markdown, pretty, rulesTable, sarif } from './report.mjs'
import { GROUPS, parseList, ruleById, rulesInGroup, selectRules, SelectionError } from './rules/index.mjs'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
const VERSION = JSON.parse(readFileSync(pkgPath, 'utf8')).version

const HELP = `vue-skills-ci ${VERSION}

Usage
  vue-skills-ci check [dir]   Check a Vue or Nuxt project (default: current directory)
  vue-skills-ci rules         List the rule groups and rules
  vue-skills-ci init [dir]    Write .github/workflows/vue-ci.yml into a project
  vue-skills-ci detect [dir]  Print the package manager and scripts the reusable workflow will use

Choosing rules (check and init)
  --rules <list>        Groups or rule ids to run, comma separated (default: all)
                        Groups: ${Object.keys(GROUPS).join(', ')}
  --skip-rules <list>   Groups or rule ids to leave out

Options for check
  --format <name>       pretty (default), json, markdown, github, sarif
  --output <file>       Write the report to a file instead of stdout
  --sarif <file>        Also write a SARIF report, for GitHub code scanning
  --fail-on <level>     error (default), warn, info or never
  --baseline <file>     Ignore findings recorded in this file
  --update-baseline     Record the current findings in the baseline file and exit 0
  --color, --no-color   Force colors on or off

Options for init
  --rules-only          Write a workflow that only runs the rule check
  --yes                 Do not ask; use the flags as given (all rules if none)
  --force               Overwrite an existing workflow file
`

const FLAGS = ['update-baseline', 'color', 'no-color', 'rules-only', 'force', 'help', 'version', 'yes']

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      args._.push(a)
      continue
    }
    const [key, inline] = a.slice(2).split('=')
    if (FLAGS.includes(key))
      args[key] = true
    else
      args[key] = inline ?? argv[++i]
  }
  args.rules ??= args.rule // --rule was the 1.0 spelling
  return args
}

function fail(message) {
  process.stderr.write(`vue-skills-ci: ${message}\n`)
  process.exit(2)
}

function selection(args) {
  const include = parseList(args.rules)
  const exclude = parseList(args['skip-rules'])
  try {
    selectRules({ include, exclude })
  }
  catch (e) {
    if (e instanceof SelectionError)
      fail(e.message)
    throw e
  }
  return { include, exclude }
}

function check(args) {
  const root = resolve(args._[1] ?? '.')
  if (!existsSync(root))
    fail(`directory not found: ${root}`)
  const failOn = args['fail-on'] ?? 'error'
  if (failOn !== 'never' && !SEVERITIES.includes(failOn))
    fail(`--fail-on must be error, warn, info or never (got "${failOn}")`)

  let result
  try {
    result = run(root, selection(args))
  }
  catch (e) {
    if (e instanceof SelectionError)
      fail(`${e.message} (from vue-skills-ci.config.json)`)
    throw e
  }
  const baselinePath = args.baseline ? resolve(args.baseline) : null
  if (args['update-baseline']) {
    if (!baselinePath)
      fail('--update-baseline needs --baseline <file>')
    writeBaseline(baselinePath, result.findings)
    process.stdout.write(`Recorded ${result.findings.length} finding(s) in ${args.baseline}\n`)
    return 0
  }
  if (baselinePath)
    applyBaseline(baselinePath, result.findings)

  const format = args.format ?? 'pretty'
  const color = args['no-color'] ? false : args.color ? true : Boolean(process.stdout.isTTY && !process.env.NO_COLOR)
  const renderers = { pretty, json, markdown, github, sarif }
  if (!renderers[format])
    fail(`unknown format "${format}"`)
  const text = renderers[format](result, { color, version: VERSION })

  if (args.output) {
    mkdirSync(dirname(resolve(args.output)), { recursive: true })
    writeFileSync(args.output, text)
  }
  else {
    process.stdout.write(text)
  }
  if (args.sarif)
    writeFileSync(args.sarif, sarif(result, { version: VERSION }))
  if (format === 'github') {
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown(result))
    process.stdout.write(pretty(result, { color: true, version: VERSION }))
  }

  if (failOn === 'never')
    return 0
  const threshold = SEVERITIES.indexOf(failOn)
  return result.findings.some(f => !f.baseline && SEVERITIES.indexOf(f.severity) >= threshold) ? 1 : 0
}

function listRules(format) {
  if (format !== 'pretty') {
    process.stdout.write(rulesTable(format))
    return
  }
  const width = Math.max(...[...ruleById.keys()].map(id => id.length))
  for (const [group, about] of Object.entries(GROUPS)) {
    process.stdout.write(`\n${group}  ${about}\n`)
    for (const id of rulesInGroup(group)) {
      const rule = ruleById.get(id)
      process.stdout.write(`  ${id.padEnd(width)}  ${rule.severity.padEnd(5)}  ${rule.title}\n`)
    }
  }
  process.stdout.write(`\nPick with --rules <groups or ids> and --skip-rules <groups or ids>.\n`)
}

function withBlock(include, exclude, indent) {
  const lines = []
  if (include && !include.includes('all'))
    lines.push(`rules: ${include.join(',')}`)
  if (exclude)
    lines.push(`skip-rules: ${exclude.join(',')}`)
  return lines.length ? `${indent}with:\n${lines.map(l => `${indent}  ${l}`).join('\n')}\n` : ''
}

function workflow({ rulesOnly, include, exclude }) {
  const on = `on:\n  pull_request:\n  push:\n    branches: [main]\n`
  if (rulesOnly) {
    return `name: Vue checks\n\n${on}\njobs:\n  vue-skills-ci:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - uses: KIMJINWOO4/vue-skills-ci@v1\n${withBlock(include, exclude, '        ')}`
  }
  return `name: CI\n\n${on}\njobs:\n  vue:\n    # Installs dependencies with the project's package manager, runs the lint, type-check,\n    # test and build scripts that exist in package.json, then checks the vue-skills-ci rules.\n    # Options: https://github.com/KIMJINWOO4/vue-skills-ci#options\n    uses: KIMJINWOO4/vue-skills-ci/.github/workflows/vue-ci.yml@v1\n${withBlock(include, exclude, '    ')}`
}

// Asks which groups to enable. Enter keeps all of them.
async function askGroups() {
  const names = Object.keys(GROUPS)
  process.stdout.write('Which rule groups should run?\n\n')
  names.forEach((name, i) => process.stdout.write(`  ${i + 1}. ${name.padEnd(10)} ${GROUPS[name]} (${rulesInGroup(name).length})\n`))
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question('\nNumbers or names, comma separated [all]: ')).trim()
  rl.close()
  if (!answer || answer === 'all')
    return undefined
  return parseList(answer).map(item => (/^\d+$/.test(item) ? names[Number(item) - 1] ?? item : item))
}

async function init(args) {
  const root = resolve(args._[1] ?? '.')
  const target = join(root, '.github', 'workflows', 'vue-ci.yml')
  if (existsSync(target) && !args.force)
    fail(`${target} already exists. Pass --force to overwrite it.`)
  let { include, exclude } = selection(args)
  if (!include && !exclude && !args.yes && process.stdin.isTTY) {
    include = await askGroups()
    selection({ rules: include })
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, workflow({ rulesOnly: args['rules-only'], include, exclude }))
  const count = selectRules({ include, exclude }).size
  process.stdout.write(`Wrote ${target} with ${count} of ${ruleById.size} rules.\nCommit it and open a pull request to see the checks run.\n`)
  return 0
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0]
if (args.version) {
  process.stdout.write(`${VERSION}\n`)
  process.exit(0)
}
if (!command || args.help) {
  process.stdout.write(HELP)
  process.exit(0)
}
if (command === 'check')
  process.exit(check(args))
if (command === 'rules') {
  listRules(args.format ?? 'pretty')
  process.exit(0)
}
if (command === 'init')
  process.exit(await init(args))
if (command === 'detect') {
  const info = detect(args._[1] ?? '.', process.env.GITHUB_WORKSPACE ?? args._[1] ?? '.')
  process.stdout.write(`${Object.entries(info).map(([k, v]) => `${k}=${v}`).join('\n')}\n`)
  process.exit(0)
}
fail(`unknown command "${command}". Run "vue-skills-ci --help".`)
