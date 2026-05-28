export type Mode = "freeform" | "affection" | "vn";

export const MODES: { id: Mode; label: string; description: string }[] = [
  {
    id: "freeform",
    label: "フリートーク / Freeform",
    description: "Just chat with Misato. No meters, no scenes.",
  },
  {
    id: "affection",
    label: "好感度モード / Affection",
    description: "Chat with an affection meter she reacts to.",
  },
  {
    id: "vn",
    label: "ビジュアルノベル / VN",
    description: "Scene-based dating sim with choices and locations.",
  },
];
