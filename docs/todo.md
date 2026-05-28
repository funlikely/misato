# TODO

Living list of things not yet built. Roughly ordered by priority.

## High priority — gives Misato her voice and a real face

### Voice output: VOICEVOX TTS

Currently silent. The plan is to hook into [VOICEVOX](https://voicevox.hiroshiba.jp/) — free, local, anime-style Japanese TTS with dozens of character speakers. It runs as a local HTTP server (`localhost:50021`) just like Ollama.

Steps:
1. User installs VOICEVOX (`winget install Hiroshiba.VOICEVOX` or grab the installer; launch once so the engine binds the port).
2. Add `src/lib/voicevox.ts`: `synthesize(text, speaker)` → POST `/audio_query` → POST `/synthesis` → returns WAV `Blob`.
3. Add a speaker picker in prefs. Surface the catalog from `GET /speakers`.
4. Auto-play her `[ja]` line as soon as the stream finishes (or as each sentence completes for lower latency). Add a "mute" toggle.
5. Cache audio per `(speaker, text)` so re-renders don't re-synthesize.
6. Optional: emotion-aware synthesis — VOICEVOX has style variants per speaker; map our `Mood` enum to styles where available.

Risk: VOICEVOX speakers are licensed per-character — most are free for non-commercial use, some require attribution. Keep this personal-use only or pick speakers with permissive terms.

### Real expression sprites

Right now `Portrait.tsx` shows a colored emoji on a gradient. Need real art.

Steps:
1. Decide art direction (commissioned, AI-generated, public domain).
2. Produce one image per mood: `neutral, happy, teasing, flirty, embarrassed, pouting, excited, sultry`. Transparent PNG, ~512×768.
3. Drop them in `public/portraits/<mood>.png`.
4. Replace the emoji `<div>` in `Portrait.tsx` with `<img src={`/portraits/${mood}.png`} />`. Keep the gradient frame as a backdrop.
5. Add a soft crossfade between mood changes.
6. Optional: blink / breathing idle animation via a sprite-sheet or simple opacity loop.

### Speech input is enabled but unverified in WebView2

The mic button uses the Chromium `webkitSpeechRecognition` API. Chromium proper routes this through Google's cloud STT. **WebView2 may not have that endpoint configured** — meaning the button might fail at runtime even though support detection passes.

Steps:
1. Test in `npm run tauri:dev` once Rust is installed.
2. If it fails: fall back to local STT. Best option is [whisper.cpp](https://github.com/ggerganov/whisper.cpp) wrapped as a small HTTP server, or use Ollama's whisper if/when it ships.
3. Either route the audio capture through `MediaRecorder` → POST to local Whisper, or call out to a Rust-side command that runs whisper.cpp.

## Medium priority — depth and polish

### Furigana for Japanese learners

Help readers parse kanji by showing kana above them in the JP line.

Steps:
1. Add `kuromoji.js` (the de-facto JS tokenizer for Japanese).
2. After streaming completes, tokenize the JP line, attach reading from the tokenizer dictionary, render with `<ruby>` tags.
3. Toggle in prefs (off by default). Bundle is a few MB heavier — load the dictionary lazily.

### Full VN scene system

Currently `buildStateLine` in `Chat.tsx` hardcodes the scene to "喫茶店 (afternoon)". A real VN needs:
- A `Scene` type: `{ location, time, background, mood-color-tint }`.
- A scene catalog: `cafe-afternoon`, `apartment-night`, `park-walk`, `onsen`, etc.
- Let Misato change scenes via `[scene:<id>]` tags or explicit choice payloads (e.g. `[choice][scene:apartment-night] 部屋に行く`).
- Per-scene background image in `public/scenes/<id>.jpg`. Render behind the chat panel with a darken/blur.
- Persist current scene in the session.

### Settings UI / first-run wizard

Currently config (model, host, temperature) is hardcoded in `DEFAULT_CONFIG`. Build a Settings screen:
- Model picker (pulls from `ollama /api/tags` to list locally available models).
- Host override (for users running Ollama on another machine).
- Temperature slider.
- VOICEVOX speaker picker + mute.
- Subtitle font size, EN toggle, furigana toggle.
- Persona-archetype switcher (toggle between genki / onee-san / tsundere / dere variants — only one is implemented today).

### Real long-term memory

`localStorage` keeps the running conversation, but if the user comes back next week the LLM doesn't actually "remember" anything beyond the raw transcript. Improve:
- After N turns or on exit, summarize the session to a `memories.json` file ("user mentioned working late on Tuesdays", "user's name is Kenji", "first kiss happened at chapter 3").
- Inject relevant memories into the system prompt on next session.
- Show a "memories" panel in settings where the user can edit or delete entries.

### Save slots / multiple characters

The persona is hardcoded to Misato. Future-proof by:
- Moving `src/persona/misato.ts` content into a `Character` data structure.
- Add 1–3 alternate characters (different archetypes, different VOICEVOX speakers, different sprite sets).
- Save slot per character. Mode selector becomes character + mode selector.

## Lower priority — nice to have

### Real window icon
Current icon is a plain pink square (generated from `scripts/gen-icon-source.mjs`). Replace `icon-source.png` with actual art and re-run `npx tauri icon icon-source.png`.

### CSP lockdown
`tauri.conf.json` currently sets `csp: null`. Once feature set is stable, set a real CSP that allows only `http://localhost:11434` (Ollama) and `http://localhost:50021` (VOICEVOX).

### Streaming sentence-by-sentence TTS
Latency improvement once TTS is in place: detect sentence boundaries (。！？) during stream and start synthesizing sentence 1 while sentences 2+ are still arriving.

### Multi-platform packaging
Test `tauri build` on macOS and Linux. Set up GitHub Actions to produce signed installers on tag pushes.

### Token budget UI
Show context window usage so user knows when they'll start losing earlier turns to summarization.

### Conversation export
"Export this chat as Markdown" button — useful for keeping diary-style logs of a playthrough.

### NSFW guard rails toggle
The persona enforces "suggestive, not explicit." If the user explicitly opts in (settings checkbox + confirmation), relax that line. Default stays conservative.

### Better Japanese-input UX
Many JP IME inputs commit on space/enter in awkward ways inside the React input. Test thoroughly and consider `compositionstart`/`compositionend` handling so submission only fires after IME composition completes.
