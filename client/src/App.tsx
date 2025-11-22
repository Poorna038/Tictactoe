import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./index.css";

import Nickname from "./Nickname";
import Match from "./Match";
import GBoard, { GameState } from "./GBoard";
import Result from "./Result";

const SAMPLE_INITIAL_STATE: GameState = {
  board: Array(9).fill(0),
  turn: 1,
  finished: false,
  winner: 0,
};

type ConnectMode = "quick" | "create" | "join";

function AppInner() {
  const [nick, setNick] = useState<string | null>(null);
  const [view, setView] =
    useState<"nick" | "lobby" | "searching" | "playing" | "result">("lobby");
  const [gameState, setGameState] = useState<GameState>(SAMPLE_INITIAL_STATE);
  const [mySymbol, setMySymbol] = useState<number | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [pendingQuick, setPendingQuick] = useState<boolean>(false);
  const [timer, setTimer] = useState(30);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const [connectMode, setConnectMode] = useState<ConnectMode | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomReady, setRoomReady] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  function cleanupSocket() {
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, []);

  function connectToServer(mode: ConnectMode, currentNick: string, roomCodeOptional?: string) {
    cleanupSocket();

    const activeMode: ConnectMode = mode;

    setConnectMode(mode);
    setRoomReady(false);

    if (activeMode === "create") {
      setRoomCode(null);
    } else if (activeMode === "join") {
      setRoomCode(roomCodeOptional ?? null);
    }

    const ws = new WebSocket("wss://tictactoe-bvax.onrender.com/ws");

    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: activeMode,
          nickname: currentNick || "Guest",
          roomCode: roomCodeOptional || null,
        })
      );
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "waiting") {
        if (activeMode === "create" && msg.roomCode) {
          setRoomCode(msg.roomCode);
          setView("lobby");
        } else {
          setView("searching");
        }
      } else if (msg.type === "match_start") {
        const s = msg.state;

        setMatchId(s.matchId ?? null);
        setGameState({
          board: s.board,
          turn: s.turn,
          finished: s.finished,
          winner: s.winner ?? 0,
        });
        setMySymbol(msg.youAre);
        setOpponentName(msg.opponentName || "Opponent");
        setWinner(null);
        setTimer(30);

        if (activeMode === "quick") {
          setView("playing");
          navigate("/room");
        } else {
          setRoomReady(true);
          setView("lobby");
        }
      } else if (msg.type === "state_update") {
        const s = msg.state;

        setGameState({
          board: s.board,
          turn: s.turn,
          finished: s.finished,
          winner: s.winner ?? 0,
        });

        if (s.finished) {
          setWinner(s.winner ?? null);
          setView("result");
          navigate("/room");
        } else {
          setTimer(30);
        }
      } else if (msg.type === "join_error") {
        setJoinError(msg.message || "Unable to join room");
        setView("lobby");
        setConnectMode(null);
        setRoomCode(null);
        setRoomReady(false);
        cleanupSocket();
      } else if (msg.type === "opponent_left") {
        setGameState((prev) => ({ ...prev, finished: true }));
        setWinner(mySymbol ?? null);
        setView("result");
        navigate("/room");
      }
    };

    ws.onclose = () => {
      socketRef.current = null;
      if (view === "playing" || view === "searching") {
        setView("lobby");
        setMatchId(null);
        setConnectMode(null);
        setRoomCode(null);
        setRoomReady(false);
        navigate("/");
      }
    };
  }

  useEffect(() => {
    if (view !== "playing" || gameState.finished) return;

    if (timer <= 0) {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "timeout" }));
      }
      return;
    }

    const id = setTimeout(() => {
      setTimer((t) => t - 1);
    }, 1000);

    return () => clearTimeout(id);
  }, [timer, view, gameState.finished]);

  function handleContinue(nickname: string) {
    const finalNick = nickname || "Guest";
    setNick(finalNick);
    if (pendingQuick) {
      setPendingQuick(false);
      setView("searching");
      connectToServer("quick", finalNick);
    } else {
      setView("lobby");
    }
  }

  function startQuickMatch() {
    if (nick) {
      setJoinError(null);
      setView("searching");
      connectToServer("quick", nick);
    } else {
      setPendingQuick(true);
      setView("nick");
    }
  }

  function handleCreateRoom() {
    const currentNick = nick || "Guest";
    setJoinError(null);
    setView("lobby");
    connectToServer("create", currentNick);
  }

  function handleJoinRoom() {
    const currentNick = nick || "Guest";
    if (!joinCode.trim()) {
      setJoinError("Please enter a room code");
      return;
    }
    setJoinError(null);
    setView("lobby");
    connectToServer("join", currentNick, joinCode.trim());
  }

  function cancelMatch() {
    setPendingQuick(false);
    cleanupSocket();
    setMatchId(null);
    setConnectMode(null);
    setRoomCode(null);
    setRoomReady(false);
    setView("lobby");
  }

  const oppSymbol = mySymbol === 1 ? 2 : 1;
  const isMyTurn =
    view === "playing" &&
    !gameState.finished &&
    mySymbol !== null &&
    gameState.turn === mySymbol;
  const isOppTurn =
    view === "playing" &&
    !gameState.finished &&
    mySymbol !== null &&
    gameState.turn === oppSymbol;

  function handleMove(index: number) {
    if (view !== "playing") return;

    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (gameState.finished) return;

    ws.send(JSON.stringify({ type: "move", index }));
  }

  function leaveRoom() {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "leave" }));
    }
    cleanupSocket();
    setMatchId(null);
    setGameState(SAMPLE_INITIAL_STATE);
    setWinner(null);
    setOpponentName(null);
    setTimer(30);
    setMySymbol(null);
    setConnectMode(null);
    setRoomCode(null);
    setRoomReady(false);
    setView("lobby");
    navigate("/");
  }

  function handlePlayAgain() {
    setGameState(SAMPLE_INITIAL_STATE);
    setWinner(null);
    setMatchId(null);
    setTimer(30);

    if (nick) {
      setView("searching");
      navigate("/");
      connectToServer("quick", nick);
    } else {
      setPendingQuick(true);
      setView("nick");
      navigate("/");
    }
  }

  const meInitial = (nick || "You").trim().charAt(0).toUpperCase();
  const oppInitial = (opponentName || "Opponent")
    .trim()
    .charAt(0)
    .toUpperCase();

  const myRoleLabel = mySymbol === 2 ? "You (O)" : "You (X)";
  const oppRoleLabel = mySymbol === 2 ? "Opponent (X)" : "Opponent (O)";

  function handleContinueRoom() {
    if (!matchId) return;
    setView("playing");
    navigate("/room");
  }

  function LobbyPage() {
    if (view === "nick") {
      return <Nickname onContinue={handleContinue} />;
    }

    if (connectMode === "create" && roomCode) {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const shareLink = `${origin}/?room=${roomCode}`;

      return (
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Room Created</h2>
          <p className="text-muted">
            Share this code or link with your friends so they can join.
          </p>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: "bold" }}>Room Code:</div>
            <div
              style={{
                fontSize: 24,
                letterSpacing: 2,
                marginTop: 4,
                marginBottom: 12,
              }}
            >
              {roomCode}
            </div>
            <div style={{ fontWeight: "bold" }}>Shareable Link:</div>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                wordBreak: "break-all",
                border: "1px solid #ddd",
                padding: 8,
                borderRadius: 4,
              }}
            >
              {shareLink}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-secondary"
              style={{ marginRight: 8 }}
              onClick={() =>
                alert("Ask your friends to join using the code or link.")
              }
            >
              Add Players
            </button>
            <button
              className="btn btn-primary"
              onClick={handleContinueRoom}
              disabled={!roomReady}
            >
              Continue
            </button>
          </div>

          <p className="text-muted" style={{ marginTop: 12 }}>
            {roomReady
              ? "A player has joined. You can start the game."
              : "Waiting for players to join..."}
          </p>

          <button
            className="btn btn-link"
            style={{ marginTop: 12 }}
            onClick={cancelMatch}
          >
            Cancel Room
          </button>
        </div>
      );
    }

    if (connectMode === "join" && joinCode && view === "lobby") {
      return (
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Joined Room</h2>
          <p className="text-muted">Room Code: {joinCode}</p>
          <p className="text-muted">
            Wait for the host to be ready, then press Continue.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleContinueRoom}
            disabled={!roomReady}
          >
            Continue
          </button>
          <button
            className="btn btn-link"
            style={{ marginTop: 12 }}
            onClick={cancelMatch}
          >
            Leave Room
          </button>
        </div>
      );
    }

    if (view === "searching") {
      return <Match onCancel={cancelMatch} eta={26} />;
    }

    return (
      <div className="card" style={{ textAlign: "center" }}>
        <h2>Welcome{nick ? `, ${nick}` : ""}</h2>
        <p className="text-muted">Play Tic-Tac-Toe online</p>

        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={startQuickMatch}>
            Quick Match
          </button>
        </div>

        <hr />

        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Play with a friend</h3>

          <button
            className="btn btn-secondary"
            style={{ marginBottom: 12 }}
            onClick={handleCreateRoom}
          >
            Create Room
          </button>

          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="input"
              style={{ marginRight: 8 }}
            />
            <button className="btn btn-primary" onClick={handleJoinRoom}>
              Join Room
            </button>
          </div>

          {joinError && (
            <div style={{ color: "red", marginTop: 8, fontSize: 12 }}>
              {joinError}
            </div>
          )}
        </div>
      </div>
    );
  }

  function RoomPage() {
    if (view === "playing") {
      return (
        <div className="play-layout">
          <div className={`player-panel ${isMyTurn ? "player-active" : ""}`}>
            <div className="avatar-circle">{meInitial}</div>
            <div className="player-name">{nick || "You"}</div>
            <div className="player-role">{myRoleLabel}</div>
            {isMyTurn && <div className="player-turn">Your turn</div>}
          </div>

          <div className="center-panel">
            <div className="timer-badge">Time left: {timer}s</div>
            <GBoard
              state={gameState}
              meSymbol={mySymbol ?? 1}
              canPlay={!gameState.finished}
              onMove={handleMove}
              onLeave={leaveRoom}
            />
            <div className="match-meta card">
              <div className="small">Match ID</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>
                {matchId || "-"}
              </div>
            </div>
          </div>

          <div className={`player-panel ${isOppTurn ? "player-active" : ""}`}>
            <div className="avatar-circle avatar-opponent">{oppInitial}</div>
            <div className="player-name">{opponentName || "Opponent"}</div>
            <div className="player-role">{oppRoleLabel}</div>
            {isOppTurn && <div className="player-turn">Their turn</div>}
          </div>
        </div>
      );
    }

    if (view === "result") {
      return (
        <Result
          winnerSymbol={winner}
          mySymbol={mySymbol}
          youName={nick ?? "You"}
          opponentName={opponentName ?? "Opponent"}
          onPlayAgain={handlePlayAgain}
        />
      );
    }

    return (
      <div className="card" style={{ textAlign: "center" }}>
        <h2>No active match</h2>
        <p className="text-muted">Go back to lobby to find a game.</p>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Back to lobby
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/room" element={<RoomPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return <AppInner />;
}
