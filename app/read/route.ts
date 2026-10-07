import { NextRequest } from "next/server";
import { clean } from "@/lib/clean";
import { fetchReadable, validateUrl } from "@/lib/fetchers";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("Missing ?url=", { status: 400 });
  try {
    const url = await validateUrl(raw);
    const { html, baseUrl, method } = await fetchReadable(url);
    return new Response(clean(html, baseUrl), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-unpaywall-method": method,
        // Scripts are stripped, but belt-and-braces: nothing may execute in the proxied page.
        "content-security-policy": "script-src 'none'; frame-src 'none'; form-action 'none'",
        "referrer-policy": "no-referrer",
        "cache-control": "public, s-maxage=600",
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(
      `<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem"><h1>Couldn’t get that page</h1><p>${msg.replace(/</g, "&lt;")}</p><p><a href="/">Try another link</a></p>`,
      { status: 502, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
}
