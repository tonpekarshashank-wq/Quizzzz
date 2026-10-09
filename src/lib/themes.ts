export const themes = {
  summit: {
    label: "Summit",
    headline: "The summit push.",
    footer: "Climb the trail. First to the flag wins the mountain.",
  },
  gp: {
    label: "Grand Prix",
    headline: "Grand Prix finale.",
    footer: "Every point is another corner.",
  },
  tour: {
    label: "Tour de Quiz",
    headline: "The final climb.",
    footer: "Win the climb, win the stage.",
  },
  moon: {
    label: "Moonshot",
    headline: "Mission to the Moon.",
    footer: "Keep your fuel up for the next burn.",
  },
  map: {
    label: "Treasure",
    headline: "Hunt for the X.",
    footer: "Follow the route. The first ship to the X takes the chest.",
  },
} as const;
export type Theme = keyof typeof themes;

// Equal-point markers still follow the distinct server ranks so their labels do not stack.
export function sceneProgress(
  players: { id: string; score: number }[],
  index: number,
) {
  if (players.length === 1) return 0.5;
  const scores = players.map((p) => p.score),
    min = Math.min(...scores),
    max = Math.max(...scores);
  const rank = (players.length - index - 1) / (players.length - 1);
  const score = max === min ? rank : (players[index].score - min) / (max - min);
  return 0.15 + 0.7 * (0.8 * score + 0.2 * rank);
}
