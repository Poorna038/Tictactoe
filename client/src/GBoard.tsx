import React from "react";

export type GameState = {
  board: number[];
  turn: number;
  finished?: boolean;
  winner?: number;
};

type Props = {
  state: GameState;
  meSymbol?: number;
  canPlay: boolean;
  onMove: (index: number) => void;
  onLeave: () => void;
};

export default function GBoard({ state, meSymbol, canPlay, onMove, onLeave }: Props) {
  const renderCell = (i: number) => {
    const v = state.board[i];
    const label = v === 1 ? "X" : v === 2 ? "O" : "";
    const disabled = state.finished || v !== 0 || !canPlay;

    return (
      <div
        key={i}
        className={`cell ${v === 0 ? "empty" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => {
          if (disabled) return;
          onMove(i);
        }}
        role="button"
        aria-label={`cell-${i}`}
      >
        {label}
      </div>
    );
  };

  return (
    <div className="game-shell">
      <div className="board-card">
        <div className="board-top">
          <div className="player-mini">
            {meSymbol === 1 ? "You (X)" : meSymbol === 2 ? "You (O)" : "You"}
          </div>
          <div className="turn-indicator">
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>Turn</div>
            <div className="turn-badge">{state.turn === 1 ? "X" : "O"}</div>
          </div>
          <div className="player-mini">Opponent</div>
        </div>

        <div className="grid" role="grid" aria-label="tic-tac-toe-board">
          {state.board.map((_, i) => renderCell(i))}
        </div>

        <button className="leave-btn" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </div>
  );
}
