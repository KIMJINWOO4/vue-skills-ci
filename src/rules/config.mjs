import { guide } from './shared.mjs'

const VITEST_WORKSPACE_FILE = /(^|\/)vitest\.workspace\.([cm]?[jt]s|json)$/

function* matches(code, re) {
  for (const m of code.matchAll(re))
    yield m
}

export default [
  {
    id: 'vapor-event-delegation-option',
    severity: 'error',
    category: 'vue',
    title: 'Removed Vapor eventDelegation compiler option',
    why: 'Vue 3.6.0-rc.2 made Vapor event delegation opt-in per listener and removed compilerOptions.eventDelegation.',
    fix: 'Delete the option. Add the .delegate modifier (for example @click.delegate) to listeners that should delegate to document.',
    docs: guide('vue/references/vue-36-vapor.md'),
    check({ configFiles, script, report }) {
      for (const file of configFiles) {
        for (const m of matches(script(file), /\beventDelegation\s*:/g))
          report({ file, index: m.index, message: 'compilerOptions.eventDelegation no longer exists in Vue 3.6.' })
      }
    },
  },
  {
    id: 'vitest-removed-config',
    severity: 'error',
    category: 'testing',
    title: 'Vitest config option that no longer exists',
    why: 'Vitest 4 removed poolOptions, minWorkers and workspace files. Vitest 5 renamed deps.optimizer.web to deps.optimizer.client. Removed options are ignored or rejected, so the run does not use the settings you expect.',
    fix: 'Move pool settings to top-level maxWorkers and isolate, move workspace entries to test.projects, and rename optimizer.web to optimizer.client.',
    docs: guide('vue-upgrade/references/vitest-5.md'),
    check({ project, configFiles, script, report }) {
      const majorFor = file => project.major(project.packageFor(file), 'vitest')
      for (const file of project.files.filter(f => VITEST_WORKSPACE_FILE.test(f))) {
        if ((majorFor(file) ?? 0) >= 4)
          report({ file, line: 1, message: 'Vitest 4 and later ignore workspace files. Define projects in test.projects instead.' })
      }
      for (const file of configFiles) {
        const major = majorFor(file)
        if (major == null || major < 4)
          continue
        const code = script(file)
        for (const m of matches(code, /\bpoolOptions\s*:/g))
          report({ file, index: m.index, message: 'poolOptions was removed in Vitest 4. Use top-level maxWorkers and isolate.' })
        for (const m of matches(code, /\bminWorkers\s*:/g))
          report({ file, index: m.index, message: 'minWorkers was removed in Vitest 4.' })
        if (major >= 5) {
          for (const m of matches(code, /\boptimizer\s*:\s*\{[^}]*?\bweb\s*:/g))
            report({ file, index: m.index + m[0].lastIndexOf('web'), message: 'deps.optimizer.web is deps.optimizer.client in Vitest 5.' })
        }
      }
    },
  },
  {
    id: 'vite8-legacy-options',
    severity: 'warn',
    category: 'toolchain',
    title: 'Vite 7 option names in a Vite 8 config',
    why: 'Vite 8 bundles with Rolldown and transforms with Oxc. Old option names are converted with a warning, some are now no-ops, and the object form of manualChunks was removed.',
    fix: 'Rename build.rollupOptions to build.rolldownOptions and esbuild to oxc, drop build.commonjsOptions, and replace manualChunks objects with Rolldown codeSplitting.',
    docs: guide('vue-upgrade/references/vite-8.md'),
    check({ project, configFiles, script, report }) {
      for (const file of configFiles) {
        if ((project.major(project.packageFor(file), 'vite') ?? 0) < 8)
          continue
        const code = script(file)
        for (const m of matches(code, /\brollupOptions\s*:/g))
          report({ file, index: m.index, message: 'build.rollupOptions is build.rolldownOptions in Vite 8.' })
        for (const m of matches(code, /^\s*esbuild\s*:/gm))
          report({ file, index: m.index + m[0].indexOf('esbuild'), message: 'Vite 8 replaced the esbuild options with oxc.' })
        for (const m of matches(code, /\bcommonjsOptions\s*:/g))
          report({ file, index: m.index, message: 'build.commonjsOptions does nothing in Vite 8.' })
        for (const m of matches(code, /\bmanualChunks\s*:\s*\{/g))
          report({ file, index: m.index, severity: 'error', message: 'The object form of manualChunks was removed in Vite 8. Use codeSplitting.' })
      }
    },
  },
  {
    id: 'vitest-artifacts-not-ignored',
    severity: 'info',
    category: 'testing',
    title: '.vitest output folder not in .gitignore',
    why: 'Vitest 5 writes reporter output, blob reports and attachments to a .vitest folder in the project root.',
    fix: 'Add .vitest to .gitignore.',
    docs: guide('vue-upgrade/references/vitest-5.md'),
    check({ project, report }) {
      if (!project.files.includes('.gitignore') || (project.major(project.rootPackage, 'vitest') ?? 0) < 5)
        return
      if (!/^\/?\.vitest\/?\s*$/m.test(project.read('.gitignore')))
        report({ file: '.gitignore', line: 1, message: 'Vitest 5 writes to .vitest/, which is not ignored.' })
    },
  },
]
