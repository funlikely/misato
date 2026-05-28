type Props = {
  value: number;
  max?: number;
};

export function AffectionMeter({ value, max = 100 }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const label =
    value < 10
      ? "知らない人"
      : value < 25
        ? "ちょっと興味あり"
        : value < 50
          ? "気になってる"
          : value < 75
            ? "好きかも"
            : value < 90
              ? "夢中"
              : "ベタ惚れ";
  return (
    <div className="affection">
      <div className="affection-label">
        <span>好感度</span>
        <span className="affection-value">{value}</span>
      </div>
      <div className="affection-bar">
        <div className="affection-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="affection-state">{label}</div>
    </div>
  );
}
