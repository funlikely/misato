import { useCallback, useEffect, useRef, useState } from "react";
import { systemPromptFor } from "../persona/misato";
import type { Mode } from "../lib/modes";
import {
  DEFAULT_CONFIG,
  streamChat,
  type ChatMessage,
  type OllamaConfig,
} from "../lib/ollama";
import {
  parseAffectionDelta,
  parseBilingual,
  parseMood,
  type Mood,
} from "../lib/moods";
import {
  isSpeechSupported,
  startRecognition,
  type Recorder,
} from "../lib/speech";
import {
  DEFAULT_VOICEVOX_HOST,
  listSpeakers,
  pingVoicevox,
  synthesizeCached,
  type VoicevoxSpeaker,
} from "../lib/voicevox";
import { Portrait } from "./Portrait";
import { AffectionMeter } from "./AffectionMeter";

type Turn = {
  role: "user" | "assistant";
  ja: string;
  en?: string;
  mood?: Mood;
  choices?: string[];
};

type Props = {
  mode: Mode;
  onExit: () => void;
};

const STORAGE_KEY = "misato.session";
const PREFS_KEY = "misato.prefs";
const DEFAULT_SPEAKER_ID = 8; // 春日部つむぎ (テンション高め) — fits genki/playful

type Persisted = {
  mode: Mode;
  turns: Turn[];
  affection: number;
};

type Prefs = {
  showEn: boolean;
  micLang: "ja-JP" | "en-US";
  muted: boolean;
  speakerId: number;
  voicevoxHost: string;
};

const DEFAULT_PREFS: Prefs = {
  showEn: true,
  micLang: "ja-JP",
  muted: false,
  speakerId: DEFAULT_SPEAKER_ID,
  voicevoxHost: DEFAULT_VOICEVOX_HOST,
};

function loadSession(mode: Mode): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (p.mode === mode) return p;
    }
  } catch {
    // ignore
  }
  return { mode, turns: [], affection: 10 };
}

function saveSession(p: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_PREFS;
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

function parseChoices(text: string): { choices: string[]; clean: string } {
  const choices: string[] = [];
  const clean = text
    .split("\n")
    .filter((line) => {
      const m = line.match(/^\s*\[choice\]\s*(.+)$/i);
      if (m) {
        choices.push(m[1].trim());
        return false;
      }
      return true;
    })
    .join("\n")
    .trim();
  return { choices, clean };
}

function parseAssistant(raw: string): {
  mood: Mood;
  delta: number;
  ja: string;
  en: string;
  choices: string[];
} {
  const { mood, clean: a1 } = parseMood(raw);
  const { delta, clean: a2 } = parseAffectionDelta(a1);
  const { choices, clean: a3 } = parseChoices(a2);
  const { ja, en } = parseBilingual(a3);
  // Fallback: if persona didn't emit [ja]/[en] tags, treat whole text as JA.
  const finalJa = ja || a3;
  return { mood, delta, ja: finalJa, en, choices };
}

function buildStateLine(mode: Mode, affection: number): string | undefined {
  if (mode === "freeform") return undefined;
  if (mode === "affection") return `affection: ${affection}/100`;
  if (mode === "vn") return `affection: ${affection}/100\nscene: 喫茶店 (afternoon)`;
  return undefined;
}

export function Chat({ mode, onExit }: Props) {
  const initial = loadSession(mode);
  const [turns, setTurns] = useState<Turn[]>(initial.turns);
  const [affection, setAffection] = useState<number>(initial.affection);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [config] = useState<OllamaConfig>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speakers, setSpeakers] = useState<VoicevoxSpeaker[]>([]);
  const [voicevoxOnline, setVoicevoxOnline] = useState<boolean | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const lastPlayedKeyRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechAvailable = isSpeechSupported();

  useEffect(() => {
    saveSession({ mode, turns, affection });
  }, [mode, turns, affection]);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  // Probe VOICEVOX once on mount; load speaker list if available.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await pingVoicevox(prefs.voicevoxHost);
      if (cancelled) return;
      setVoicevoxOnline(ok);
      if (!ok) return;
      try {
        const list = await listSpeakers(prefs.voicevoxHost);
        if (cancelled) return;
        setSpeakers(list);
        // If the saved speaker isn't in the available list, fall back to first.
        const ids = new Set(list.flatMap((s) => s.styles.map((st) => st.id)));
        if (!ids.has(prefs.speakerId) && list[0]) {
          setPrefs((p) => ({ ...p, speakerId: list[0].styles[0].id }));
        }
      } catch {
        // leave speakers empty
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.voicevoxHost]);

  const playLine = useCallback(
    async (text: string, key: string) => {
      if (!text.trim() || prefs.muted || !voicevoxOnline) return;
      ttsAbortRef.current?.abort();
      const ctrl = new AbortController();
      ttsAbortRef.current = ctrl;
      setAudioBusy(true);
      try {
        const url = await synthesizeCached(
          text,
          prefs.speakerId,
          prefs.voicevoxHost,
          ctrl.signal,
        );
        if (ctrl.signal.aborted) return;
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = url;
        lastPlayedKeyRef.current = key;
        await audioRef.current.play().catch(() => {
          // autoplay may be blocked until user interacts; ignored
        });
      } catch (e) {
        if (!ctrl.signal.aborted) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(`tts: ${msg}`);
        }
      } finally {
        if (ttsAbortRef.current === ctrl) ttsAbortRef.current = null;
        setAudioBusy(false);
      }
    },
    [prefs.muted, prefs.speakerId, prefs.voicevoxHost, voicevoxOnline],
  );

  // After a stream completes, auto-play the last assistant line once.
  useEffect(() => {
    if (streaming) return;
    const lastIdx = turns
      .map((t, i) => ({ t, i }))
      .reverse()
      .find(({ t }) => t.role === "assistant")?.i;
    if (lastIdx === undefined) return;
    const last = turns[lastIdx];
    if (!last.ja) return;
    const key = `${lastIdx}|${last.ja}`;
    if (lastPlayedKeyRef.current === key) return;
    void playLine(last.ja, key);
  }, [streaming, turns, playLine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ttsAbortRef.current?.abort();
      audioRef.current?.pause();
    };
  }, []);

  const currentMood: Mood =
    [...turns].reverse().find((t) => t.role === "assistant")?.mood ?? "neutral";

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);
    audioRef.current?.pause();
    const userTurn: Turn = { role: "user", ja: text };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setInput("");
    setStreaming(true);

    const sys: ChatMessage = {
      role: "system",
      content: systemPromptFor(mode, buildStateLine(mode, affection)),
    };
    const history: ChatMessage[] = nextTurns.map((t) => ({
      role: t.role,
      content: t.ja,
    }));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let acc = "";
    try {
      for await (const chunk of streamChat(config, [sys, ...history], ctrl.signal)) {
        acc += chunk;
        const parsed = parseAssistant(acc);
        setTurns((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          const aTurn: Turn = {
            role: "assistant",
            ja: parsed.ja,
            en: parsed.en || undefined,
            mood: parsed.mood,
            choices: parsed.choices.length ? parsed.choices : undefined,
          };
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = aTurn;
          } else {
            copy.push(aTurn);
          }
          return copy;
        });
      }

      const { delta } = parseAssistant(acc);
      if (delta !== 0 && (mode === "affection" || mode === "vn")) {
        setAffection((a) => Math.max(0, Math.min(100, a + delta)));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    ttsAbortRef.current?.abort();
    audioRef.current?.pause();
    setTurns([]);
    setAffection(10);
    lastPlayedKeyRef.current = "";
    localStorage.removeItem(STORAGE_KEY);
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    setInterim("");
    setError(null);
    const r = startRecognition(prefs.micLang, {
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setInput((cur) => (cur ? cur + " " + t : t));
        setInterim("");
      },
      onError: (e) => {
        setError(`mic: ${e}`);
        setInterim("");
        setListening(false);
      },
      onEnd: () => {
        setListening(false);
        setInterim("");
        recRef.current = null;
      },
    });
    if (r) {
      recRef.current = r;
      setListening(true);
    }
  }

  function replay(idx: number, text: string) {
    void playLine(text, `replay-${idx}-${Date.now()}`);
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");
  const composerValue =
    listening && interim ? input + (input ? " " : "") + interim : input;

  return (
    <div className="chat-screen">
      <div className="side">
        <Portrait mood={currentMood} speaking={streaming || audioBusy} />
        {(mode === "affection" || mode === "vn") && (
          <AffectionMeter value={affection} />
        )}
        <div className="prefs">
          <label className="pref-row">
            <input
              type="checkbox"
              checked={prefs.showEn}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, showEn: e.target.checked }))
              }
            />
            <span>Show English subtitles</span>
          </label>
          <label className="pref-row">
            <input
              type="checkbox"
              checked={!prefs.muted}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, muted: !e.target.checked }))
              }
              disabled={!voicevoxOnline}
            />
            <span>Voice (VOICEVOX)</span>
          </label>
          {voicevoxOnline && speakers.length > 0 && (
            <label className="pref-row">
              <span>Speaker</span>
              <select
                value={prefs.speakerId}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, speakerId: Number(e.target.value) }))
                }
              >
                {speakers.map((sp) =>
                  sp.styles.map((st) => (
                    <option key={st.id} value={st.id}>
                      {sp.name} ({st.name})
                    </option>
                  )),
                )}
              </select>
            </label>
          )}
          {speechAvailable && (
            <label className="pref-row">
              <span>Mic language</span>
              <select
                value={prefs.micLang}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    micLang: e.target.value as Prefs["micLang"],
                  }))
                }
              >
                <option value="ja-JP">日本語</option>
                <option value="en-US">English</option>
              </select>
            </label>
          )}
        </div>
        <div className="side-buttons">
          <button onClick={onExit}>← Modes</button>
          <button onClick={reset}>Reset</button>
        </div>
        <div className="model-info">
          model: {config.model}
          {voicevoxOnline === false && <div>voice: VOICEVOX not running</div>}
          {!speechAvailable && <div>mic: not available in this webview</div>}
        </div>
      </div>
      <div className="chat">
        <div className="transcript" ref={scrollRef}>
          {turns.length === 0 && (
            <div className="placeholder">
              話しかけてみて。日本語でも英語でもいいよ。
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`bubble ${t.role}`}>
              {t.role === "assistant" && t.mood && (
                <span className="bubble-mood">[{t.mood}]</span>
              )}
              <div className="bubble-ja">{t.ja || "…"}</div>
              {t.role === "assistant" && t.en && prefs.showEn && (
                <div className="bubble-en">{t.en}</div>
              )}
              {t.role === "assistant" && t.ja && voicevoxOnline && (
                <button
                  type="button"
                  className="bubble-replay"
                  onClick={() => replay(i, t.ja)}
                  disabled={audioBusy}
                  title="Replay voice"
                  aria-label="Replay voice"
                >
                  {audioBusy && lastPlayedKeyRef.current.startsWith(`${i}|`)
                    ? "…"
                    : "🔊"}
                </button>
              )}
            </div>
          ))}
          {error && <div className="error">⚠ {error}</div>}
        </div>
        {lastAssistant?.choices && !streaming && (
          <div className="choices">
            {lastAssistant.choices.map((c, i) => (
              <button key={i} className="choice" onClick={() => send(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          {speechAvailable && (
            <button
              type="button"
              className={`mic ${listening ? "mic-on" : ""}`}
              onClick={toggleMic}
              disabled={streaming}
              title={listening ? "Stop listening" : "Speak"}
              aria-label="Toggle microphone"
            >
              {listening ? "● rec" : "🎙"}
            </button>
          )}
          <input
            type="text"
            value={composerValue}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              streaming
                ? "..."
                : listening
                  ? "聞いてるよ… / listening…"
                  : "メッセージを入力 / type a message"
            }
            disabled={streaming}
            autoFocus
          />
          <button type="submit" disabled={streaming || !input.trim()}>
            送信
          </button>
          {streaming && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="cancel"
            >
              停止
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
