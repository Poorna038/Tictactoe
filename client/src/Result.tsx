import React from "react";

type ResultProps = {
  winnerSymbol: number | null;
  mySymbol: number | null;
  youName: string;
  opponentName: string;
  onPlayAgain: () => void;
};

const Result: React.FC<ResultProps> = ({
  winnerSymbol,
  mySymbol,
  youName,
  opponentName,
  onPlayAgain,
}) => {
  let title = "";
  let subtitle = "";

  const didYouWin =
    winnerSymbol !== null &&
    winnerSymbol !== 0 &&
    mySymbol !== null &&
    winnerSymbol === mySymbol;

  if (winnerSymbol === 0) {
    title = "Oops, it's a draw!";
    subtitle = "No one wins this time.";
  } else if (didYouWin) {
    title = "You win!";
    subtitle = `${youName} takes the game.`;
  } else {
    title = "Opponent wins!";
    subtitle = `${opponentName} takes the game.`;
  }

  return (
    <div className="card" style={{ textAlign: "center", padding: 24 }}>
      <h2>{title}</h2>
      {subtitle && <p className="text-muted">{subtitle}</p>}
      <button className="btn btn-primary" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
};

export default Result;
