import type { CSSProperties, ReactNode } from "react";
import { domainColor } from "@/lib/style";

// Renders a card's rules text: [Keyword] chips, :rb_icon: symbols and dimmed italic (reminder text).
// Colours follow the role of the keyword (action / reaction / other keywords); the icons are drawn here.

const KEYWORD_STYLE: Record<string, string> = {
  action: "bg-[#1f7a55]",
  accelerate: "bg-[#1f7a55]",
  reaction: "bg-[#1b7683]",
};
const DEFAULT_KEYWORD = "bg-[#b0305f]";

// Slanted parallelogram label, like the keyword plates printed on the cards. The text is skewed back so it stays upright.
const SKEW: CSSProperties = { transform: "skewX(-12deg)" };
const UNSKEW: CSSProperties = { transform: "skewX(12deg)", display: "inline-flex" };

export function SlantTag({ children, className = "bg-cavity text-t1" }: { children: ReactNode; className?: string }) {
  return (
    <span style={SKEW} className={`inline-flex items-center rounded-[4px] px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide ${className}`}>
      <span style={UNSKEW} className="items-center gap-1.5 italic">
        {children}
      </span>
    </span>
  );
}

// Domain icons live in /public/icons/rb (Riot Games assets, see the notice in README.md).
const DOMAINS = ["fury", "calm", "mind", "body", "chaos", "order"];

const TOKEN = /(\[[^\]]+\])|(:rb_[a-z0-9_]+:)|(\([^()]*\))/gi;

function Icon({ name }: { name: string }) {
  const base = "mx-0.5 inline-block h-[1.15em] w-[1.15em] -translate-y-px align-middle";
  const svg = (children: ReactNode, color = "currentColor") => (
    <svg viewBox="0 0 24 24" role="img" aria-label={name} className={base} style={{ color }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <title>{name}</title>
      {children}
    </svg>
  );
  if (name === "might") return svg(<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" fill="currentColor" fillOpacity={0.25} />, "#e8b04a");
  if (name === "energy") return svg(<path d="M13 3 6 13h5l-1 8 8-11h-5l1-7Z" fill="currentColor" fillOpacity={0.25} />, "#e8e8e8");
  if (name === "power") return svg(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>, "#c08be8");
  if (name === "exhaust") return svg(<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />, "#e8e8e8");
  const cost = name.match(/^(?:energy|cost)_?(\d+)$/);
  if (cost) {
    return (
      <span
        role="img"
        aria-label={`${cost[1]} energy`}
        className="mx-0.5 inline-flex h-[1.5em] w-[1.5em] -translate-y-px items-center justify-center rounded-full bg-cavity pt-px text-center align-middle text-[0.8em] font-bold not-italic leading-none text-t1"
      >
        {cost[1]}
      </span>
    );
  }
  const rune = name.match(/^rune_?(\w+)?$/);
  if (rune) {
    const label = name.replace(/_/g, " ");
    if (rune[1] && DOMAINS.includes(rune[1])) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={`/icons/rb/${rune[1]}.svg`} alt={label} title={label} className="mx-0.5 inline-block h-[1.35em] w-[1.35em] -translate-y-px align-middle" />;
    }
    return svg(<path d="M12 3l7 9-7 9-7-9 7-9Z" fill="currentColor" fillOpacity={0.35} />, rune[1] ? domainColor(rune[1]) : "#e8e8e8");
  }
  return (
    <span className="mx-0.5 inline-block rounded bg-cavity px-1 text-[0.8em] font-semibold uppercase text-t2" title={name}>
      {name.replace(/_/g, " ")}
    </span>
  );
}

function render(text: string, reminder: boolean, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const key = `${keyBase}-${n++}`;
    if (m[1] && m[1].slice(1, -1).trim() === ">") {
      // "[>]" separates an ability's keyword from its cost: show it as a small arrow, not a keyword plate
      out.push(
        <svg key={key} viewBox="0 0 24 24" role="img" aria-label="then" className="mx-1 inline-block h-[1.1em] w-[1.1em] -translate-y-px align-middle text-t2" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <title>then</title>
          <path d="m9 6 6 6-6 6" />
        </svg>,
      );
    } else if (m[1]) {
      const label = m[1].slice(1, -1);
      const style = KEYWORD_STYLE[label.split(/\s+/)[0].toLowerCase()] ?? DEFAULT_KEYWORD;
      out.push(
        <span key={key} className="mx-1 inline-block align-middle">
          <SlantTag className={`${style} px-2 py-[3px] text-[0.68em] text-white`}>{label}</SlantTag>
        </span>,
      );
    } else if (m[2]) {
      out.push(<Icon key={key} name={m[2].slice(4, -1).toLowerCase()} />);
    } else if (m[3]) {
      out.push(
        <span key={key} className="italic text-t2">
          ({render(m[3].slice(1, -1), true, key)})
        </span>,
      );
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// The card data carries HTML entities (&gt;, &amp;, ...): turn them into plain characters.
function decodeEntities(t: string): string {
  return t
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

export function CardText({ text }: { text: string }) {
  const lines = decodeEntities(text).trim().split(/\n+/);
  return (
    <div className="space-y-2.5 text-base leading-[1.8] text-t1">
      {lines.map((line, i) => (
        <p key={i}>{render(line, false, `l${i}`)}</p>
      ))}
    </div>
  );
}
