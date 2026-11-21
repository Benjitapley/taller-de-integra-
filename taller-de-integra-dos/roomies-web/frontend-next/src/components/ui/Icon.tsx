import type { CSSProperties } from "react";

const paths = {
  home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-7h6v7" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  chat: <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.3-5.5A8.5 8.5 0 1 1 21 12Z" />,
  heart: <path d="M12 21S3 15.5 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-5 3-8 8-8s8 3 8 8" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  file: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 12h7M9 16h7" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
} as const;

export type IconName = keyof typeof paths;

// Trazos SVG del index.html de los mockups oficiales WEB.
export default function Icon({ name, size = 22, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0, ...style }}>{paths[name]}</svg>;
}
