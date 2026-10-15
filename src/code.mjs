// Text helpers for rules: comment masking, SFC block views and call matching.
// Every view keeps the original length and newlines, so offsets map back to real lines.

const blank = s => s.replace(/[^\n]/g, ' ')

// Strings are matched so that `//` inside a URL is not taken for a comment; only comments are blanked.
const TOKENS = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`/g

export function maskComments(text) {
  return text.replace(TOKENS, token => (token[0] === '/' ? blank(token) : token))
}

export function sfcBlocks(text) {
  const blocks = []
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const start = m.index + m[0].indexOf('>') + 1
    blocks.push({ tag: 'script', attrs: m[1], start, end: start + m[2].length, setup: /\bsetup\b/.test(m[1]), vapor: /\bvapor\b/.test(m[1]) })
  }
  const open = text.match(/<template\b([^>]*)>/)
  const close = text.lastIndexOf('</template>')
  if (open && close > open.index) {
    const start = open.index + open[0].length
    blocks.push({ tag: 'template', attrs: open[1], start, end: close, vapor: /\bvapor\b/.test(open[1]) })
  }
  return blocks
}

function keepRanges(text, ranges) {
  let out = ''
  let pos = 0
  for (const { start, end } of [...ranges].sort((a, b) => a.start - b.start)) {
    out += blank(text.slice(pos, start)) + text.slice(start, end)
    pos = end
  }
  return out + blank(text.slice(pos))
}

// Script code with comments masked. For .vue files everything outside <script> is blanked.
export function scriptView(file, text) {
  if (!file.endsWith('.vue'))
    return maskComments(text)
  const scripts = sfcBlocks(text).filter(b => b.tag === 'script')
  return maskComments(keepRanges(text, scripts))
}

export function templateView(text) {
  return keepRanges(text, sfcBlocks(text).filter(b => b.tag === 'template'))
}

export function lineCol(text, index) {
  let line = 1
  let last = -1
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      last = i
    }
  }
  return { line, column: index - last }
}

// Finds `name(` calls and returns the argument text, matching nested brackets and skipping strings.
export function findCalls(code, names) {
  const re = new RegExp(`\\b(${names.join('|')})\\s*\\(`, 'g')
  const calls = []
  for (const m of code.matchAll(re)) {
    const open = m.index + m[0].length - 1
    let depth = 0
    let i = open
    for (; i < code.length; i++) {
      const c = code[i]
      if (c === '"' || c === '\'' || c === '`') {
        const q = c
        for (i++; i < code.length && code[i] !== q; i++) {
          if (code[i] === '\\')
            i++
        }
        continue
      }
      if (c === '(' || c === '{' || c === '[')
        depth++
      else if (c === ')' || c === '}' || c === ']')
        depth--
      if (depth === 0)
        break
    }
    calls.push({ name: m[1], index: m.index, args: code.slice(open + 1, i), argsIndex: open + 1 })
  }
  return calls
}
