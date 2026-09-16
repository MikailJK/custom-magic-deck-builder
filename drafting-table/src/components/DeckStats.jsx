import { useMemo, useState, useEffect } from "react";
import ManaCurveChart from "./ManaCurveChart";
import { deckStats } from "../lib/deck";
import { MANA_COLORS } from "../constants";

export default function DeckStats({ entries, targetSize, onTargetChange }) {
  const stats = useMemo(() => deckStats(entries), [entries]);
  const pct = targetSize > 0 ? Math.min(100, (stats.total / targetSize) * 100) : 0;
  const colorTotal = Object.values(stats.colorCounts).reduce((a, n) => a + n, 0) + stats.colorless;

  // Held locally so typing a new target does not write to the database on every keystroke.
  const [targetDraft, setTargetDraft] = useState(String(targetSize));
  useEffect(() => setTargetDraft(String(targetSize)), [targetSize]);

  const commitTarget = () => {
    const next = Math.max(1, Math.min(999, parseInt(targetDraft, 10) || 1));
    setTargetDraft(String(next));
    if (next !== targetSize) onTargetChange(next);
  };

  return (
    <div className="dt-stats">
      <div className="dt-panel dt-stat-panel">
        <div className="dt-stat-head">
          <p className="dt-brand dt-stat-title">Deck size</p>
          <span className="dt-stat-headline">
            {stats.total}
            <span className="dt-stat-headline-dim"> / </span>
            <input
              className="dt-target-input" type="text" inputMode="numeric" value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={commitTarget}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              title="Target deck size"
            />
          </span>
        </div>
        <div className="dt-progress">
          <div className="dt-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="dt-stat-note">
          {stats.total === targetSize
            ? "At target."
            : stats.total < targetSize
              ? `${targetSize - stats.total} to go`
              : `${stats.total - targetSize} over`}
          {stats.nonLandCount > 0 && ` · avg cost ${stats.avgCost.toFixed(2)}`}
        </p>
      </div>

      <div className="dt-panel dt-stat-panel">
        <p className="dt-brand dt-stat-title">Mana curve</p>
        <ManaCurveChart data={stats.curve} />
        <p className="dt-stat-note">Non-land cards only.</p>
      </div>

      <div className="dt-panel dt-stat-panel">
        <p className="dt-brand dt-stat-title">Colors</p>
        <div className="dt-bar-list">
          {MANA_COLORS.map((c) => (
            <div key={c.key} className="dt-bar-row">
              <span className="dt-pip" style={{ background: c.hex, width: 18, height: 18, fontSize: 9 }}>{c.key}</span>
              <div className="dt-bar-track">
                <div
                  className="dt-bar-fill"
                  style={{ width: `${colorTotal ? (stats.colorCounts[c.key] / colorTotal) * 100 : 0}%`, background: c.hex }}
                />
              </div>
              <span className="dt-bar-value">{stats.colorCounts[c.key]}</span>
            </div>
          ))}
          <div className="dt-bar-row">
            <span className="dt-pip" style={{ background: "var(--text-dim)", width: 18, height: 18, fontSize: 9 }}>C</span>
            <div className="dt-bar-track">
              <div
                className="dt-bar-fill"
                style={{ width: `${colorTotal ? (stats.colorless / colorTotal) * 100 : 0}%`, background: "var(--text-dim)" }}
              />
            </div>
            <span className="dt-bar-value">{stats.colorless}</span>
          </div>
        </div>
      </div>

      <div className="dt-panel dt-stat-panel">
        <p className="dt-brand dt-stat-title">Types</p>
        {stats.types.length === 0 ? (
          <p className="dt-stat-note">No cards yet.</p>
        ) : (
          <div className="dt-bar-list">
            {stats.types.map(({ type, count }) => (
              <div key={type} className="dt-bar-row">
                <span className="dt-type-label">{type}</span>
                <div className="dt-bar-track">
                  <div
                    className="dt-bar-fill"
                    style={{ width: `${stats.total ? (count / stats.total) * 100 : 0}%`, background: "var(--accent)" }}
                  />
                </div>
                <span className="dt-bar-value">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
