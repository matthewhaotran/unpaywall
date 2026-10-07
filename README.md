# Unpaywall

Paste a link, read the article. A small, independent take on the ladder 12ft.io made famous. Live at **unpaywall.matthew-tran.com**.

For each URL it tries, in order: (1) fetch as Googlebot, (2) archive.ph newest snapshot, (3) Wayback Machine. The result is stripped of scripts and paywall overlays and served with a locked-down CSP.

Stack: Next.js (App Router) on Vercel. `app/read/route.ts` is the proxy; `lib/fetchers.ts` holds the strategies and SSRF guard.

```bash
pnpm install
pnpm dev
```

Use only for content you have a right to read; some publishers' terms prohibit this.
