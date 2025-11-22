from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
]


def get_winner(board: List[int]) -> int:
    for a, b, c in WIN_LINES:
        if board[a] != 0 and board[a] == board[b] == board[c]:
            return board[a]
    return 0


class Game:
    def __init__(self, x_ws: WebSocket, o_ws: WebSocket, x_name: str, o_name: str):
        self.id: str = "match_" + uuid.uuid4().hex[:8]
        self.board: List[int] = [0] * 9
        self.turn: int = 1
        self.finished: bool = False
        self.winner: int = 0
        self.x_ws: WebSocket = x_ws
        self.o_ws: WebSocket = o_ws
        self.x_name: str = x_name
        self.o_name: str = o_name

    def symbol_for(self, ws: WebSocket) -> int:
        if ws is self.x_ws:
            return 1
        if ws is self.o_ws:
            return 2
        return 0

    def is_player(self, ws: WebSocket) -> bool:
        return ws is self.x_ws or ws is self.o_ws

    def to_state(self):
        return {
            "matchId": self.id,
            "board": self.board,
            "turn": self.turn,
            "finished": self.finished,
            "winner": self.winner,
            "players": {
                "x": {"name": self.x_name},
                "o": {"name": self.o_name},
            },
        }


# quick-match waiting queue
waiting_ws: Optional[WebSocket] = None
waiting_name: Optional[str] = None

# created rooms: room_code -> {"ws": WebSocket, "name": str}
rooms: Dict[str, Dict[str, object]] = {}

games: List[Game] = []


async def send_safe(ws: WebSocket, data):
  try:
    await ws.send_json(data)
  except Exception:
    pass


def get_game(ws: WebSocket) -> Optional[Game]:
    for g in games:
        if g.is_player(ws):
            return g
    return None


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global waiting_ws, waiting_name, games, rooms

    await ws.accept()

    try:
        init_msg = await ws.receive_json()
    except Exception:
        await ws.close()
        return

    nickname = init_msg.get("nickname") or "Guest"
    mode = init_msg.get("type") or "quick"  # "quick" | "create" | "join"

    if mode == "create":
        room_code = uuid.uuid4().hex[:6].upper()
        rooms[room_code] = {"ws": ws, "name": nickname}
        await send_safe(ws, {"type": "waiting", "roomCode": room_code})

    elif mode == "join":
        room_code = init_msg.get("roomCode")
        host_info = rooms.get(room_code or "")

        if not room_code or not host_info:
            await send_safe(ws, {"type": "join_error", "message": "Room not found"})
            await ws.close()
            return

        x_ws: WebSocket = host_info["ws"]  # host is X
        x_name: str = host_info["name"] or "Player_X"
        o_ws: WebSocket = ws
        o_name: str = nickname

        game = Game(x_ws=x_ws, o_ws=o_ws, x_name=x_name, o_name=o_name)
        games.append(game)
        rooms.pop(room_code, None)

        await send_safe(
            x_ws,
            {
                "type": "match_start",
                "youAre": 1,
                "opponentName": o_name,
                "state": game.to_state(),
            },
        )
        await send_safe(
            o_ws,
            {
                "type": "match_start",
                "youAre": 2,
                "opponentName": x_name,
                "state": game.to_state(),
            },
        )

    else:
        if waiting_ws is None:
            waiting_ws = ws
            waiting_name = nickname
            await send_safe(ws, {"type": "waiting"})
        else:
            x_ws = waiting_ws
            x_name = waiting_name or "Player_X"
            o_ws = ws
            o_name = nickname

            game = Game(x_ws=x_ws, o_ws=o_ws, x_name=x_name, o_name=o_name)
            games.append(game)

            await send_safe(
                x_ws,
                {
                    "type": "match_start",
                    "youAre": 1,
                    "opponentName": o_name,
                    "state": game.to_state(),
                },
            )
            await send_safe(
                o_ws,
                {
                    "type": "match_start",
                    "youAre": 2,
                    "opponentName": x_name,
                    "state": game.to_state(),
                },
            )

            waiting_ws = None
            waiting_name = None

    try:
        while True:
            msg = await ws.receive_json()
            msg_type = msg.get("type")

            if msg_type == "move":
                idx = msg.get("index")
                g = get_game(ws)
                if g is None:
                    continue
                if g.finished:
                    continue
                if not isinstance(idx, int) or idx < 0 or idx > 8:
                    continue

                symbol = g.symbol_for(ws)
                if symbol == 0:
                    continue
                if g.turn != symbol:
                    continue
                if g.board[idx] != 0:
                    continue

                g.board[idx] = symbol
                w = get_winner(g.board)

                if w != 0:
                    g.finished = True
                    g.winner = w
                elif all(c != 0 for c in g.board):
                    g.finished = True
                    g.winner = 0
                else:
                    g.turn = 2 if g.turn == 1 else 1

                update = {"type": "state_update", "state": g.to_state()}
                await send_safe(g.x_ws, update)
                await send_safe(g.o_ws, update)

            elif msg_type == "timeout":
                g = get_game(ws)
                if g is None:
                    continue
                if g.finished:
                    continue

                symbol = g.symbol_for(ws)
                if symbol == 0:
                    continue
                if g.turn != symbol:
                    continue

                g.turn = 2 if g.turn == 1 else 1

                update = {"type": "state_update", "state": g.to_state()}
                await send_safe(g.x_ws, update)
                await send_safe(g.o_ws, update)

            elif msg_type == "leave":
                g = get_game(ws)
                if g:
                    g.finished = True
                    g.winner = 2 if g.symbol_for(ws) == 1 else 1
                    update = {"type": "state_update", "state": g.to_state()}
                    await send_safe(g.x_ws, update)
                    await send_safe(g.o_ws, update)
                    if g in games:
                        games.remove(g)

    except WebSocketDisconnect:
        g = get_game(ws)
        if g:
            loser_symbol = g.symbol_for(ws)
            if not g.finished:
                g.finished = True
                g.winner = 2 if loser_symbol == 1 else 1
                update = {"type": "state_update", "state": g.to_state()}
                await send_safe(g.x_ws, update)
                await send_safe(g.o_ws, update)
            if g in games:
                games.remove(g)

        if waiting_ws is ws:
            waiting_ws = None
            waiting_name = None

        for code, info in list(rooms.items()):
            if info["ws"] is ws:
                rooms.pop(code, None)
                break
