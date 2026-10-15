import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { run } from '../src/engine.mjs'

// Writes a throwaway project. Objects are serialized as JSON, strings are written as-is.
export function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'vue-skills-ci-'))
  for (const [path, content] of Object.entries(files)) {
    const abs = join(root, path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  }
  return root
}

export function findings(files, rule) {
  return run(project(files), { include: rule }).findings
}

export const pkg = (deps = {}, devDeps = {}) => ({ name: 'app', dependencies: deps, devDependencies: devDeps })
