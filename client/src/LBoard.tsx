// src/components/Leaderboard.tsx
import React from "react";

export type LeaderboardItem = { name: string; wl: string; time: string; score: number };

export type LeaderboardProps = {
  items?: LeaderboardItem[];
};

export default function LBoard({ items = [] }: LeaderboardProps) {
  return (
    <div className="leaderboard">
      <div className="lb-title">Leaderboard</div>
      {items.map((it, idx) => (
        <div key={idx} className="lb-row" style={{ background: idx === 0 ? "linear-gradient(90deg,#0ea391,#12b0a0)" : "transparent" }}>
          <div>
            <div className="name">{idx + 1}. {it.name}</div>
            <div className="meta">{it.wl} • {it.time}</div>
          </div>
          <div style={{ fontWeight: 800 }}>{it.score}</div>
        </div>
      ))}
    </div>
  );
}
