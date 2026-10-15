// A baseline records known findings so CI fails only on new ones. Fingerprints use the
// rule, the file and the trimmed source line, so they survive code moving up or down.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export function fingerprint(f) {
  return createHash('sha1').update(`${f.rule}\0${f.file}\0${f.source}`).digest('hex').slice(0, 16)
}

export function writeBaseline(path, findings) {
  const counts = {}
  for (const f of findings) {
    const key = fingerprint(f)
    counts[key] ??= { rule: f.rule, file: f.file, count: 0 }
    counts[key].count++
  }
  const sorted = Object.fromEntries(Object.entries(counts).sort(([, a], [, b]) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule)))
  writeFileSync(path, `${JSON.stringify({ version: 1, findings: sorted }, null, 2)}\n`)
}

// Marks findings already in the baseline. Returns how many were matched.
export function applyBaseline(path, findings) {
  if (!existsSync(path))
    return 0
  const remaining = new Map(Object.entries(JSON.parse(readFileSync(path, 'utf8')).findings ?? {}).map(([k, v]) => [k, v.count]))
  let known = 0
  for (const f of findings) {
    const key = fingerprint(f)
    if ((remaining.get(key) ?? 0) > 0) {
      remaining.set(key, remaining.get(key) - 1)
      f.baseline = true
      known++
    }
  }
  return known
}
