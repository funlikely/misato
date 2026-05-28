// Fallback English translation pass — used when the persona drops the [en]
// subtitle (happens on smaller models as context grows). Calls Ollama with a
// tight one-shot prompt and returns a single English line.

import type { Mood } from "./moods";
import { DEFAULT_CONFIG, type OllamaConfig } from "./ollama";

const SYS = `You are a translator producing English subtitles for a Japanese dating-sim character named Misato. She is a confident, playful, openly flirtatious woman. Given her Japanese line below, produce a natural, idiomatic English subtitle that preserves her tone — flirty, teasing, sultry, embarrassed, etc. as appropriate.

Rules:
- Output ONLY the English translation. No preamble. No quotes. No commentary. No labels.
- Match her tone, not a stiff dictionary translation.
- Keep it the same length as the Japanese (1–4 sentences).
- If the line is empty or untranslatable, output a single hyphen "-".`;

export async function translateToEnglish(
  ja: string,
  mood: Mood | undefined,
  cfg: OllamaConfig = DEFAULT_CONFIG,
  signal?: AbortSignal,
): Promise<string> {
  if (!ja.trim()) return "";
  const moodHint = mood ? ` (her mood right now: ${mood})` : "";
  const res = await fetch(`${cfg.host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      stream: false,
      options: { temperature: 0.3 },
      messages: [
        { role: "system", content: SYS + moodHint },
        { role: "user", content: ja },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  const out = (data.message?.content ?? "").trim();
  // Strip wrapping quotes the model sometimes adds despite the prompt.
  return out.replace(/^["「『]+|["」』]+$/g, "").trim();
}
