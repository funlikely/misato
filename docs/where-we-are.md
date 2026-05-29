# Where we are now

Checkpoint doc for resuming work in a fresh session. **Read this first.**

Last updated: 2026-05-28 (end of session that shipped v1.0.0).

## TL;DR

Misato v1.0.0 shipped. Tauri 2 + React + TS desktop chat with a flirty Japanese persona, local Ollama backend (ELYZA Llama-3-JP 8B), bilingual JP/EN subtitles with a fallback translation pass, Web Speech mic input, and VOICEVOX TTS auto-playback. Everything is on `main`. **Next step on resume: pick something from [`docs/todo.md`](todo.md) — most impactful is probably wiring sprites to the sibling [booru-auto-tagger](https://github.com/funlikely/booru-auto-tagger) repo.**

## Branch state

- `main` — at tag `v1.0.0` (commit `a8ecafa`). Pushed to `funlikely/misato`. **This is the only branch** — feature branches were merged and deleted after the release.
- Working tree is clean modulo CRLF normalization noise on `src-tauri/Cargo.toml`.

## Sibling project

- **[funlikely/booru-auto-tagger](https://github.com/funlikely/booru-auto-tagger)** — Python CLI + Flask + SQLite + WD-tagger ONNX. Auto-tags a local image dir by posture / body type / clothing / undress / mood, exposes a REST API. **Built specifically to feed Misato her sprites and scene images.** Per the README it now has initial implementation in place (tag.py, tagger.py, categorize.py, db.py, server.py, frontend/) — verify locally before integrating.
- Local checkout at `C:\gitprojects\funlikely\booru-auto-tagger`.
- Integration call from Misato: `GET http://localhost:5000/images/random?mood=<mood>&clothing=<...>&rating=safe` — swap her portrait based on `currentMood`.

## What v1.0.0 includes

- Three modes (freeform, affection, VN) with mode picker
- Strict-format persona that emits `[mood]` + `[ja]` + `[en]` + optional `[affection]` + optional `[choice]` tags
- Streaming Ollama client (`src/lib/ollama.ts`)
- Default model: `lucas2024/llama-3-elyza-jp-8b:q5_k_m` (ELYZA's Japanese fine-tune; better JP than Qwen, no Chinese script bleed)
- Bilingual rendering: JP main + dim italic EN subtitle, toggle to hide EN
- **Fallback translation** (`src/lib/translate.ts`) — when the LLM drops the `[en]` line (happens on smaller models as context grows), a one-shot translation call fills it in
- Mic input via `webkitSpeechRecognition` — JP-default, EN switchable, with pulsing red mic-on state
- VOICEVOX TTS — auto-plays the assistant's `[ja]` line on stream end, speaker picker in sidebar, per-bubble replay button, mute toggle, LRU URL cache
- Affection meter (mode 2) with JP relationship labels
- VN choice buttons rendered from `[choice]` lines (mode 3)
- Session + prefs persisted to localStorage (NOT in repo, lives in WebView2 data dir)
- Placeholder emoji portrait driven by mood color/glyph
- Generated app icons from a pink-square source PNG

## What's installed / running on the user's machine

- Rust + MSVC Build Tools
- Ollama with `lucas2024/llama-3-elyza-jp-8b:q5_k_m` pulled
- VOICEVOX (CPU build) — runs on `localhost:50021` while the VOICEVOX app is open
- Node 22 + npm 10

## Key files (so you don't have to grep)

- `src/persona/misato.ts` — system prompt. Strict bilingual output format with explicit "DO NOT drop [en] across long contexts" rule.
- `src/lib/ollama.ts` — streaming HTTP client. `DEFAULT_CONFIG.model` is the ELYZA model.
- `src/lib/translate.ts` — fallback EN translation when persona drops the `[en]` line.
- `src/lib/voicevox.ts` — TTS client. Two-step `/audio_query` + `/synthesis`, LRU blob URL cache, `pingVoicevox` for the engine-online probe.
- `src/lib/speech.ts` — `webkitSpeechRecognition` wrapper.
- `src/lib/moods.ts` — Mood enum, `parseMood`, `parseAffectionDelta`, `parseBilingual`.
- `src/lib/modes.ts` — three modes.
- `src/components/Chat.tsx` — main UI. `parseAssistant` is the unified parser; `playLine` is TTS; the "after stream completes" effect handles both auto-play and the EN fallback.
- `src/components/Portrait.tsx` — currently emoji placeholder; this is where booru-auto-tagger integration goes.
- `src-tauri/tauri.conf.json` — window config, `csp: null` (TODO: lock down once feature-set stable).
- `docs/todo.md` — full roadmap.

## Decisions worth remembering

- **Tone:** suggestive/flirty, fade-to-black at explicit line. Memory: `feedback_content_tone.md`.
- **Persona archetype:** genki/playful (not tsundere/onee-san/dere).
- **Backend:** local Ollama, no cloud. Frontend talks to Ollama directly via webview `fetch`; no Rust HTTP code.
- **Misato always speaks JP**, EN is purely subtitle.
- **TTS speaker default:** id 8 (`春日部つむぎ` style `テンション高め`) — auto-falls-back to first available if user doesn't have that speaker.
- **Model swap:** Started with `qwen2.5:7b`, switched to ELYZA Llama-3-JP after seeing Chinese-character leak. If JP quality regresses on a future swap, fall back to ELYZA.
- **Icons:** pink-square placeholder via `scripts/gen-icon-source.mjs` + `npx tauri icon`. Real art deferred.
- **Privacy:** nothing personal gets committed. Session + prefs in localStorage; user already asked and was reassured.

## Things to remind the user about next session

- Mic in WebView2 hasn't been explicitly tested yet — verify (or refute) before claiming it works. Fallback is whisper.cpp.
- VOICEVOX needs to be running for TTS. If "voice: VOICEVOX not running" shows in the sidebar, the engine is down.
- Booru-auto-tagger now has code — verify, then integrate sprite swapping. This is the single highest-impact next feature.
- Semver: bugfixes → 1.0.x, new features → 1.x.0, breaking → 2.0.0. Cut tags via `git tag -a v1.x.x -m "..." && git push origin v1.x.x`.

## Open questions for next session

- Mic working in WebView2? → governs whether we build the whisper.cpp fallback.
- Does booru-auto-tagger's API actually run locally? → unblocks sprite work.
- Real character art coming, or stay with API-fetched booru images / emoji placeholders?
- Pick a new TODO item to tackle first.

## How to resume

```powershell
cd C:\gitprojects\funlikely\misato
git status
git log --oneline -5
# launch the app:
npm run tauri:dev
```

Read this file, then `docs/todo.md`, then jump back in.
