# vue-skills-ci

A ready-made GitHub Actions CI for Vue and Nuxt projects, plus 19 checks for the upgrade and safety problems that linters miss: TypeScript 7 under vue-tsc, Pinia 4 and Vitest 5 peers, options removed in VueUse 15 and Vitest 5, Vapor Mode settings, public env secrets and SSR state leaks.

[![CI](https://github.com/KIMJINWOO4/vue-skills-ci/actions/workflows/ci.yml/badge.svg)](https://github.com/KIMJINWOO4/vue-skills-ci/actions/workflows/ci.yml)
![Rules](https://img.shields.io/badge/rules-19-42b883)
![Dependencies](https://img.shields.io/badge/dependencies-0-35495e)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Every rule links to the guide in [vue-skills](https://github.com/KIMJINWOO4/vue-skills) that explains the problem, so a person or an AI agent can go from a red check to the fix in one click.

## Use the whole CI

Create `.github/workflows/ci.yml` in your project:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  vue:
    uses: KIMJINWOO4/vue-skills-ci/.github/workflows/vue-ci.yml@v1
```

Or let the CLI write it for you:

```bash
npx -y github:KIMJINWOO4/vue-skills-ci init
```

That is the whole setup. The workflow reads your repository and runs two jobs in parallel.

| Job | What it does |
|-----|--------------|
| Install, lint, type-check, test, build | Picks pnpm, npm, Yarn or Bun from your lockfile, installs with the lockfile frozen, then runs each of these scripts if `package.json` has it: `lint`, `typecheck` or `type-check`, `test:unit` or `test`, `build-only` or `build`. |
| Vue rules | Runs the 19 checks and puts each finding on the pull request diff, with a summary on the run page. |

Script names follow [create-vue](https://github.com/vuejs/create-vue), so a freshly scaffolded app works without changes. A step whose script does not exist is skipped, not failed.

![The example app passing every step of the reusable workflow](docs/images/workflow-run.png)

<sub>A real run of this repository's CI: the [example app](example) goes through every step of the reusable workflow in 17 seconds. [Open the run](https://github.com/KIMJINWOO4/vue-skills-ci/actions/runs/38697205118).</sub>

### Options

```yaml
jobs:
  vue:
    uses: KIMJINWOO4/vue-skills-ci/.github/workflows/vue-ci.yml@v1
    with:
      working-directory: apps/web   # monorepo: the folder with the app's package.json
      node-version: '22'
      test: false                   # skip a step
      fail-on: warn                 # make rule warnings fail the check too
      baseline: .vue-skills-ci-baseline.json
```

| Input | Default | Meaning |
|-------|---------|---------|
| `working-directory` | `.` | Folder with the app's `package.json`. The lockfile is found by walking up, so workspaces work. |
| `node-version` | `24` | Node.js version for install, lint, test and build. |
| `lint`, `typecheck`, `test`, `build` | `true` | Turn a step off. |
| `rules` | `true` | Turn the rule check off. |
| `fail-on` | `error` | Lowest rule severity that fails the check: `error`, `warn`, `info` or `never`. |
| `baseline` | | File of known findings to ignore (see [Existing projects](#existing-projects)). |

## Add only the checks

If you already have a CI workflow, add one step:

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: KIMJINWOO4/vue-skills-ci@v1
```

The action takes `path`, `fail-on`, `baseline` and `sarif` inputs. `npx -y github:KIMJINWOO4/vue-skills-ci init --rules-only` writes this workflow.

Each finding becomes an annotation with the reason, the fix and a link to the guide:

![Rule findings shown as annotations on a GitHub Actions run](docs/images/annotations.png)

<sub>The rule check on [fixtures/upgrade-traps](fixtures/upgrade-traps) in this repository's CI. On a pull request the same messages also appear inline on the changed lines.</sub>

To see the findings in the repository's Security tab as well, write SARIF and upload it:

```yaml
permissions:
  security-events: write
steps:
  - uses: actions/checkout@v7
  - uses: KIMJINWOO4/vue-skills-ci@v1
    with:
      sarif: vue-skills-ci.sarif
  - uses: github/codeql-action/upload-sarif@v4
    if: always()
    with:
      sarif_file: vue-skills-ci.sarif
```

## Run it locally

```bash
npx -y github:KIMJINWOO4/vue-skills-ci check
```

![Terminal output of vue-skills-ci on a project with upgrade problems](docs/images/terminal.png)

<sub>Real output on [fixtures/upgrade-traps](fixtures/upgrade-traps), a Nuxt project with the mistakes people make while upgrading.</sub>

It needs Node 20 or newer and installs nothing else. Useful flags: `--format json`, `--fail-on warn`, `--rule <id>`, `--output report.md --format markdown`. Run `vue-skills-ci --help` for the rest.

## Let an AI agent run it

The repository ships a `vue-ci` skill. An agent with it runs the check, follows each finding's guide link and fixes the code, or sets up the CI above.

```bash
npx skills add KIMJINWOO4/vue-skills-ci
```

Install [vue-skills](https://github.com/KIMJINWOO4/vue-skills) as well and the agent reads the guides from disk instead of the web.

## What the rules check

<!-- rules:start -->
| Rule | Default | Area | Catches |
|------|---------|------|---------|
| [`typescript7-with-vue-tsc`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/build-tooling/references/typescript-7.md) | error | toolchain | vue-tsc running on TypeScript 7 |
| [`missing-required-peer`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/pinia-4.md) | warn | toolchain | Required peer dependency not declared |
| [`end-of-life-framework`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/SKILL.md) | warn | toolchain | Framework version past end of life |
| [`prerelease-core-dependency`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/versions.md) | info | toolchain | Core package on a pre-release |
| [`vapor-event-delegation-option`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue/references/vue-36-vapor.md) | error | vue | Removed Vapor eventDelegation compiler option |
| [`vitest-removed-config`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/vitest-5.md) | error | testing | Vitest config option that no longer exists |
| [`vite8-legacy-options`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/vite-8.md) | warn | toolchain | Vite 7 option names in a Vite 8 config |
| [`vitest-artifacts-not-ignored`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/vitest-5.md) | info | testing | .vitest output folder not in .gitignore |
| [`vapor-without-script-setup`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue/references/vue-36-vapor.md) | error | vue | Vapor component without script setup |
| [`vapor-unsupported-feature`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue/references/vue-36-vapor.md) | warn | vue | Feature that Vapor Mode does not support |
| [`vueuse-templateref-removed`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/vueuse-15.md) | error | vue | templateRef imported from VueUse |
| [`vueuse-removed-timer-options`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/vueuse-15.md) | error | vue | VueUse timer option removed in v15 |
| [`vitest-sequential-removed`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/vitest-5.md) | error | testing | .sequential test modifier |
| [`vitest-hoisted-not-top-level`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-upgrade/references/vitest-5.md) | error | testing | vi.mock, vi.unmock or vi.hoisted below the top level |
| [`router-guard-next-callback`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue/references/router/router-navigation-guard-next-deprecated.md) | warn | vue | Navigation guard using next() |
| [`public-env-secret`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-review/references/checklist.md) | error | security | Secret exposed through a public env variable |
| [`ssr-module-level-state`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue-debug/references/guides/state-ssr-cross-request-pollution.md) | warn | nuxt | Module-level reactive state in a Nuxt composable |
| [`nuxt-fetch-in-setup`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/nuxt/references/docs/core-data-fetching.md) | warn | nuxt | $fetch at the top level of script setup |
| [`pinia-store-destructure`](https://github.com/KIMJINWOO4/vue-skills/blob/main/skills/vue/references/pinia-gotchas/pinia-store-destructuring-breaks-reactivity.md) | warn | vue | Pinia store destructured without storeToRefs |
<!-- rules:end -->

Details for each rule, with the reason and the fix: [docs/rules.md](docs/rules.md).

ESLint looks at one file at a time and does not know which version of Vitest or VueUse you installed. These rules read `package.json`, pnpm catalogs, config files and source together, so they can tell that `poolOptions` is a problem on Vitest 4 but fine on Vitest 3. Keep using ESLint with [eslint-plugin-vue](https://eslint.vuejs.org) for template and style rules; the two do not overlap.

## Existing projects

A large codebase may start with dozens of findings. Record them once, and CI fails only on new ones:

```bash
npx -y github:KIMJINWOO4/vue-skills-ci check --baseline .vue-skills-ci-baseline.json --update-baseline
```

Commit the file and pass it as `baseline`. Findings are matched by rule, file and the text of the line, so moving code up or down does not break the match. Run the same command again after fixing some of them.

## Configuration

Turn rules off or change their severity in `vue-skills-ci.config.json` at the project root:

```json
{
  "rules": {
    "pinia-store-destructure": "off",
    "prerelease-core-dependency": "warn"
  },
  "ignore": ["legacy/**"]
}
```

Silence a single line with a comment above it: `// vue-skills-ci-disable-next-line ssr-module-level-state`. `node_modules`, `dist`, `.nuxt`, `.output`, `public` and files over 1 MB are always skipped.

## The example app

[`example/`](example) is a small todo app in the create-vue layout: Vue 3.5, Pinia 4, VueUse 15, Vite 8, Vitest 5 with Vue Test Utils, ESLint with eslint-plugin-vue, and vue-tsc on TypeScript 6. This repository's [CI](.github/workflows/ci.yml) calls the reusable workflow on it for every push and pull request, the same way your project would. If you want to see exactly what the workflow runs, open the latest run of the `Example app` job.

## Contributing

Rules live in [`src/rules`](src/rules), one object per rule with its reason, fix and guide link. Each rule has a failing and a passing case in [`test/rules.test.mjs`](test/rules.test.mjs).

```bash
npm test             # node:test, no install needed
npm run docs         # regenerate docs/rules.md and the table above
npm run check:examples
```

A good new rule catches something real that ESLint cannot see, has a guide in vue-skills to link to, and stays quiet on correct code.

## License

MIT
