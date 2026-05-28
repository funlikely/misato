export type Mood =
  | "neutral"
  | "happy"
  | "teasing"
  | "flirty"
  | "embarrassed"
  | "pouting"
  | "excited"
  | "sultry";

export const MOODS: Mood[] = [
  "neutral",
  "happy",
  "teasing",
  "flirty",
  "embarrassed",
  "pouting",
  "excited",
  "sultry",
];

export const MOOD_EMOJI: Record<Mood, string> = {
  neutral: "🙂",
  happy: "😄",
  teasing: "😏",
  flirty: "😘",
  embarrassed: "☺️",
  pouting: "😤",
  excited: "🤩",
  sultry: "😈",
};

export const MOOD_COLOR: Record<Mood, string> = {
  neutral: "#9aa0b4",
  happy: "#ffd166",
  teasing: "#c77dff",
  flirty: "#ff6fa5",
  embarrassed: "#ff8fa3",
  pouting: "#8aa0ff",
  excited: "#ffae42",
  sultry: "#b5179e",
};

export function parseMood(text: string): { mood: Mood; clean: string } {
  // Look for [mood:happy] anywhere; first match wins.
  const m = text.match(/\[mood:([a-z]+)\]/i);
  if (m && (MOODS as string[]).includes(m[1].toLowerCase())) {
    return {
      mood: m[1].toLowerCase() as Mood,
      clean: text.replace(/\[mood:[a-z]+\]/gi, "").trim(),
    };
  }
  return { mood: "neutral", clean: text };
}

export function parseAffectionDelta(text: string): { delta: number; clean: string } {
  // Look for [affection:+3] or [affection:-2]
  const m = text.match(/\[affection:([+-]?\d+)\]/i);
  if (m) {
    return {
      delta: parseInt(m[1], 10),
      clean: text.replace(/\[affection:[+-]?\d+\]/gi, "").trim(),
    };
  }
  return { delta: 0, clean: text };
}
