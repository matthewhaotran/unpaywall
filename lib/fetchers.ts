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

/** A fetch looks "walled" if it's tiny or says so. Heuristic only. */
function looksWalled(html: string): boolean {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (text.length < 1500) return true;
  return /(subscribe to (continue|read)|already a subscriber|create a free account to (continue|read)|you['’]ve reached your (free )?(article )?limit)/i.test(
    text.slice(0, 6000),
  );
}

export async function googlebot(url: URL): Promise<Result> {
  const { html, finalUrl } = await get(url.href, {
    "user-agent": GOOGLEBOT,
    referer: "https://www.google.com/",
    "x-forwarded-for": "66.249.66.1",
    accept: "text/html",
  });
  if (looksWalled(html)) throw new Error("still walled");
  return { html, baseUrl: finalUrl, method: "googlebot" };
}

export async function direct(url: URL): Promise<Result> {
  const { html, finalUrl } = await get(url.href, {
    "user-agent": BROWSER,
    accept: "text/html,application/xhtml+xml",
    "accept-language": "en-US,en;q=0.9",
  });
  if (looksWalled(html)) throw new Error("still walled");
  return { html, baseUrl: finalUrl, method: "direct" };
}

export async function archiveToday(url: URL): Promise<Result> {
  const { html } = await get(`https://archive.ph/newest/${url.href}`, { "user-agent": GOOGLEBOT });
  if (looksWalled(html)) throw new Error("archive miss");
  return { html, baseUrl: url.href, method: "archive.ph" };
}

export async function wayback(url: URL): Promise<Result> {
  const { html } = await get(`https://web.archive.org/web/2/${url.href}`, { "user-agent": BROWSER }, 15000);
  return { html, baseUrl: url.href, method: "wayback" };
}

const attempt = (name: string, fn: (u: URL) => Promise<Result>, url: URL) =>
  fn(url).catch((e: Error) => {
    throw new Error(`${name}: ${e.message}`);
  });

/** Live fetches race in parallel; archives are the slower fallback. */
export async function fetchReadable(url: URL): Promise<Result> {
  try {
    return await Promise.any([attempt("googlebot", googlebot, url), attempt("direct", direct, url)]);
  } catch (live) {
    const errors = (live as AggregateError).errors.map((e: Error) => e.message);
    try {
      return await Promise.any([attempt("archive.ph", archiveToday, url), attempt("wayback", wayback, url)]);
    } catch (arch) {
      errors.push(...(arch as AggregateError).errors.map((e: Error) => e.message));
      throw new Error(errors.join(" | "));
    }
  }
}
