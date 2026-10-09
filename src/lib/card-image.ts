import type { FinalPlayer } from "./game-summary";
export async function cardImage(
  player: FinalPlayer,
  title: string,
  count: number,
  partial: boolean,
): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Your browser cannot create an image.");
  const ink = "#12131A",
    colors = ["#FF6A2B", "#FFA9C9", "#2B4BFF", "#FFD43B", "#24DEA4", "#D3EEFF"];
  c.fillStyle = player.rank === 1 && !partial ? "#FFD43B" : "#F5F2E9";
  c.fillRect(0, 0, 1080, 1440);
  c.fillStyle = ink;
  c.beginPath();
  c.roundRect(55, 55, 980, 1330, 48);
  c.fill();
  c.fillStyle = "white";
  c.beginPath();
  c.roundRect(40, 40, 980, 1330, 48);
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = 7;
  c.stroke();
  const text = (value: string, y: number, size: number, color = ink) => {
    c.font = `800 ${size}px "Instrument Sans", sans-serif`;
    c.fillStyle = color;
    c.textAlign = "center";
    c.fillText(value, 530, y, 890);
  };
  text("quizzzz ✳", 150, 64);
  text(
    partial
      ? "PARTIAL RESULTS"
      : player.rank === 1
        ? "CHAMPION"
        : "GAME COMPLETE",
    215,
    28,
  );
  c.save();
  c.translate(390, 270);
  c.fillStyle = colors[player.avatar.body];
  c.lineWidth = 7;
  c.strokeStyle = ink;
  c.beginPath();
  if (player.avatar.body === 0) c.arc(140, 140, 140, 0, Math.PI * 2);
  else if (player.avatar.body === 2) c.roundRect(0, 0, 280, 280, 65);
  else if (player.avatar.body === 3)
    c.roundRect(0, 0, 280, 280, [140, 140, 45, 140]);
  else if (player.avatar.body === 5)
    c.roundRect(0, 0, 280, 280, [140, 140, 140, 35]);
  else {
    c.moveTo(130, 0);
    c.bezierCurveTo(255, -5, 295, 70, 275, 150);
    c.bezierCurveTo(310, 250, 215, 295, 130, 278);
    c.bezierCurveTo(10, 305, -20, 215, 4, 125);
    c.bezierCurveTo(-10, 30, 40, 0, 130, 0);
  }
  c.fill();
  c.stroke();
  c.fillStyle = player.avatar.body === 2 ? "white" : ink;
  for (const x of [92, 187]) {
    c.beginPath();
    c.arc(x, 115, 13, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = player.avatar.body === 2 ? "white" : ink;
  c.lineWidth = 9;
  c.beginPath();
  if (player.avatar.mood === "o")
    c.ellipse(140, 185, 18, 25, 0, 0, Math.PI * 2);
  else c.arc(140, 155, 40, 0, Math.PI);
  if (player.avatar.mood === "grin") {
    c.closePath();
    c.fillStyle = "white";
    c.fill();
  }
  c.stroke();
  c.restore();
  text(player.nickname, 645, 68);
  text(
    player.rank ? `#${player.rank} / ${count} PLAYERS` : "YOUR RESULTS",
    705,
    34,
  );
  text(`${player.score.toLocaleString("en-US")} pts`, 800, 84);
  if (player.rank && !partial)
    text(
      `TOP ${Math.ceil((player.rank / Math.max(1, count)) * 100)}%`,
      865,
      28,
    );
  text(
    `${player.accuracy === null ? "—" : Math.round(player.accuracy * 100) + "%"} accuracy · ${player.bestStreak} best streak`,
    955,
    34,
  );
  text(
    player.averageMs === null
      ? "No accepted answers"
      : `${(player.averageMs / 1000).toFixed(2)}s average response`,
    1015,
    30,
  );
  player.awards.forEach((award, i) =>
    text(award, 1085 + i * 48, 30, "#2B4BFF"),
  );
  text(title, 1290, 32);
  text("Good questions. Great company.", 1330, 22);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image creation failed.")),
      "image/png",
    ),
  );
}
