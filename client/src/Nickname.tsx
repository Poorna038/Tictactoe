import React, { useEffect, useState } from "react";

type Props = {
  onContinue: (nick: string) => void;
  onCancel?: () => void;
};

export default function Nickname({ onContinue, onCancel }: Props) {
  const STORAGE_KEY = "tic_nickname_v1";
  const [value, setValue] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setValue(saved);
  }, []);

  function handleContinue() {
    const name = value.trim() || "Guest";
    localStorage.setItem(STORAGE_KEY, name);
    onContinue(name);
  }

  return (
    <div className="card" style={{ minWidth: 320 }}>
      <div className="nickname-title" style={{ fontSize: 14, marginBottom: 10 }}>
        Enter a nickname
      </div>

      <input
        className="nickname-input"
        value={value}
        placeholder="New name"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleContinue();
        }}
        autoFocus
      />

      <div
        className="nickname-actions"
        style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}
      >
        <button className="btn btn-ghost" onClick={() => onCancel && onCancel()}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
