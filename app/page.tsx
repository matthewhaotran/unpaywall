"use client";

import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"proxy" | "archive">("proxy");

  function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("url") ?? "").trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    window.location.href =
      mode === "archive" ? `https://archive.ph/newest/${encodeURI(url)}` : `/read?url=${encodeURIComponent(url)}`;
  }

  return (
    <main>
      <h1>Unpaywall</h1>
      <p className="tag">Paste a link. Read the article.</p>
      <form onSubmit={go}>
        <input name="url" type="text" inputMode="url" placeholder="https://example.com/article" required autoFocus />
        <button type="submit">Read</button>
      </form>
      <label className="opt">
        <input type="checkbox" checked={mode === "archive"} onChange={(e) => setMode(e.target.checked ? "archive" : "proxy")} />
        Open via archive.ph instead (better for NYT, WSJ, Bloomberg)
      </label>
      <section className="about">
        <h2>What is this?</h2>
        <p>
          Unpaywall opens news and magazine articles that are hidden behind soft paywalls, metered limits and “subscribe to continue”
          overlays. Paste a link and it fetches a readable copy, strips the pop-ups and scripts, and shows you the text. It’s for
          the moment you just want to read one article you were sent, without signing up for another subscription.
        </p>
        <p>
          If a site blocks our server, you’ll get a one-click link to open the same article on archive.ph or the Wayback Machine from
          your own browser, which publishers rarely block.
        </p>
        <p className="homage">
          A tip of the hat to <a href="https://12ft.io" rel="noopener noreferrer">12ft.io</a>, the original “ten-foot paywall,
          twelve-foot ladder” site that made this idea famous. This is a small, independent take on the same ladder.
        </p>
        <p className="fine">
          Please support journalism you value and subscribe where you can. Some publishers’ terms restrict this kind of access, so
          use it responsibly.
        </p>
      </section>
      <small>
        Default tries Googlebot access, then archives, from our server. Big publishers block that, so we’ll offer an archive link from
        your own browser when it fails.
      </small>
    </main>
  );
}
