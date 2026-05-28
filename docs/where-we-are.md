# Where we are now

Checkpoint doc for resuming work in a fresh session. **Read this first.**

Last updated: 2026-05-28.

## TL;DR

Misato is a Tauri 2 + React + TS desktop chatbot — Japanese-speaking flirty dating-sim character backed by local Ollama. Scaffold is built and pushed. User is mid-install of toolchain. **Next step: user runs `npm run tauri:dev` after `ollama pull qwen2.5:7b` finishes, and we see if it actually launches.**

## Branch state

- `main` — pushed to `funlikely/misato`. Contains the initial scaffold (Tauri shell, three modes, persona, Ollama client, portrait, affection meter, choice buttons, generated icons).
- `feat/voice-and-subtitles` — pushed, **not yet merged**. Adds:
  - Bilingual output: persona enforces `[mood]\n[ja] ...\n[en] ...` format; frontend renders JP main + dim italic EN subtitle below; toggle in sidebar.
  - Mic button using `webkitSpeechRecognition` in the composer. JP-default, switchable to EN.
  - `docs/todo.md` listing remaining roadmap.
  - `docs/where-we-are.md` (this file).
- We are currently on `feat/voice-and-subtitles`.

## Sibling project

- **[funlikely/booru-auto-tagger](https://github.com/funlikely/booru-auto-tagger)** — Python CLI + Flask + SQLite + WD-tagger ONNX. Auto-tags a local image dir by posture / body type / clothing / undress / mood, exposes a REST API. **Built specifically to feed Misato her sprites and scene images.** Status: planning-only, no code yet — see its `PLAN.md`.
- Local checkout at `C:\gitprojects\funlikely\booru-auto-tagger`.
- When that repo grows code, Misato should call `GET /images/random?mood=...&clothing=...&rating=safe` to pick scene/character images instead of hand-curating sprite PNGs.
- An earlier orphan branch on misato (`claude/gallant-dijkstra-Zayke`) held that plan; history was preserved into the new repo and the branch was deleted from misato's remote.

## What the user has done / is doing

Done:
- `winget install Rustlang.Rustup`
- `winget install Microsoft.VisualStudio.2022.BuildTools` (with VCTools workload)
- `winget install Ollama.Ollama`

In progress:
- `ollama pull qwen2.5:7b`

Next:
- `npm run tauri:dev` (first run takes 5–10 min — Rust compiles ~400 crates; not hung)

**If `cargo --version` fails first:** `rustup default stable`.

## Immediate things to verify on first launch

1. Window titled みさと opens with mode picker — confirms Tauri shell works.
2. Pick Freeform, say "こんにちは" — confirms Ollama bridge works.
3. Bubble shows JP line big + EN subtitle small underneath — confirms bilingual format and parser.
4. Click mic button, speak — confirms (or refutes) that `webkitSpeechRecognition` works inside WebView2. **This is the big unknown.** If it fails, fallback path = whisper.cpp wrapped in a local HTTP server (tracked in `docs/todo.md`).

## Key files (so you don't have to grep)

- `src/persona/misato.ts` — system prompt. Genki/playful archetype. Strict bilingual output format.
- `src/lib/ollama.ts` — streaming HTTP client. `DEFAULT_CONFIG.model = "qwen2.5:7b"` — change here to swap models.
- `src/lib/moods.ts` — Mood enum, `parseMood`, `parseAffectionDelta`, `parseBilingual`.
- `src/lib/speech.ts` — Web Speech wrapper.
- `src/lib/modes.ts` — three modes.
- `src/components/Chat.tsx` — main UI, streaming loop, persistence, mic toggle. `parseAssistant` is the unified parser.
- `src/components/Portrait.tsx` — currently emoji placeholder. Real sprites tracked in TODO.
- `src-tauri/tauri.conf.json` — window config, `csp: null` (locked down later, tracked in TODO).
- `docs/todo.md` — full roadmap.

## Decisions worth remembering

- **Tone:** suggestive/flirty, fade-to-black at explicit line. User accepted on first build without pushback. Memory: `feedback_content_tone.md`.
- **Persona archetype:** genki/playful (not tsundere/onee-san/dere). Other archetypes are future toggle work in `docs/todo.md`.
- **Backend:** local Ollama, no cloud. Frontend talks to Ollama directly via webview `fetch`; no Rust HTTP code.
- **Misato always speaks JP**, EN is purely subtitle. (Earlier version had her switch to EN when user did — that changed in `feat/voice-and-subtitles`.)
- **Icons:** generated from a plain pink-square placeholder via `scripts/gen-icon-source.mjs` + `npx tauri icon`. Real art deferred.

## Things to remind the user about

- Once tauri:dev launches successfully, **merge `feat/voice-and-subtitles` into `main`** (or leave it as a PR — `gh pr create` link was printed on push).
- Mic might not work in WebView2 — test it explicitly before claiming the feature is done.
- VOICEVOX install is the next big feature (her actual voice). User has not started this yet.

## Open questions for the user (next time)

- Is mic working in WebView2? → governs whether we build the whisper.cpp fallback.
- Ready to install VOICEVOX and pick a speaker? → unlocks the most impactful feature left.
- Any real art (sprites / icon) yet, or stay with placeholders for now?

## How to resume

```powershell
cd C:\gitprojects\funlikely\misato
git status
git log --oneline -5
```

Read this file, then `docs/todo.md`, then jump back in.
