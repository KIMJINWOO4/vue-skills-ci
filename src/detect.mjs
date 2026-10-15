// Works out how to install and run a project, for the reusable workflow.
// Walks up from the working directory to find the lockfile, so pnpm and npm workspaces work.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
]

// The first script name that exists wins. create-vue projects use test:unit, type-check and build-only.
const SCRIPTS = {
  lint: ['lint'],
  typecheck: ['typecheck', 'type-check'],
  test: ['test:unit', 'test'],
  build: ['build-only', 'build'],
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  catch {
    return {}
  }
}

export function detect(workingDir, workspaceRoot = workingDir) {
  const start = resolve(workingDir)
  const stop = resolve(workspaceRoot)
  let dir = start
  let found = null
  while (true) {
    const hit = LOCKFILES.find(([name]) => existsSync(join(dir, name)))
    if (hit) {
      found = { dir, lockfile: hit[0], pm: hit[1] }
      break
    }
    if (dir === stop || dirname(dir) === dir)
      break
    dir = dirname(dir)
  }
  const installDir = found?.dir ?? start
  const rootPkg = readJson(join(installDir, 'package.json'))
  const pkg = readJson(join(start, 'package.json'))
  const pm = found?.pm ?? (String(rootPkg.packageManager ?? '').split('@')[0] || 'npm')
  const rel = p => relative(stop, p).split(sep).join('/') || '.'

  const scripts = {}
  for (const [step, names] of Object.entries(SCRIPTS))
    scripts[step] = names.find(n => pkg.scripts?.[n]) ?? ''

  return {
    pm,
    install_dir: rel(installDir),
    lockfile: found ? rel(join(installDir, found.lockfile)) : '',
    yarn_berry: String(pm === 'yarn' && existsSync(join(installDir, '.yarnrc.yml'))),
    // pnpm/action-setup reads packageManager itself; pass a version only when the field is missing.
    pnpm_version: pm === 'pnpm' && !String(rootPkg.packageManager ?? '').startsWith('pnpm@') ? 'latest' : '',
    ...scripts,
  }
}
