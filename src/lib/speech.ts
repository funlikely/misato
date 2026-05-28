// Thin wrapper around the Web Speech API (webkitSpeechRecognition).
// Available in Chromium-based webviews including WebView2 on Windows.

type SpeechLang = "ja-JP" | "en-US";

type Handlers = {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (e: string) => void;
  onEnd?: () => void;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
  length: number;
  [i: number]: {
    isFinal: boolean;
    length: number;
    [i: number]: { transcript: string };
  };
};

type SpeechRecognitionErrorEvent = { error: string };

function getCtor(): { new (): SpeechRecognitionLike } | null {
  const w = window as unknown as {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export type Recorder = {
  stop: () => void;
};

export function startRecognition(lang: SpeechLang, handlers: Handlers): Recorder | null {
  const Ctor = getCtor();
  if (!Ctor) {
    handlers.onError?.("speech-not-supported");
    return null;
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;

  let finalText = "";
  rec.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const result = ev.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (interim) handlers.onInterim?.(interim);
  };
  rec.onerror = (ev) => handlers.onError?.(ev.error);
  rec.onend = () => {
    if (finalText.trim()) handlers.onFinal(finalText.trim());
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : String(e));
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    },
  };
}
