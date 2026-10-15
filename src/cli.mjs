#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { applyBaseline, writeBaseline } from './baseline.mjs'
import { detect } from './detect.mjs'
import { run, SEVERITIES } from './engine.mjs'
import { github, json, markdown, pretty, rulesTable, sarif, summarize } from './report.mjs'
import { ruleById } from './rules/index.mjs'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
const VERSION = JSON.parse(readFileSync(pkgPath, 'utf8')).version

const HELP = `vue-skills-ci ${VERSION}

Usage
  vue-skills-ci check [dir]   Check a Vue or Nuxt project (default: current directory)
  vue-skills-ci rules         List the rules
  vue-skills-ci init [dir]    Write .github/workflows/vue-ci.yml into a project
  vue-skills-ci detect [dir]  Print the package manager and scripts the reusable workflow will use

Options for check
  --format <name>       pretty (default), json, markdown, github, sarif
  --output <file>       Write the report to a file instead of stdout
  --sarif <file>        Also write a SARIF report, for GitHub code scanning
  --fail-on <level>     error (default), warn, info or never
  --baseline <file>     Ignore findings recorded in this file
  --update-baseline     Record the current findings in the baseline file and exit 0
  --rule <id,...>       Run only these rules
  --color, --no-color   Force colors on or off

Options for init
  --rules-only          Write a workflow that only runs the rule check
  --force               Overwrite an existing workflow file
`

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      args._.push(a)
      continue
    }
    const [key, inline] = a.slice(2).split('=')
    if (['update-baseline', 'color', 'no-color', 'rules-only', 'force', 'help', 'version'].includes(key))
      args[key] = true
    else
      args[key] = inline ?? argv[++i]
  }
  return args
}

function fail(message) {
  process.stderr.write(`vue-skills-ci: ${message}\n`)
  process.exit(2)
}

function check(args) {
  const root = resolve(args._[1] ?? '.')
  if (!existsSync(root))
    fail(`directory not found: ${root}`)
  const only = args.rule?.split(',').map(s => s.trim()).filter(Boolean)
  for (const id of only ?? []) {
    if (!ruleById.has(id))
      fail(`unknown rule "${id}". Run "vue-skills-ci rules" to see the list.`)
  }
  const failOn = args['fail-on'] ?? 'error'
  if (failOn !== 'never' && !SEVERITIES.includes(failOn))
    fail(`--fail-on must be error, warn, info or never (got "${failOn}")`)

  const result = run(root, { only })
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

const FULL_WORKFLOW = `name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  vue:
    # Installs dependencies with the project's package manager, runs the lint, typecheck,
    # test and build scripts that exist in package.json, then checks the vue-skills-ci rules.
    # Options: https://github.com/KIMJINWOO4/vue-skills-ci#options
    uses: KIMJINWOO4/vue-skills-ci/.github/workflows/vue-ci.yml@v1
`

const RULES_WORKFLOW = `name: Vue checks

on:
  pull_request:
  push:
    branches: [main]

jobs:
  vue-skills-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: KIMJINWOO4/vue-skills-ci@v1
`

function init(args) {
  const root = resolve(args._[1] ?? '.')
  const target = join(root, '.github', 'workflows', 'vue-ci.yml')
  if (existsSync(target) && !args.force)
    fail(`${target} already exists. Pass --force to overwrite it.`)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, args['rules-only'] ? RULES_WORKFLOW : FULL_WORKFLOW)
  process.stdout.write(`Wrote ${target}\nCommit it and open a pull request to see the checks run.\n`)
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
  const format = args.format ?? 'pretty'
  if (format === 'pretty') {
    for (const [id, rule] of ruleById)
      process.stdout.write(`${id.padEnd(30)} ${rule.severity.padEnd(6)} ${rule.title}\n`)
  }
  else {
    process.stdout.write(rulesTable(format))
  }
  process.exit(0)
}
if (command === 'init')
  process.exit(init(args))
if (command === 'detect') {
  const info = detect(args._[1] ?? '.', process.env.GITHUB_WORKSPACE ?? args._[1] ?? '.')
  process.stdout.write(`${Object.entries(info).map(([k, v]) => `${k}=${v}`).join('\n')}\n`)
  process.exit(0)
}
fail(`unknown command "${command}". Run "vue-skills-ci --help".`)
