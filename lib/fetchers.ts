import { lookup } from "node:dns/promises";
import net from "node:net";

const GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Unpaywall/0.1 (+https://unpaywall.matthew-tran.com)";

export type Result = { html: string; baseUrl: string; method: string };

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Parse + SSRF-check a user supplied URL. Throws on anything unsafe. */
export async function validateUrl(raw: string): Promise<URL> {
  let input = raw.trim();
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) URLs are supported");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) {
    throw new Error("That host is not allowed");
  }
  const addrs = net.isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That host is not allowed");
  return url;
}

async function get(url: string, headers: Record<string, string>, ms = 10000) {
  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(ms),
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("html")) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
}

function visibleText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** Many metered sites ship the full article in JSON-LD even when the DOM is truncated. */
function jsonLdArticle(html: string): { title: string; body: string } | null {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const walk = (n: unknown): { title: string; body: string } | null => {
        if (Array.isArray(n)) return n.map(walk).find(Boolean) ?? null;
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          if (typeof o.articleBody === "string" && o.articleBody.length > 1500) {
            return { title: String(o.headline ?? ""), body: o.articleBody };
          }
          return Object.values(o).map(walk).find(Boolean) ?? null;
        }
        return null;
      };
      const hit = walk(JSON.parse(m[1]));
      if (hit) return hit;
    } catch {}
  }
  return null;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Swap in the JSON-LD body when it is clearly fuller than what the DOM shows. */
function withJsonLd(html: string): string {
  const art = jsonLdArticle(html);
  if (!art || art.body.length < visibleText(html).length * 0.6) return html;
  const paras = art.body.split(/\n{1,}/).map((p) => `<p>${esc(p)}</p>`).join("");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px/1.6 Georgia,serif;max-width:42rem;margin:3rem auto;padding:0 1rem"><h1>${esc(art.title)}</h1>${paras}`;
}

/** Thrown when a fetch worked but the article looks truncated; carries the page for last-resort use. */
export class WalledError extends Error {
  constructor(public html: string, public baseUrl: string, public method: string) {
    super("still walled");
  }
}

function checkWalled(html: string, baseUrl: string, method: string): Result {
  const full = withJsonLd(html);
  const text = visibleText(full);
  const walled =
    text.length < 1500 ||
    (text.length < 6000 &&
      /(subscribe to (continue|read)|already a subscriber|create a free account to (continue|read)|you['’]ve reached your (free )?(article )?limit)/i.test(text));
  if (walled) throw new WalledError(full, baseUrl, method);
  return { html: full, baseUrl, method };
}

export async function googlebot(url: URL): Promise<Result> {
  const { html, finalUrl } = await get(url.href, {
    "user-agent": GOOGLEBOT,
    referer: "https://www.google.com/",
    "x-forwarded-for": "66.249.66.1",
    accept: "text/html",
  });
  return checkWalled(html, finalUrl, "googlebot");
}

export async function direct(url: URL): Promise<Result> {
  const { html, finalUrl } = await get(url.href, {
    "user-agent": BROWSER,
    accept: "text/html,application/xhtml+xml",
    "accept-language": "en-US,en;q=0.9",
  });
  return checkWalled(html, finalUrl, "direct");
}

export async function archiveToday(url: URL): Promise<Result> {
  const { html } = await get(`https://archive.ph/newest/${url.href}`, { "user-agent": GOOGLEBOT });
  return checkWalled(html, url.href, "archive.ph");
}

export async function wayback(url: URL): Promise<Result> {
  const { html } = await get(`https://web.archive.org/web/2/${url.href}`, { "user-agent": BROWSER }, 15000);
  return { html, baseUrl: url.href, method: "wayback" };
}

const attempt = (name: string, fn: (u: URL) => Promise<Result>, url: URL) =>
  fn(url).catch((e: Error) => {
    throw new Error(`${name}: ${e.message}`);
  });

export type Fetched = Result & { partial?: boolean };

/** Live fetches race in parallel; archives are the slower fallback; a truncated page beats nothing. */
export async function fetchReadable(url: URL): Promise<Fetched> {
  const errors: string[] = [];
  const partials: WalledError[] = [];
  const note = (errs: Error[]) =>
    errs.forEach((e) => {
      const cause = (e as Error & { cause?: unknown }).cause;
      if (cause instanceof WalledError) partials.push(cause);
      errors.push(e.message);
    });
  const run = (name: string, fn: (u: URL) => Promise<Result>) =>
    fn(url).catch((e: Error) => {
      const err = new Error(`${name}: ${e.message}`, { cause: e });
      throw err;
    });

  try {
    return await Promise.any([run("googlebot", googlebot), run("direct", direct)]);
  } catch (live) {
    note((live as AggregateError).errors);
  }
  try {
    return await Promise.any([run("archive.ph", archiveToday), run("wayback", wayback)]);
  } catch (arch) {
    note((arch as AggregateError).errors);
  }
  const best = partials.sort((a, b) => visibleText(b.html).length - visibleText(a.html).length)[0];
  if (best && visibleText(best.html).length > 800) {
    return { html: best.html, baseUrl: best.baseUrl, method: `${best.method}-partial`, partial: true };
  }
  throw new Error(errors.join(" | "));
}
