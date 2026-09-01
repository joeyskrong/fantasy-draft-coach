import { copyFileSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assets = join(dist, "assets");
const js = readdirSync(assets).find((f) => f.endsWith(".js"));
const css = readdirSync(assets).find((f) => f.endsWith(".css"));
if (!js || !css) throw new Error("Missing built assets");

const jsPath = join(assets, js);
const cssPath = join(assets, css);
const jsSource = readFileSync(jsPath, "utf8").replaceAll("</script>", "<\\/script>");
const cssSource = readFileSync(cssPath, "utf8");

// Cached phone pages still request older hashed filenames after a rebuild.
for (const alias of ["index.js", "index-C_5qJDui.js", "index-sJe2vCEy.js"]) {
  if (alias !== js) copyFileSync(jsPath, join(assets, alias));
}
for (const alias of ["index.css", "index-DyK9Rbj2.css"]) {
  if (alias !== css) copyFileSync(cssPath, join(assets, alias));
}

writeFileSync(
  join(dist, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#07090f" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Draft Coach" />
    <meta http-equiv="Cache-Control" content="no-store" />
    <title>Fantasy Draft Coach</title>
    <style>
      html, body, #root { background: #07090f; color: #e8eefc; min-height: 100%; margin: 0; }
      ${cssSource}
    </style>
  </head>
  <body>
    <div id="root">
      <p style="padding:24px;font-family:system-ui,sans-serif">Loading Draft Coach…</p>
    </div>
    <script>
      window.addEventListener("error", function () {
        var root = document.getElementById("root");
        if (!root || root.dataset.booted) return;
        root.innerHTML = '<p style="padding:24px;font-family:system-ui,sans-serif">Draft Coach failed to load. Close this tab and open the newest link.</p>';
      });
    </script>
    <script type="module">${jsSource}</script>
  </body>
</html>
`,
);

console.log(`inlined ${js} and ${css} into dist/index.html`);
