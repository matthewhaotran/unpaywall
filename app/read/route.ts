import { NextRequest } from "next/server";
import { clean } from "@/lib/clean";
import { archiveLink, failurePage } from "@/lib/links";
import { fetchReadable, validateUrl } from "@/lib/fetchers";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("Missing ?url=", { status: 400 });
  try {
    const url = await validateUrl(raw);
    const { html, baseUrl, method, partial } = await fetchReadable(url);
    const banner = partial
      ? `<div style="font:14px system-ui;background:#fff8e1;color:#5d4200;padding:.6rem 1rem;border-bottom:1px solid #e6d28a">This may be only part of the article. <a href="${archiveLink(url.href)}">Try archive.ph</a> from your own browser.</div>`
      : "";
    return new Response(banner ? clean(html, baseUrl).replace(/<body[^>]*>/i, (m) => m + banner) : clean(html, baseUrl), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-unpaywall-method": method,
        "x-unpaywall-partial": String(!!partial),
        // Scripts are stripped, but belt-and-braces: nothing may execute in the proxied page.
        "content-security-policy": "script-src 'none'; frame-src 'none'; form-action 'none'",
        "referrer-policy": "no-referrer",
        "cache-control": "public, s-maxage=600",
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(failurePage(raw, msg), {
      status: 502,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}
