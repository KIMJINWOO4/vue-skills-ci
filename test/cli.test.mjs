import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { detect } from '../src/detect.mjs'
import { pkg, project } from './helpers.mjs'

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url))
const exec = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } })

const broken = () => project({
  'package.json': pkg({ pinia: '^4.1.0' }, { 'typescript': '^7.0.2', 'vue-tsc': '^3.3.13' }),
})

describe('check', () => {
  it('exits 1 on errors and 0 with --fail-on never', () => {
    const root = broken()
    assert.equal(exec('check', root).status, 1)
    assert.equal(exec('check', root, '--fail-on', 'never').status, 0)
  })
  it('exits 0 on warnings by default and 1 with --fail-on warn', () => {
    const root = project({ 'package.json': pkg({ pinia: '^4.1.0' }) })
    assert.equal(exec('check', root).status, 0)
    assert.equal(exec('check', root, '--fail-on', 'warn').status, 1)
  })
  it('prints GitHub annotations', () => {
    const out = exec('check', broken(), '--format', 'github', '--fail-on', 'never').stdout
    assert.match(out, /^::error file=package\.json,line=\d+,col=\d+,title=vue-skills-ci%3A typescript7-with-vue-tsc::/m)
  })
  it('writes valid SARIF', () => {
    const root = broken()
    const file = join(root, 'out.sarif')
    exec('check', root, '--sarif', file, '--fail-on', 'never')
    const log = JSON.parse(readFileSync(file, 'utf8'))
    assert.equal(log.version, '2.1.0')
    assert.ok(log.runs[0].results.some(r => r.ruleId === 'typescript7-with-vue-tsc'))
  })
  it('only fails on findings that are not in the baseline', () => {
    const root = broken()
    const baseline = join(root, 'baseline.json')
    assert.equal(exec('check', root, '--baseline', baseline, '--update-baseline').status, 0)
    assert.equal(exec('check', root, '--baseline', baseline).status, 0)
    writeFileSync(join(root, 'vite.config.ts'), 'export default { compilerOptions: { eventDelegation: true } }')
    assert.equal(exec('check', root, '--baseline', baseline).status, 1)
  })
  it('turns rules off through the config file', () => {
    const root = broken()
    writeFileSync(join(root, 'vue-skills-ci.config.json'), JSON.stringify({ rules: { 'typescript7-with-vue-tsc': 'off' } }))
    assert.equal(exec('check', root).status, 0)
  })
})

describe('init', () => {
  it('writes the reusable workflow caller', () => {
    const root = project({ 'package.json': pkg() })
    assert.equal(exec('init', root).status, 0)
    const yml = readFileSync(join(root, '.github/workflows/vue-ci.yml'), 'utf8')
    assert.match(yml, /uses: KIMJINWOO4\/vue-skills-ci\/\.github\/workflows\/vue-ci\.yml@v1/)
    assert.equal(exec('init', root).status, 2)
  })
  it('writes a rules-only workflow', () => {
    const root = project({ 'package.json': pkg() })
    exec('init', root, '--rules-only')
    assert.ok(existsSync(join(root, '.github/workflows/vue-ci.yml')))
    assert.match(readFileSync(join(root, '.github/workflows/vue-ci.yml'), 'utf8'), /uses: KIMJINWOO4\/vue-skills-ci@v1/)
  })
})

describe('detect', () => {
  it('reads create-vue script names', () => {
    const root = project({
      'package.json': { packageManager: 'pnpm@12.11.2', scripts: { 'build': 'run-p type-check build-only', 'build-only': 'vite build', 'type-check': 'vue-tsc --build', 'test:unit': 'vitest', 'lint': 'eslint .' } },
      'pnpm-lock.yaml': '',
    })
    const info = detect(root)
    assert.equal(info.pm, 'pnpm')
    assert.equal(info.pnpm_version, '')
    assert.deepEqual([info.lint, info.typecheck, info.test, info.build], ['lint', 'type-check', 'test:unit', 'build-only'])
  })
  it('finds the lockfile of a workspace root', () => {
    const root = project({
      'package.json': { private: true },
      'package-lock.json': '{}',
      'apps/web/package.json': { scripts: { build: 'vite build' } },
    })
    const info = detect(join(root, 'apps/web'), root)
    assert.equal(info.pm, 'npm')
    assert.equal(info.install_dir, '.')
    assert.equal(info.build, 'build')
    assert.equal(info.test, '')
  })
})
