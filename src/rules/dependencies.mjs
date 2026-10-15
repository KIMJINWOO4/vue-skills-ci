import { guide, isPrerelease, jsonKeyIndex } from './shared.mjs'

const REQUIRED_PEERS = [
  { pkg: 'pinia', minMajor: 4, peer: '@vue/devtools-api', release: 'Pinia 4', docs: 'vue-upgrade/references/pinia-4.md' },
  { pkg: 'vitest', minMajor: 5, peer: 'vite', release: 'Vitest 5', docs: 'vue-upgrade/references/vitest-5.md' },
]

const END_OF_LIFE = [
  { pkg: 'nuxt', major: 3, date: '2026-07-31', name: 'Nuxt 3', docs: 'vue-upgrade/references/nuxt.md' },
  { pkg: 'vue', major: 2, date: '2023-12-31', name: 'Vue 2', docs: 'vue-upgrade/references/vue-2-to-3.md' },
]

const CORE_PACKAGES = ['vue', 'nuxt', 'vite', 'vitest', 'pinia', 'vue-router']

export default [
  {
    id: 'typescript7-with-vue-tsc',
    severity: 'error',
    category: 'toolchain',
    title: 'vue-tsc running on TypeScript 7',
    why: 'TypeScript 7.0 ships without the JavaScript compiler API that vue-tsc and the Vue language tools are built on, so type-checking .vue files fails.',
    fix: 'Keep TypeScript 6 for Vue type-checking: "typescript": "npm:@typescript/typescript6@^6.0.2". Packages without .vue files can use TypeScript 7.',
    docs: guide('build-tooling/references/typescript-7.md'),
    check({ project, report }) {
      for (const pkg of project.packages) {
        if (!pkg.deps.has('vue-tsc'))
          continue
        const ts = project.resolveSpec(pkg, 'typescript')
        if (!ts || ts.target !== 'typescript' || ts.major == null || ts.major < 7)
          continue
        const owner = pkg.deps.has('typescript') ? pkg : project.rootPackage
        report({
          file: owner.file,
          index: jsonKeyIndex(project.read(owner.file), 'typescript'),
          message: `typescript ${ts.spec} is TypeScript ${ts.major}, but vue-tsc still needs the TypeScript 6 API.`,
        })
      }
    },
  },
  {
    id: 'missing-required-peer',
    severity: 'warn',
    category: 'toolchain',
    title: 'Required peer dependency not declared',
    why: 'Pinia 4 made @vue/devtools-api a required peer, and Vitest 5 made vite one. npm and pnpm usually install peers on their own, Yarn does not, and an undeclared peer can drift to an incompatible version.',
    fix: 'Add the peer package to the same package.json, next to the package that needs it.',
    docs: guide('vue-upgrade/references/pinia-4.md'),
    check({ project, report }) {
      for (const pkg of project.packages) {
        for (const rule of REQUIRED_PEERS) {
          if (!pkg.deps.has(rule.pkg))
            continue
          const major = project.major(pkg, rule.pkg)
          if (major == null || major < rule.minMajor || project.hasDep(pkg, rule.peer))
            continue
          report({
            file: pkg.file,
            index: jsonKeyIndex(project.read(pkg.file), rule.pkg),
            message: `${rule.release} needs ${rule.peer} installed next to ${rule.pkg}, and this package.json does not declare it.`,
            docs: guide(rule.docs),
          })
        }
      }
    },
  },
  {
    id: 'end-of-life-framework',
    severity: 'warn',
    category: 'toolchain',
    title: 'Framework version past end of life',
    why: 'End-of-life versions no longer receive security fixes, and current libraries drop support for them.',
    fix: 'Plan the upgrade with the vue-upgrade skill.',
    docs: guide('vue-upgrade/SKILL.md'),
    check({ project, report }) {
      for (const pkg of project.packages) {
        for (const eol of END_OF_LIFE) {
          if (!pkg.deps.has(eol.pkg) || project.major(pkg, eol.pkg) !== eol.major)
            continue
          report({
            file: pkg.file,
            index: jsonKeyIndex(project.read(pkg.file), eol.pkg),
            message: `${eol.name} reached end of life on ${eol.date}.`,
            docs: guide(eol.docs),
          })
        }
      }
    },
  },
  {
    id: 'prerelease-core-dependency',
    severity: 'info',
    category: 'toolchain',
    title: 'Core package on a pre-release',
    why: 'Release candidates and nightlies can change behavior between builds. Vue 3.6, for example, changed Vapor event delegation between rc.1 and rc.2.',
    fix: 'Pin an exact pre-release version while trying it, and keep production on the latest stable release.',
    docs: guide('vue-upgrade/references/versions.md'),
    check({ project, report }) {
      for (const pkg of project.packages) {
        for (const name of [...CORE_PACKAGES, 'nuxt-nightly']) {
          const spec = pkg.deps.get(name)
          if (spec == null || (name !== 'nuxt-nightly' && !isPrerelease(spec)))
            continue
          report({
            file: pkg.file,
            index: jsonKeyIndex(project.read(pkg.file), name),
            message: `${name} is set to the pre-release "${spec}".`,
          })
        }
      }
    },
  },
]
