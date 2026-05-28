import { MODES, type Mode } from "../lib/modes";

type Props = {
  onPick: (m: Mode) => void;
};

export function ModePicker({ onPick }: Props) {
  return (
    <div className="mode-picker">
      <h1 className="title">
        みさと <span className="title-sub">— pick a mode</span>
      </h1>
      <div className="mode-grid">
        {MODES.map((m) => (
          <button key={m.id} className="mode-card" onClick={() => onPick(m.id)}>
            <div className="mode-card-title">{m.label}</div>
            <div className="mode-card-desc">{m.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
