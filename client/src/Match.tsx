import React from "react";

type Props = {
  eta: number;
  onCancel: () => void;
};

export default function Match({ eta, onCancel }: Props) {
  return (
    <div className="card matching">
      <h3 style={{ margin: 0 }}>Finding a player...</h3>
      <p className="text-muted" style={{ margin: 0 }}>
        Searching for an opponent (≈{eta}s).
      </p>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
