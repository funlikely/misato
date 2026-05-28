import { useState } from "react";
import { ModePicker } from "./components/ModePicker";
import { Chat } from "./components/Chat";
import type { Mode } from "./lib/modes";

export default function App() {
  const [mode, setMode] = useState<Mode | null>(null);

  if (!mode) return <ModePicker onPick={setMode} />;
  return <Chat mode={mode} onExit={() => setMode(null)} />;
}
