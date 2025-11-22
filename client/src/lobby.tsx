import React, { useEffect, useState } from "react";
import { makeClient, authDevice, makeSocket } from "./Client";

type Props = {
  onJoinedMatch: (
    matchId: string,
    symbol: number,
    socket: any,
    matchState?: any
  ) => void;
};

type Flow = "none" | "quick" | "create" | "join";

export default function Lobby({ onJoinedMatch }: Props) {
  const [client] = useState(() => makeClient());
  const [socket, setSocket] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [status, setStatus] = useState("idle");

  const [flow, setFlow] = useState<Flow>("none");
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [pendingState, setPendingState] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const devId = "device-" + Math.random().toString(36).slice(2, 9);
      const s = await authDevice(client, devId);
      setSession(s);

      const sock = makeSocket(client);
      await sock.connect(s, true);
      setSocket(sock);
      setStatus("ready");

      try {
        const params = new URLSearchParams(window.location.search);
        const roomFromUrl = params.get("room");
        if (roomFromUrl) setJoinCode(roomFromUrl);
      } catch {}
    })();
  }, [client]);

  useEffect(() => {
    if (!socket) return;

    socket.onmatchdata = (matchId: string, data: any) => {
      const decoded = new TextDecoder().decode(data);

      try {
        const parsed = JSON.parse(decoded);
        if (parsed.op === "state" || parsed.op === "waiting") {
          if (flow === "quick") {
            onJoinedMatch(matchId, 0, socket, parsed.state);
          } else {
            setPendingMatchId(matchId);
            setPendingState(parsed.state);
          }
        }
      } catch {}
    };

    socket.onmatchpresence = (matchId: string, joins: any, leaves: any) => {
      console.log("presence", { matchId, joins, leaves });
    };
  }, [socket, flow, onJoinedMatch]);

  async function quickMatch() {
    if (!socket || !session) return alert("Socket not ready");
    setStatus("searching (quick match)");
    setFlow("quick");

    try {
      await socket.sendMatchmakerAdd(2, 2, "*", {});
      setStatus("waiting for opponent...");

      socket.onmatchmakermatched = (matched: any) => {
        const matchId = matched.match_id;
        setCreatedMatchId(null);
        setPendingMatchId(null);
        setPendingState(null);
        socket.joinMatch(matchId, {});
      };
    } catch {
      setStatus("error");
      setFlow("none");
    }
  }

  async function createRoom() {
    if (!socket || !session) return alert("Socket not ready");
    setStatus("creating room...");
    setFlow("create");

    try {
      const match = await socket.createMatch();
      const matchId = match.match_id as string;
      setCreatedMatchId(matchId);
      setPendingMatchId(null);
      setPendingState(null);
      setStatus("room created — waiting for friends...");
      await socket.joinMatch(matchId, {});
    } catch {
      setStatus("error creating room");
      setFlow("none");
    }
  }

  async function joinRoom() {
    if (!socket || !session) return alert("Socket not ready");
    if (!joinCode.trim()) {
      setJoinError("Please enter a room code");
      return;
    }

    setJoinError(null);
    setStatus("joining room...");
    setFlow("join");

    try {
      await socket.joinMatch(joinCode.trim(), {});
      setStatus("joined room — waiting for host...");
    } catch {
      setJoinError("Invalid room code or room full");
      setStatus("ready");
      setFlow("none");
    }
  }

  function continueIntoGame() {
    if (!pendingMatchId || !socket || !pendingState) return;
    onJoinedMatch(pendingMatchId, 0, socket, pendingState);
  }

  if (flow === "create" && createdMatchId) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const shareLink = `${origin}/?room=${createdMatchId}`;

    return (
      <div style={{ padding: 12 }}>
        <h2>Room Created</h2>
        <p>Status: {status}</p>

        <p>Share this room with your friends:</p>

        <p>
          <strong>Room Code:</strong>
        </p>
        <p style={{ fontSize: 22, fontWeight: 600 }}>{createdMatchId}</p>

        <p>
          <strong>Shareable Link:</strong>
        </p>
        <p
          style={{
            fontSize: 12,
            border: "1px solid #bbb",
            padding: 6,
            borderRadius: 4,
            wordBreak: "break-all",
          }}
        >
          {shareLink}
        </p>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => alert("Ask friends to join using the code or link.")}
            style={{ marginRight: 8 }}
          >
            Add Players
          </button>
          <button
            onClick={continueIntoGame}
            disabled={!pendingMatchId || !pendingState}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (flow === "join") {
    return (
      <div style={{ padding: 12 }}>
        <h2>Joined Room</h2>
        <p>Status: {status}</p>
        <p>Room Code: {joinCode}</p>
        <p>Wait for the host to be ready, then press Continue.</p>

        <button
          onClick={continueIntoGame}
          disabled={!pendingMatchId || !pendingState}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <h2>Lobby</h2>
      <p>Status: {status}</p>

      <button onClick={quickMatch} disabled={status !== "ready"}>
        Quick Match (1v1)
      </button>

      <p style={{ fontSize: 12 }}>
        Open the app in two windows and press Quick Match in both to get
        paired.
      </p>

      <hr />

      <h3>Play with Friends</h3>

      <button
        onClick={createRoom}
        disabled={!socket || status.startsWith("creating")}
      >
        Create Room
      </button>

      <div style={{ marginTop: 16 }}>
        <div>Join Room by Code:</div>
        <input
          type="text"
          placeholder="Enter room code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={joinRoom} disabled={!socket}>
          Join Room
        </button>

        {joinError && (
          <div style={{ color: "red", marginTop: 4, fontSize: 12 }}>
            {joinError}
          </div>
        )}
      </div>
    </div>
  );
}
