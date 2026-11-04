// shell R9 (2026-11-04): line icons, inline SVG, 18 px, stroke 1.5, `currentColor`, the shapes of
// the Claude app's toolbar. Decorative (aria-hidden): every button that carries one has its own
// aria-label / title. No text glyphs.
import { raw, type SafeHtml } from "@world/html";

const svg = (body: string): SafeHtml =>
  raw(`<svg class="ic" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`);

export const ICONS = {
  /** 预览 */
  globe: svg('<circle cx="9" cy="9" r="6.75"/><path d="M2.25 9h13.5M9 2.25c1.9 2 2.85 4.25 2.85 6.75S10.9 13.75 9 15.75M9 2.25C7.1 4.25 6.15 6.5 6.15 9S7.1 13.75 9 15.75"/>'),
  /** 代码 */
  code: svg('<path d="M6.5 5 2.75 9l3.75 4M11.5 5l3.75 4-3.75 4"/>'),
  /** 表格 */
  grid: svg('<rect x="2.75" y="2.75" width="12.5" height="12.5" rx="2"/><path d="M2.75 7h12.5M2.75 11h12.5M7 2.75v12.5"/>'),
  /** 会议 */
  play: svg('<rect x="2.25" y="3.75" width="13.5" height="10.5" rx="2"/><path d="m7.5 6.75 3.75 2.25-3.75 2.25z"/>'),
  /** 文件 */
  folder: svg('<path d="M2.25 5.25a1.5 1.5 0 0 1 1.5-1.5h3l1.5 1.5h6a1.5 1.5 0 0 1 1.5 1.5v6.75a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5z"/>'),
  /** The sidebar toggle (sidebar-left). */
  sidebar: svg('<rect x="2.25" y="3" width="13.5" height="12" rx="2"/><path d="M6.75 3v12"/>'),
  /** The explorer toggle (two files). */
  files: svg('<path d="M6.75 2.25h4.5l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M11.25 2.25v3h3M3.75 5.25v9a1.5 1.5 0 0 0 1.5 1.5h6"/>'),
  /** A task's own surface (a document). */
  doc: svg('<path d="M5.25 2.25h5.25l3 3v9a1.5 1.5 0 0 1-1.5 1.5h-6.75a1.5 1.5 0 0 1-1.5-1.5v-10.5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M10.5 2.25v3h3M6.75 9h4.5M6.75 12h4.5"/>'),
  back: svg('<path d="M11.25 4.5 6.75 9l4.5 4.5"/>'),
  forward: svg('<path d="M6.75 4.5 11.25 9l-4.5 4.5"/>'),
  down: svg('<path d="m5.25 7.5 3.75 3.75 3.75-3.75"/>'),
  plus: svg('<path d="M9 3.75v10.5M3.75 9h10.5"/>'),
  search: svg('<circle cx="8.25" cy="8.25" r="4.5"/><path d="m11.5 11.5 3.25 3.25"/>'),
  maximize: svg('<path d="M10.5 3h4.5v4.5M7.5 15H3v-4.5M15 3l-5.25 5.25M3 15l5.25-5.25"/>'),
  close: svg('<path d="m4.5 4.5 9 9M13.5 4.5l-9 9"/>'),
  /** ↗ on a 素材 card: open its source. */
  external: svg('<path d="M7.5 3.75H4.5a1.5 1.5 0 0 0-1.5 1.5v8.25a1.5 1.5 0 0 0 1.5 1.5h8.25a1.5 1.5 0 0 0 1.5-1.5v-3M10.5 3h4.5v4.5M15 3 8.25 9.75"/>'),
  /** The section icons: 工作台 · 文档 · 审批 · 通讯录. */
  home: svg('<path d="M3 7.5 9 3l6 4.5v6.75a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 14.25z"/><path d="M7.5 15.75v-4.5h3v4.5"/>'),
  approvals: svg('<rect x="3" y="2.25" width="12" height="13.5" rx="2"/><path d="m6.25 9.25 1.75 1.75 3.75-3.75"/>'),
  contacts: svg('<circle cx="9" cy="6.75" r="3"/><path d="M3.75 15.75c.75-2.75 2.75-4.5 5.25-4.5s4.5 1.75 5.25 4.5"/>'),
} as const;
