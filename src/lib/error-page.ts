export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #0e0f1a;
        --text: #f0f1f3;
        --muted: #7d8693;
        --card-bg: #161824;
        --border: rgba(255, 255, 255, 0.08);
        --primary-bg: #4cd8e0;
        --primary-fg: #0e0f1a;
        --secondary-bg: transparent;
        --secondary-border: rgba(255, 255, 255, 0.16);
      }
      @media (prefers-color-scheme: light) {
        :root {
          --bg: #fafafa;
          --text: #111;
          --muted: #4b5563;
          --card-bg: #ffffff;
          --border: #e5e7eb;
          --primary-bg: #111;
          --primary-fg: #ffffff;
          --secondary-bg: #ffffff;
          --secondary-border: #d1d5db;
        }
      }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: var(--primary-bg); color: var(--primary-fg); }
      .secondary { background: var(--secondary-bg); color: var(--text); border-color: var(--secondary-border); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
