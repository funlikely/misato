import { useEffect, useRef, useState } from "react";
import { systemPromptFor } from "../persona/misato";
import type { Mode } from "../lib/modes";
import {
  DEFAULT_CONFIG,
  streamChat,
  type ChatMessage,
  type OllamaConfig,
} from "../lib/ollama";
import { parseAffectionDelta, parseMood, type Mood } from "../lib/moods";
import { Portrait } from "./Portrait";
import { AffectionMeter } from "./AffectionMeter";

type Turn = {
  role: "user" | "assistant";
  content: string;
  mood?: Mood;
  choices?: string[];
};

type Props = {
  mode: Mode;
  onExit: () => void;
};

const STORAGE_KEY = "misato.session";

type Persisted = {
  mode: Mode;
  turns: Turn[];
  affection: number;
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
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveSession({ mode, turns, affection });
  }, [mode, turns, affection]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  const currentMood: Mood =
    [...turns].reverse().find((t) => t.role === "assistant")?.mood ?? "neutral";

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);
    const userTurn: Turn = { role: "user", content: text };
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
      content: t.content,
    }));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let acc = "";
    try {
      for await (const chunk of streamChat(config, [sys, ...history], ctrl.signal)) {
        acc += chunk;
        const { mood, clean: afterMood } = parseMood(acc);
        const { clean: afterAffection } = parseAffectionDelta(afterMood);
        const { choices, clean } = parseChoices(afterAffection);
        setTurns((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          const aTurn: Turn = {
            role: "assistant",
            content: clean,
            mood,
            choices: choices.length ? choices : undefined,
          };
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = aTurn;
          } else {
            copy.push(aTurn);
          }
          return copy;
        });
      }

      // Final pass: apply affection delta from full accumulated text.
      const { delta } = parseAffectionDelta(acc);
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
    setTurns([]);
    setAffection(10);
    localStorage.removeItem(STORAGE_KEY);
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");

  return (
    <div className="chat-screen">
      <div className="side">
        <Portrait mood={currentMood} speaking={streaming} />
        {(mode === "affection" || mode === "vn") && (
          <AffectionMeter value={affection} />
        )}
        <div className="side-buttons">
          <button onClick={onExit}>← Modes</button>
          <button onClick={reset}>Reset</button>
        </div>
        <div className="model-info">
          model: {config.model}
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
              <div className="bubble-text">{t.content || "…"}</div>
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
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={streaming ? "..." : "メッセージを入力 / type a message"}
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
