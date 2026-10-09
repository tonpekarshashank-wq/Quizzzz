export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: ["#FFD43B", "#FF6A2B", "#24DEA4", "#FFA9C9"][i % 4],
            animationDelay: `${(i % 7) * 0.12}s`,
            transform: `rotate(${i * 23}deg)`,
          }}
        />
      ))}
    </div>
  );
}
