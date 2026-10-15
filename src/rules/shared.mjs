export const SKILLS_URL = 'https://github.com/KIMJINWOO4/vue-skills/blob/main/skills'

export const guide = path => `${SKILLS_URL}/${path}`

// Offset of `"name":` inside a package.json, used to point findings at the right line.
export function jsonKeyIndex(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const m = new RegExp(`"${escaped}"\\s*:`).exec(text)
  return m ? m.index : 0
}

export const isPrerelease = spec => /-(alpha|beta|rc|nightly)|^(alpha|beta|rc|next|nightly|canary)$/i.test(spec)
