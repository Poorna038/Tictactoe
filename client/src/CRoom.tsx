import React from "react";

type CRoomProps = {
  joinCode: string;
  joinError: string | null;
  onChangeJoinCode: (code: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
};

export default function CRoom({
  joinCode,
  joinError,
  onChangeJoinCode,
  onCreateRoom,
  onJoinRoom,
}: CRoomProps) {
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Play with a friend</h3>

      <button
        className="btn btn-secondary"
        style={{ marginBottom: 12 }}
        onClick={onCreateRoom}
      >
        Create Room
      </button>

      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="Enter room code"
          value={joinCode}
          onChange={(e) => onChangeJoinCode(e.target.value)}
          className="input"
          style={{ marginRight: 8 }}
        />
        <button className="btn btn-primary" onClick={onJoinRoom}>
          Join Room
        </button>
      </div>

      {joinError && (
        <div style={{ color: "red", marginTop: 8, fontSize: 12 }}>
          {joinError}
        </div>
      )}
    </div>
  );
}
