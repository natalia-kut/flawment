import type { ReactNode } from "react";
import s from "./empty-state.module.css";

type Art = "projects" | "tasks" | "teams" | "documents" | "lost" | "locked";

/** A line of text in a picture. */
function Line({ x, y, w, h = 6, className = s.line }: { x: number; y: number; w: number; h?: number; className?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} className={className} />;
}

/** A small head and shoulders in a coloured circle. */
function Face({ x, y, r, className }: { x: number; y: number; r: number; className: string }) {
  return <g transform={`translate(${x} ${y}) scale(${r / 20})`}>
    <circle r="22.5" className={s.white} />
    <circle r="20" className={className} />
    <circle cy="-4.5" r="6.2" className={s.white} />
    <path d="M-11 12.5a11 9.5 0 0 1 22 0" className={s.white} />
  </g>;
}

// Each picture is a miniature of what the page will hold.
const pictures: Record<Art, ReactNode> = {
  projects: <>
    <g transform="rotate(-9 105 110)"><rect x="52" y="46" width="112" height="122" rx="13" className={s.back} /><Line x={68} y={64} w={26} /><Line x={68} y={80} w={18} /></g>
    <g transform="rotate(9 255 110)"><rect x="196" y="46" width="112" height="122" rx="13" className={s.back} /><Line x={268} y={64} w={26} /><Line x={276} y={80} w={18} /></g>
    <rect x="102" y="22" width="156" height="158" rx="15" className={s.card} />
    <Line x={120} y={41} w={82} h={9} className={s.ink} />
    <Line x={120} y={60} w={118} /><Line x={120} y={73} w={90} />
    <circle cx="140" cy="113" r="17" className={s.ringTrack} />
    <circle cx="140" cy="113" r="17" className={s.ringFill} strokeDasharray="70 107" transform="rotate(-90 140 113)" />
    <Line x={170} y={103} w={34} h={8} className={s.ink} /><Line x={170} y={118} w={58} />
    <rect x="120" y="148" width="50" height="18" rx="9" className={s.warmSoft} /><Line x={130} y={154} w={30} className={s.warm} />
    <Face x={201} y={157} r={11} className={s.accent} /><Face x={218} y={157} r={11} className={s.warm} /><Face x={235} y={157} r={11} className={s.violet} />
  </>,
  tasks: <g transform="translate(0 14)">
    {[30, 136, 242].map((x, column) => <g key={x}>
      <circle cx={x + 5} cy="24" r="4.5" className={[s.warm, s.accent, s.olive][column]} />
      <Line x={x + 16} y={21} w={[42, 54, 36][column]} className={s.ink} />
    </g>)}
    <rect x="30" y="42" width="88" height="50" rx="10" className={s.card} /><Line x={42} y={56} w={56} /><Line x={42} y={70} w={32} />
    <rect x="30" y="104" width="88" height="50" rx="10" className={s.card} /><Line x={42} y={118} w={42} /><Line x={42} y={132} w={58} />
    <rect x="136" y="42" width="88" height="50" rx="10" className={s.slot} />
    <rect x="136" y="104" width="88" height="50" rx="10" className={s.card} /><Line x={148} y={118} w={60} /><Line x={148} y={132} w={38} />
    <rect x="242" y="42" width="88" height="50" rx="10" className={s.card} />
    <circle cx="260" cy="67" r="9" className={s.olive} /><path d="m256 67 3 3 5.2-5.6" className={s.tick} /><Line x={276} y={60} w={40} /><Line x={276} y={72} w={26} />
    {/* The card on its way into the middle column. */}
    <g transform="translate(148 48) rotate(6 44 25)">
      <rect width="88" height="50" rx="10" className={s.card} /><Line x={12} y={13} w={52} className={s.accent} /><Line x={12} y={29} w={34} /><Face x={71} y={34} r={8} className={s.warm} />
    </g>
  </g>,
  teams: <>
    <g transform="rotate(-7 96 110)"><rect x="38" y="66" width="112" height="92" rx="13" className={s.back} /><Line x={52} y={83} w={26} /><Face x={62} y={132} r={10} className={s.accentLight} /></g>
    <g transform="rotate(7 264 110)"><rect x="210" y="66" width="112" height="92" rx="13" className={s.back} /><Line x={282} y={83} w={26} /><Face x={298} y={132} r={10} className={s.accentLight} /></g>
    <rect x="88" y="30" width="184" height="142" rx="15" className={s.card} />
    <Line x={108} y={50} w={78} h={9} className={s.ink} /><Line x={108} y={68} w={52} />
    <rect x="208" y="46" width="46" height="18" rx="9" className={s.oliveSoft} /><Line x={218} y={52} w={26} className={s.olive} />
    <Face x={130} y={124} r={23} className={s.accent} /><Face x={165} y={124} r={23} className={s.warm} /><Face x={200} y={124} r={23} className={s.violet} />
    <circle cx="243" cy="124" r="14" className={s.slot} /><path d="M243 118.5v11M237.5 124h11" className={s.plus} />
  </>,
  documents: <>
    <g transform="rotate(-10 130 110)"><rect x="80" y="28" width="108" height="144" rx="10" className={s.back} /><Line x={92} y={46} w={22} /><Line x={92} y={62} w={16} /></g>
    <g transform="rotate(10 230 110)"><rect x="172" y="28" width="108" height="144" rx="10" className={s.back} /><Line x={244} y={46} w={22} /><Line x={250} y={62} w={16} /></g>
    <path d="M128 14h74l34 34v128a10 10 0 0 1-10 10h-98a10 10 0 0 1-10-10V24a10 10 0 0 1 10-10z" className={s.card} />
    <path d="M202 14v24a10 10 0 0 0 10 10h24z" className={s.accentLight} />
    <Line x={134} y={34} w={50} h={9} className={s.ink} /><Line x={134} y={51} w={34} className={s.accent} />
    <Line x={134} y={70} w={84} /><Line x={134} y={82} w={84} /><Line x={134} y={94} w={58} />
    <rect x="137" y="134" width="13" height="28" rx="3" className={s.accentLight} /><rect x="157" y="120" width="13" height="42" rx="3" className={s.accent} />
    <rect x="177" y="144" width="13" height="18" rx="3" className={s.warm} /><rect x="197" y="128" width="13" height="34" rx="3" className={s.olive} />
    <rect x="132" y="167" width="84" height="1.8" className={s.line} />
  </>,
  // A page that is not there: an empty window, and a magnifying glass that finds nothing.
  lost: <>
    <g transform="rotate(-8 100 112)"><rect x="46" y="52" width="112" height="112" rx="13" className={s.back} /><Line x={60} y={70} w={26} /><Line x={60} y={86} w={18} /></g>
    <g transform="rotate(8 260 112)"><rect x="202" y="52" width="112" height="112" rx="13" className={s.back} /><Line x={274} y={70} w={26} /><Line x={282} y={86} w={18} /></g>
    <rect x="92" y="24" width="176" height="150" rx="15" className={s.card} />
    <circle cx="110" cy="42" r="4" className={s.warm} /><circle cx="123" cy="42" r="4" className={s.accentLight} /><circle cx="136" cy="42" r="4" className={s.olive} />
    <rect x="150" y="36" width="102" height="12" rx="6" className={s.back} />
    <rect x="110" y="64" width="140" height="92" rx="10" className={s.slot} />
    <Line x={124} y={80} w={58} className={s.line} /><Line x={124} y={94} w={84} className={s.line} />
    <g transform="translate(222 128)">
      <path d="M17 17l22 22" className={s.handle} />
      <circle r="25" className={s.white} /><circle r="21" className={s.lens} />
      <path d="M-6.5-5.5a6.5 6.5 0 1 1 9 6c-2.4 1-2.5 2.6-2.5 4.5" className={s.mark} /><circle cy="11" r="2" className={s.accent} />
    </g>
  </>,
  // A page only some people may open: the same card, behind a padlock.
  locked: <>
    <g transform="rotate(-8 100 112)"><rect x="46" y="52" width="112" height="112" rx="13" className={s.back} /><Line x={60} y={70} w={26} /><Line x={60} y={86} w={18} /></g>
    <g transform="rotate(8 260 112)"><rect x="202" y="52" width="112" height="112" rx="13" className={s.back} /><Line x={274} y={70} w={26} /><Line x={282} y={86} w={18} /></g>
    <rect x="102" y="24" width="156" height="150" rx="15" className={s.card} />
    <Line x={120} y={43} w={82} h={9} className={s.ink} /><Line x={120} y={62} w={110} /><Line x={120} y={75} w={80} />
    <Face x={134} y={128} r={14} className={s.accentLight} /><Face x={160} y={128} r={14} className={s.accentLight} />
    <g transform="translate(222 128)">
      <path d="M-13-6v-8a13 13 0 0 1 26 0v8" className={s.shackle} />
      <rect x="-21" y="-8" width="42" height="34" rx="8" className={s.accent} />
      <circle cy="5" r="4.5" className={s.white} /><rect x="-1.8" y="7" width="3.6" height="9" rx="1.8" className={s.white} />
    </g>
  </>,
};

/**
 * A page that has nothing on it yet: a picture of what will be here, one
 * sentence, and (for whoever may) the button that starts it.
 */
export default function EmptyState({ art, title, children, action }: { art: Art; title: string; children: ReactNode; action?: ReactNode }) {
  return <section className={s.panel}>
    <svg className={s.art} viewBox="0 0 360 200" aria-hidden="true">
      <ellipse cx="180" cy="108" rx="172" ry="84" className={s.glow} />
      {pictures[art]}
    </svg>
    <h2>{title}</h2>
    <p>{children}</p>
    {action && <div className={s.action}>{action}</div>}
  </section>;
}
