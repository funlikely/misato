export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaConfig = {
  host: string;
  model: string;
  temperature?: number;
};

export const DEFAULT_CONFIG: OllamaConfig = {
  host: "http://localhost:11434",
  model: "qwen2.5:7b",
  temperature: 0.85,
};

export async function* streamChat(
  cfg: OllamaConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${cfg.host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: true,
      options: {
        temperature: cfg.temperature ?? 0.85,
      },
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) yield obj.message.content as string;
        if (obj.done) return;
      } catch {
        // ignore malformed line
      }
    }
  }
}

export async function listModels(host: string): Promise<string[]> {
  try {
    const res = await fetch(`${host}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}
