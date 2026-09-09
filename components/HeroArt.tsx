/**
 * The hero illustration: a stylised torana — the decorated arch a pandal
 * is framed by — with marigold strings hanging from it.
 *
 * Drawn rather than sourced, for two reasons. The obvious one is licensing:
 * the stock artwork this replaced was a watermarked preview, which would
 * have put "pngtree" diagonally across the top of the site. The better one
 * is that vector art built from the palette tokens stays exactly in key
 * with everything around it, scales to any screen without a second asset,
 * and costs a couple of kilobytes instead of a couple of hundred.
 *
 * Deliberately an arch and garland rather than a depiction of Ganesha. A
 * flat illustration of a deity is easy to get subtly wrong, and the arch is
 * the thing you actually walk through on the street — it says "pandal"
 * without asking anyone to judge the likeness.
 */
export default function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 300"
      role="img"
      aria-label="A decorated festival arch hung with marigold garlands"
      className={className}
    >
      <defs>
        <linearGradient id="hero-saffron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4a93c" />
          <stop offset="60%" stopColor="#ea6c1d" />
          <stop offset="100%" stopColor="#b8460c" />
        </linearGradient>
        <linearGradient id="hero-arch" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ea6c1d" />
          <stop offset="100%" stopColor="#c22b1f" />
        </linearGradient>
        <radialGradient id="hero-halo">
          <stop offset="0%" stopColor="#f4a93c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f4a93c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo behind the arch, doing the job the blurred bloom does
          elsewhere — SVG gradients are cheap where a blur filter is not. */}
      <circle cx="210" cy="150" r="140" fill="url(#hero-halo)" />

      {/* Rays. Odd count and varying length so it reads as hand-set
          rather than machine-spaced. */}
      <g stroke="#ea6c1d" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round">
        {Array.from({ length: 13 }, (_, i) => {
          const angle = (Math.PI / 12) * i - Math.PI;
          const inner = 120;
          const outer = 120 + (i % 3 === 0 ? 32 : i % 2 === 0 ? 20 : 12);
          return (
            <line
              key={i}
              x1={210 + Math.cos(angle) * inner}
              y1={150 + Math.sin(angle) * inner}
              x2={210 + Math.cos(angle) * outer}
              y2={150 + Math.sin(angle) * outer}
            />
          );
        })}
      </g>

      {/* The arch itself: two posts and a scalloped canopy. */}
      <path
        d="M78 262V126c0-53 59-92 132-92s132 39 132 92v136"
        fill="none"
        stroke="url(#hero-arch)"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M104 262V128c0-40 48-70 106-70s106 30 106 70v134"
        fill="none"
        stroke="#f4a93c"
        strokeOpacity="0.55"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Scallops along the inner edge of the canopy — the cloth frill
          every pandal arch has. */}
      <g fill="#f4a93c" fillOpacity="0.9">
        {Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          const angle = Math.PI * (1 - t);
          const x = 210 + Math.cos(angle) * 106;
          const y = 128 - Math.sin(angle) * 68;
          return <circle key={i} cx={x} cy={y} r={7} />;
        })}
      </g>

      {/* Marigold strings. Two garlands, different lengths, so the arch
          does not read as symmetrical to the pixel. */}
      {[
        { x: 132, count: 7 },
        { x: 288, count: 5 },
      ].map((strand) => (
        <g key={strand.x}>
          <line x1={strand.x} y1={104} x2={strand.x} y2={104 + strand.count * 22} stroke="#b8460c" strokeOpacity="0.35" strokeWidth="2" />
          {Array.from({ length: strand.count }, (_, i) => (
            <circle key={i} cx={strand.x} cy={112 + i * 22} r={9} fill="url(#hero-saffron)" />
          ))}
        </g>
      ))}

      {/* Ground line, so the posts stand on something. */}
      <line x1="54" y1="262" x2="366" y2="262" stroke="#2b1608" strokeOpacity="0.12" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
