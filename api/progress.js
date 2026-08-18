import fs from 'fs'

const FILE = '/tmp/birthday-progress.json'

function readStore() {
  const g = globalThis
  if (g.__birthdayProgress) return g.__birthdayProgress
  try {
    g.__birthdayProgress = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    g.__birthdayProgress = {}
  }
  return g.__birthdayProgress
}

function writeStore(data) {
  globalThis.__birthdayProgress = data
  try {
    fs.writeFileSync(FILE, JSON.stringify(data))
  } catch { /* ignore */ }
}

function isHollow(p) {
  return Object.keys(p.solved || {}).length === 0 && !(p.attempts || []).length && !Number(p.letterAt || 0)
}

function mergeProgress(a = {}, b = {}) {
  const solved = { ...(a.solved || {}), ...(b.solved || {}) }
  const misses = { ...(a.misses || {}) }
  for (const [id, n] of Object.entries(b.misses || {})) {
    misses[id] = Math.max(Number(misses[id] || 0), Number(n || 0))
  }
  const attempts = [...(a.attempts || [])]
  const seen = new Set(attempts.map(t => `${t.id}:${t.at}:${t.input}`))
  for (const t of b.attempts || []) {
    const k = `${t.id}:${t.at}:${t.input}`
    if (!seen.has(k)) {
      seen.add(k)
      attempts.push(t)
    }
  }
  attempts.sort((x, y) => (x.at || 0) - (y.at || 0))
  const aN = Object.keys(a.solved || {}).length
  const bN = Object.keys(b.solved || {}).length
  const aAt = Number(a.letterAt || 0)
  const bAt = Number(b.letterAt || 0)
  return {
    unlocked: !!(a.unlocked || b.unlocked),
    started: !!(a.started || b.started),
    room: bN >= aN ? (b.room || a.room || 'memory') : (a.room || 'memory'),
    solved,
    misses,
    attempts,
    letter: bAt >= aAt ? (b.letter != null ? b.letter : a.letter) : a.letter,
    letterAt: Math.max(aAt, bAt),
    updatedAt: Math.max(Number(a.updatedAt || 0), Number(b.updatedAt || 0)),
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method === 'GET') {
    res.status(200).json(readStore())
    return
  }
  if (req.method === 'PUT') {
    const incoming = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    if (incoming.reset === true) {
      const cur = readStore()
      const next = {}
      for (const [k, v] of Object.entries(cur)) {
        if (v && (v.letter || v.letterAt)) {
          next[k] = { letter: v.letter || '', letterAt: v.letterAt || 0 }
        }
      }
      writeStore(next)
      res.status(200).json(next)
      return
    }
    const cur = readStore()
    const next = { ...cur }
    for (const [k, v] of Object.entries(incoming)) {
      const merged = mergeProgress(cur[k] || {}, v)
      if (isHollow(merged) && !cur[k]) continue
      next[k] = merged
    }
    writeStore(next)
    res.status(200).json(next)
    return
  }
  res.status(405).end()
}
