import type { Mood } from "../lib/moods";
import { MOOD_COLOR, MOOD_EMOJI } from "../lib/moods";

type Props = {
  mood: Mood;
  speaking?: boolean;
};

export function Portrait({ mood, speaking }: Props) {
  const color = MOOD_COLOR[mood];
  return (
    <div className={`portrait ${speaking ? "speaking" : ""}`}>
      <div
        className="portrait-frame"
        style={{
          background: `radial-gradient(circle at 50% 35%, ${color}55 0%, ${color}22 40%, #0e0f1a 80%)`,
          borderColor: color,
        }}
      >
        <div className="portrait-emoji" aria-hidden>
          {MOOD_EMOJI[mood]}
        </div>
        <div className="portrait-name">みさと</div>
        <div className="portrait-mood">{mood}</div>
      </div>
    </div>
  );
}
