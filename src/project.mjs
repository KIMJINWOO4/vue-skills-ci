// Loads a project: the files to scan, every package.json, pnpm catalogs, and helpers the rules share.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.nuxt', '.output',
  '.vercel', '.netlify', '.cache', '.vitest', '.turbo', '.pnpm-store', '.vue-skills-ci',
  // Static assets copied as-is by Vite and Nuxt, and agent worktrees that duplicate the repo.
  'public', '.claude',
])

export const SOURCE_EXT = /\.(vue|[cm]?[jt]sx?)$/
export const CONFIG_FILE = /(^|\/)(vite|vitest|nuxt)\.config\.[cm]?[jt]s$/
export const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|tests?)\//

const toPosix = p => p.split(sep).join('/')

// Larger files are generated bundles or data, not code a person maintains.
const MAX_FILE_BYTES = 1_000_000

function walk(root, dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name))
        walk(root, abs, out)
    }
    else if (entry.isFile() && statSync(abs).size <= MAX_FILE_BYTES) {
      out.push(toPosix(relative(root, abs)))
    }
  }
  return out
}

export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*'
      i++
      if (glob[i + 1] === '/')
        i++
    }
    else if (c === '*') {
      re += '[^/]*'
    }
    else if (c === '?') {
      re += '[^/]'
    }
    else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${re}$`)
}

// Minimal reader for the `catalog:` and `catalogs:` maps of pnpm-workspace.yaml.
export function readCatalogs(text) {
  const catalogs = {}
  let section = null
  let name = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '')
    if (!line.trim())
      continue
    const indent = line.length - line.trimStart().length
    const kv = line.trim().match(/^(['"]?)([^'":]+)\1\s*:\s*(.*)$/)
    if (!kv)
      continue
    const [, , key, value] = kv
    if (indent === 0) {
      section = key === 'catalog' ? 'catalog' : key === 'catalogs' ? 'catalogs' : null
      name = section === 'catalog' ? 'default' : null
      continue
    }
    if (section === 'catalogs' && indent > 0 && !value) {
      name = key
      continue
    }
    if (section && name && value) {
      catalogs[name] ??= {}
      catalogs[name][key] = value.replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  return catalogs
}

export function loadProject(root, { ignore = [] } = {}) {
  const ignoreRes = ignore.map(globToRegExp)
  const files = walk(root, root, []).filter(f => !ignoreRes.some(re => re.test(f))).sort()
  const cache = new Map()
  const read = (file) => {
    if (!cache.has(file))
      cache.set(file, readFileSync(join(root, file), 'utf8'))
    return cache.get(file)
  }

  const workspaceFile = files.find(f => f === 'pnpm-workspace.yaml')
  const catalogs = workspaceFile ? readCatalogs(read(workspaceFile)) : {}

  const packages = files
    .filter(f => f === 'package.json' || f.endsWith('/package.json'))
    .map((file) => {
      let json = {}
      try {
        json = JSON.parse(read(file))
      }
      catch {}
      const deps = new Map()
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const [name, spec] of Object.entries(json[field] ?? {}))
          deps.set(name, String(spec))
      }
      return { file, dir: posix.dirname(file), json, deps }
    })
    .sort((a, b) => b.dir.length - a.dir.length)

  const rootPackage = packages.find(p => p.dir === '.')

  function packageFor(file) {
    return packages.find(p => p.dir === '.' || file === p.dir || file.startsWith(`${p.dir}/`)) ?? null
  }

  // Resolves catalog: and npm: specifiers to a concrete range, then returns the highest major it allows.
  function resolveSpec(pkg, name) {
    let spec = pkg?.deps.get(name) ?? rootPackage?.deps.get(name)
    if (spec == null)
      return null
    let target = name
    if (spec.startsWith('catalog:')) {
      const catalog = spec.slice('catalog:'.length) || 'default'
      spec = catalogs[catalog]?.[name] ?? ''
    }
    const alias = spec.match(/^npm:((?:@[^/]+\/)?[^@]+)@(.*)$/)
    if (alias) {
      target = alias[1]
      spec = alias[2]
    }
    const majors = spec.split('||').map(part => part.match(/(\d+)(?:\.(\d+))?/)).filter(Boolean)
    const major = majors.length ? Math.max(...majors.map(m => Number(m[1]))) : null
    return { spec, target, major }
  }

  function major(pkg, name) {
    const resolved = resolveSpec(pkg, name)
    return resolved && resolved.target === name ? resolved.major : null
  }

  function hasDep(pkg, name) {
    return Boolean(pkg?.deps.has(name) || rootPackage?.deps.has(name))
  }

  return {
    root,
    files,
    read,
    packages,
    rootPackage,
    catalogs,
    packageFor,
    resolveSpec,
    major,
    hasDep,
  }
}
