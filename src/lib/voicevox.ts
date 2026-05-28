// VOICEVOX HTTP client — talks to the local engine at http://localhost:50021.
// Synthesis is a two-step process:
//   1) POST /audio_query?text=...&speaker=<id>  → returns query JSON
//   2) POST /synthesis?speaker=<id> with that query body → returns WAV bytes

export type VoicevoxStyle = { name: string; id: number };
export type VoicevoxSpeaker = {
  name: string;
  speaker_uuid: string;
  styles: VoicevoxStyle[];
};

export const DEFAULT_VOICEVOX_HOST = "http://localhost:50021";

export async function listSpeakers(host = DEFAULT_VOICEVOX_HOST): Promise<VoicevoxSpeaker[]> {
  const res = await fetch(`${host}/speakers`);
  if (!res.ok) throw new Error(`voicevox /speakers ${res.status}`);
  return (await res.json()) as VoicevoxSpeaker[];
}

export async function synthesize(
  text: string,
  speakerId: number,
  host = DEFAULT_VOICEVOX_HOST,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!text.trim()) throw new Error("empty text");

  const q = await fetch(
    `${host}/audio_query?speaker=${speakerId}&text=${encodeURIComponent(text)}`,
    { method: "POST", signal },
  );
  if (!q.ok) throw new Error(`voicevox /audio_query ${q.status}`);
  const query = await q.json();

  const s = await fetch(`${host}/synthesis?speaker=${speakerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/wav" },
    body: JSON.stringify(query),
    signal,
  });
  if (!s.ok) throw new Error(`voicevox /synthesis ${s.status}`);
  return await s.blob();
}

// Small LRU-ish cache so re-rendering the same line doesn't re-synthesize.
class AudioCache {
  private map = new Map<string, string>();
  private limit = 40;
  get(key: string): string | undefined {
    const v = this.map.get(key);
    if (v) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, url: string) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, url);
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      const u = this.map.get(oldest);
      this.map.delete(oldest);
      if (u) URL.revokeObjectURL(u);
    }
  }
}
const cache = new AudioCache();

export async function synthesizeCached(
  text: string,
  speakerId: number,
  host = DEFAULT_VOICEVOX_HOST,
  signal?: AbortSignal,
): Promise<string> {
  const key = `${host}|${speakerId}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const blob = await synthesize(text, speakerId, host, signal);
  const url = URL.createObjectURL(blob);
  cache.set(key, url);
  return url;
}

export async function pingVoicevox(host = DEFAULT_VOICEVOX_HOST): Promise<boolean> {
  try {
    const res = await fetch(`${host}/version`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
