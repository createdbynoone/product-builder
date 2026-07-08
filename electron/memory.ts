import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

// ─── Self-learning memory ─────────────────────────────────────────────────────
// Every generation records an event (success / fallback / error + parameters).
// Once enough new events accumulate, Claude analyzes them against the current
// lesson list and distills an updated set of lessons. Those lessons are then
// injected into the prompt-composition system prompts, so the app improves
// with use. Everything here is fail-silent: memory must never break a build.

export type MemoryScope = 'enhance' | 'technical' | 'polish' | 'build' | 'general'

interface MemoryEvent {
  ts: string
  mode: MemoryScope
  kind: 'success' | 'fallback' | 'error'
  detail: string
  params?: Record<string, string>
}

interface Lesson {
  scope: MemoryScope
  text: string
}

interface MemoryStore {
  events: MemoryEvent[]
  lessons: Lesson[]
  analyzedEventCount: number
  lastAnalyzedAt?: string
}

const MAX_EVENTS = 300
const ANALYZE_EVERY = 10
const MAX_LESSONS = 15
const SCOPES: readonly MemoryScope[] = ['enhance', 'technical', 'polish', 'build', 'general']

function memoryPath(): string {
  return join(app.getPath('userData'), 'pb-memory.json')
}

function load(): MemoryStore {
  try {
    const raw = JSON.parse(readFileSync(memoryPath(), 'utf-8')) as Partial<MemoryStore>
    return {
      events: Array.isArray(raw.events) ? raw.events : [],
      lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
      analyzedEventCount: typeof raw.analyzedEventCount === 'number' ? raw.analyzedEventCount : 0,
      lastAnalyzedAt: raw.lastAnalyzedAt,
    }
  } catch {
    return { events: [], lessons: [], analyzedEventCount: 0 }
  }
}

function save(store: MemoryStore) {
  try {
    writeFileSync(memoryPath(), JSON.stringify(store, null, 2), 'utf-8')
  } catch {}
}

export function recordEvent(evt: Omit<MemoryEvent, 'ts'>) {
  try {
    const store = load()
    store.events.push({ ts: new Date().toISOString(), ...evt, detail: evt.detail.slice(0, 400) })
    if (store.events.length > MAX_EVENTS) {
      const dropped = store.events.length - MAX_EVENTS
      store.events = store.events.slice(-MAX_EVENTS)
      store.analyzedEventCount = Math.max(0, store.analyzedEventCount - dropped)
    }
    save(store)
    void maybeAnalyze()
  } catch {}
}

// Formatted block appended to a system prompt; empty string when no lessons apply.
export function lessonsBlock(scope: MemoryScope): string {
  try {
    const lessons = load().lessons.filter((l) => l.scope === scope || l.scope === 'general')
    if (lessons.length === 0) return ''
    return (
      `\n\nLEARNED LESSONS — distilled from this app's own past runs; apply them whenever relevant:\n` +
      lessons.map((l) => `- ${l.text}`).join('\n')
    )
  } catch {
    return ''
  }
}

const ANALYZER_SYSTEM = `You are the self-improvement analyst for Product Builder, a macOS app that generates streetwear product imagery through AI pipelines: Claude composes prompts (polish, enhance) which are rendered by Nano Banana 2 via the POYO API, with a Higgsfield CLI fallback; technical flats use a template prompt.

You receive the app's CURRENT LESSONS and a log of RECENT EVENTS (successes, fallbacks, errors, with parameters like garment notes, views, dual/strict flags). Maintain a small, high-signal lesson list that gets injected into the app's prompt-composition system prompts so future runs improve.

Rules:
- Look for patterns: recurring API errors and their causes, techniques or parameters that correlate with success vs failure, fallback triggers, prompt-composition weaknesses.
- Each lesson is {"scope": "enhance"|"technical"|"polish"|"build"|"general", "text": "..."} — English, imperative, max 200 chars, directly actionable when composing prompts or choosing parameters.
- Keep lessons still supported by the evidence; drop stale or contradicted ones; merge duplicates. Prefer few sharp lessons over many vague ones.
- Max ${MAX_LESSONS} lessons total.
- Never include secrets, API keys, file paths, or user-identifying data.

Output ONLY the JSON array of lesson objects — no prose, no code fences.`

let analyzing = false

async function maybeAnalyze() {
  if (analyzing) return
  if (!process.env.ANTHROPIC_API_KEY) return
  const store = load()
  if (store.events.length - store.analyzedEventCount < ANALYZE_EVERY) return

  analyzing = true
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const recent = store.events.slice(-60)
    const message = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system: ANALYZER_SYSTEM,
      messages: [{
        role: 'user',
        content:
          `CURRENT LESSONS:\n${JSON.stringify(store.lessons, null, 2)}\n\n` +
          `RECENT EVENTS (newest last):\n${JSON.stringify(recent, null, 2)}\n\n` +
          `Return the updated lessons array now.`,
      }],
    })
    // Sonnet 5 runs adaptive thinking by default — thinking blocks precede the text block
    const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    if (!block) return
    const start = block.text.indexOf('[')
    const end = block.text.lastIndexOf(']')
    if (start === -1 || end <= start) return
    const parsed = JSON.parse(block.text.slice(start, end + 1)) as unknown
    if (!Array.isArray(parsed)) return
    const lessons: Lesson[] = parsed
      .filter((l): l is Lesson =>
        typeof l === 'object' && l !== null &&
        SCOPES.includes((l as Lesson).scope) &&
        typeof (l as Lesson).text === 'string' && (l as Lesson).text.trim().length > 0)
      .map((l) => ({ scope: l.scope, text: l.text.trim().slice(0, 300) }))
      .slice(0, MAX_LESSONS)

    // Reload before writing so events recorded during the API call aren't lost
    const fresh = load()
    fresh.lessons = lessons
    fresh.analyzedEventCount = fresh.events.length
    fresh.lastAnalyzedAt = new Date().toISOString()
    save(fresh)
    console.log(`[pb-memory] lessons updated (${lessons.length})`)
  } catch (err) {
    console.warn('[pb-memory] analysis failed:', err instanceof Error ? err.message : err)
  } finally {
    analyzing = false
  }
}
