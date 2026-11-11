/**
 * A short burst of confetti from a point on the screen, for finishing things.
 * "small" for a task done, "big" for clearing a project or all your own work.
 * Plain DOM and the Web Animations API, cleaned up when it lands; skipped
 * entirely when the user prefers reduced motion.
 */
const COLOURS = ["#c24a1f", "#d39b1e", "#3f8a4f", "#7d4f8a", "#e98a62"];

export function celebrate(level: "small" | "big" = "small", origin?: { x: number; y: number }) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const count = level === "big" ? 120 : 36;
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 3;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "1000", overflow: "hidden" });
  document.body.append(layer);

  const animations: Animation[] = [];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 6;
    Object.assign(piece.style, {
      position: "absolute", left: x + "px", top: y + "px", width: size + "px", height: size * 0.45 + "px",
      background: COLOURS[i % COLOURS.length], borderRadius: "2px",
    });
    layer.append(piece);
    // Fan out upwards, then fall with a little drift and spin.
    const angle = (-90 + (Math.random() - 0.5) * (level === "big" ? 160 : 110)) * (Math.PI / 180);
    const speed = (level === "big" ? 260 : 170) + Math.random() * 200;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    const fall = 260 + Math.random() * 320;
    const spin = (Math.random() - 0.5) * 1080;
    animations.push(piece.animate([
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${dx * 1.3}px, ${dy + fall}px) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 700, easing: "cubic-bezier(.2, .7, .3, 1)", fill: "forwards" }));
  }
  Promise.all(animations.map((animation) => animation.finished)).finally(() => layer.remove());
}
