export default function Home() {
  return (
    <main>
      <h1>Unpaywall</h1>
      <p>Paste a link. Read the article.</p>
      <form action="/read" method="get">
        <input name="url" type="text" inputMode="url" placeholder="https://example.com/article" required autoFocus />
        <button type="submit">Read</button>
      </form>
      <small>Tries Googlebot access first, then archive.ph and the Wayback Machine. Not every site can be opened.</small>
    </main>
  );
}
