// Renders real CLI output (with ANSI colors) as a terminal-styled HTML page for README screenshots.
//
//   node src/cli.mjs check fixtures/upgrade-traps --color | node scripts/render-terminal.mjs "$ npx github:KIMJINWOO4/vue-skills-ci check" > terminal.html
//   chrome --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1180,1000 --screenshot=docs/images/terminal.png terminal.html

import { readFileSync } from 'node:fs'

const COLORS = { 31: '#ff7b72', 32: '#7ee787', 33: '#e3b341', 36: '#79c0ff', 39: null }
const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function toHtml(ansi) {
  let html = ''
  const state = { bold: false, dim: false, underline: false, color: null }
  for (const part of ansi.split(/(\x1B\[\d+(?:;\d+)*m)/)) {
    const m = part.match(/^\x1B\[(\d+(?:;\d+)*)m$/)
    if (!m) {
      if (!part)
        continue
      const style = [
        state.color && `color:${state.color}`,
        state.bold && 'font-weight:700',
        state.dim && 'opacity:.55',
        state.underline && 'text-decoration:underline',
      ].filter(Boolean).join(';')
      html += style ? `<span style="${style}">${escape(part)}</span>` : escape(part)
      continue
    }
    for (const code of m[1].split(';').map(Number)) {
      if (code === 0)
        Object.assign(state, { bold: false, dim: false, underline: false, color: null })
      else if (code === 1)
        state.bold = true
      else if (code === 2)
        state.dim = true
      else if (code === 22)
        state.bold = state.dim = false
      else if (code === 4)
        state.underline = true
      else if (code === 24)
        state.underline = false
      else if (code in COLORS)
        state.color = COLORS[code]
    }
  }
  return html
}

const prompt = process.argv[2] ?? ''
// OSC 8 hyperlinks keep their visible text only.
const body = toHtml(readFileSync(0, 'utf8').replace(/\x1B\]8;;[^\x1B]*\x1B\\/g, '').replace(/\s+$/, ''))
process.stdout.write(`<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: #0d1117; }
  .window { margin: 0; background: #0d1117; color: #e6edf3; font: 14px/1.55 "Cascadia Mono", "SF Mono", Consolas, monospace; }
  .bar { display: flex; gap: 8px; padding: 14px 18px; background: #161b22; border-bottom: 1px solid #30363d; }
  .bar i { width: 12px; height: 12px; border-radius: 50%; display: block; }
  pre { margin: 0; padding: 18px 22px 24px; white-space: pre; font: inherit; }
  .prompt { color: #8b949e; }
</style>
<div class="window">
  <div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
  <pre>${prompt ? `<span class="prompt">${escape(prompt)}</span>\n\n` : ''}${body}</pre>
</div>
`)
