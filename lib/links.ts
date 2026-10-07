const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export const archiveLink = (u: string) => `https://archive.ph/newest/${encodeURI(u)}`;
export const waybackLink = (u: string) => `https://web.archive.org/web/2/${encodeURI(u)}`;

/** Shown when the server-side fetch fails. The links open from the visitor's own IP, which archives rarely block. */
export function failurePage(raw: string, detail: string): string {
  const u = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  const btn =
    "display:inline-block;padding:.7rem 1.1rem;margin:0 .5rem .5rem 0;border-radius:.6rem;background:#2563eb;color:#fff;text-decoration:none;font-weight:600";
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open it another way</title><body style="font:16px/1.5 system-ui;max-width:40rem;margin:4rem auto;padding:0 16px"><h1>This site blocked our server</h1><p>Big publishers block datacenter traffic. These open from <b>your</b> browser instead, which usually works:</p><p><a style="${btn}" href="${esc(archiveLink(u))}">Open on archive.ph</a><a style="${btn}" href="${esc(waybackLink(u))}">Open on Wayback Machine</a></p><p><a href="/">Try another link</a></p><details style="color:#666;margin-top:2rem"><summary>Details</summary><p>${esc(detail)}</p></details>`;
}
