#!/usr/bin/env node
/* capture.mjs — you log in, this takes over.
 *
 * Opens a real Chromium window. You sign into Kaplan yourself, at the real login
 * page, and click through your progress / performance / QBank pages. Meanwhile this
 * records every JSON response the portal serves and writes it to ./captured/.
 *
 * It never asks for, sees, or stores your password. Request headers and cookies are
 * dropped on the floor — only response bodies are kept, and ./captured/ is gitignored.
 *
 *   node capture.mjs
 *   node capture.mjs --url https://your.kaplan.portal/dashboard
 *   node capture.mjs --auto        # also try to click through progress links itself
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "captured");
const NET = path.join(OUT, "network");
const PAGES = path.join(OUT, "pages");
const PROFILE = path.join(HERE, ".browser-profile");

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes("--" + name);

const START_URL = flag("url", process.env.KAPLAN_URL || "https://www.kaplanfinancial.com/");
const AUTO = has("auto");

/* Response URLs that are never course data — analytics, ads, session pings. */
const NOISE = [
  /google-analytics|googletagmanager|doubleclick|facebook|hotjar|segment\.io|mixpanel/i,
  /sentry\.io|bugsnag|newrelic|datadoghq|appdynamics|fullstory|clarity\.ms/i,
  /\/(telemetry|beacon|heartbeat|ping|log|collect|track|metrics)(\/|\?|$)/i,
  /\.(png|jpe?g|gif|svg|webp|woff2?|ttf|css|ico|mp4|m3u8)(\?|$)/i
];

/* Keys that suggest a payload actually holds performance data. */
const SIGNAL = /(correct|incorrect|answered|attempted|mastery|masteries|proficien|score|percent|pct|accuracy|complete|progress|question|quiz|exam|topic|chapter|unit|lesson|module|assignment|performance)/i;

function ensureDirs() {
  for (const d of [OUT, NET, PAGES]) fs.mkdirSync(d, { recursive: true });
}

function slugify(url) {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 90);
  } catch {
    return "response";
  }
}

/* How likely is this payload the thing we want? Crude but good enough to rank. */
function scorePayload(parsed) {
  let hits = 0, records = 0;
  const seen = new Set();
  (function walk(node, depth) {
    if (depth > 8 || node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      if (node.length && typeof node[0] === "object") records += node.length;
      node.slice(0, 60).forEach((v) => walk(v, depth + 1));
      return;
    }
    for (const k of Object.keys(node)) {
      if (SIGNAL.test(k)) hits++;
      walk(node[k], depth + 1);
    }
  })(parsed, 0);
  return { signalKeys: hits, records };
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function main() {
  ensureDirs();

  console.log("");
  console.log("  Series 66 importer");
  console.log("  " + "-".repeat(58));
  console.log("  A Chromium window is opening. In it:");
  console.log("    1. sign into Kaplan yourself (this script never sees your password)");
  console.log("    2. visit your progress / performance / QBank / exam-history pages");
  console.log("    3. come back here and press Enter");
  console.log("");
  console.log("  Everything the portal sends while you browse gets recorded to");
  console.log("  ./captured/ — your data, gitignored, yours to delete.");
  console.log("");

  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: null,
    args: ["--start-maximized"]
  });

  let n = 0;
  const manifest = [];
  const skipped = new Map();

  context.on("response", async (res) => {
    const url = res.url();
    if (NOISE.some((rx) => rx.test(url))) return;

    const ct = (res.headers()["content-type"] || "").toLowerCase();
    const looksJson = ct.includes("json") || /\.json(\?|$)/.test(url);
    if (!looksJson) {
      skipped.set(ct.split(";")[0] || "unknown", (skipped.get(ct.split(";")[0] || "unknown") || 0) + 1);
      return;
    }

    let text;
    try { text = await res.text(); } catch { return; }
    if (!text || text.length < 2) return;

    let parsed;
    try { parsed = JSON.parse(text); } catch { return; }

    const { signalKeys, records } = scorePayload(parsed);
    const id = String(++n).padStart(4, "0");
    const file = `${id}-${slugify(url)}.json`;

    /* only the response body and its URL — no request headers, no cookies, no tokens */
    fs.writeFileSync(
      path.join(NET, file),
      JSON.stringify({
        url,
        method: res.request().method(),
        status: res.status(),
        capturedAt: new Date().toISOString(),
        signalKeys,
        records,
        body: parsed
      }, null, 2)
    );

    manifest.push({ file, url, status: res.status(), bytes: text.length, signalKeys, records });
    process.stdout.write(
      `  [${id}] ${signalKeys ? String(signalKeys).padStart(3) + " signal keys" : "  no signal  "}  ` +
      `${String(records).padStart(4)} recs  ${url.slice(0, 96)}\n`
    );
  });

  const page = context.pages()[0] || await context.newPage();
  try {
    await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.log(`  Could not open ${START_URL} (${e.message.split("\n")[0]}).`);
    console.log("  Navigate to your Kaplan portal in the window by hand instead.\n");
  }

  if (AUTO) {
    await prompt("  Press Enter once you are LOGGED IN and I'll click through progress links... ");
    const wanted = /progress|performance|mastery|qbank|question bank|gradebook|my course|assignments|exam/i;
    const links = await page.$$eval("a", (as) =>
      as.map((a) => ({ text: (a.textContent || "").trim(), href: a.href })));
    const targets = [...new Map(
      links.filter((l) => l.href && wanted.test(l.text)).map((l) => [l.href, l])
    ).values()].slice(0, 12);
    console.log(`  Found ${targets.length} candidate pages; visiting them one at a time.`);
    for (const t of targets) {
      try {
        console.log(`    -> ${t.text || t.href}`);
        await page.goto(t.href, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(1200);             /* deliberately unhurried */
      } catch { /* a page that won't load is not worth stopping for */ }
    }
  }

  await prompt("\n  Press Enter when you're done browsing to save everything... ");

  /* snapshot whatever tabs are open — useful when the data is in HTML, not JSON */
  const open = context.pages();
  for (let i = 0; i < open.length; i++) {
    const p = open[i];
    const tag = String(i + 1).padStart(2, "0");
    try {
      fs.writeFileSync(path.join(PAGES, `${tag}.html`), await p.content());
      fs.writeFileSync(path.join(PAGES, `${tag}.url.txt`), p.url());
      await p.screenshot({ path: path.join(PAGES, `${tag}.png`), fullPage: true });
    } catch { /* a page mid-navigation can't be snapshotted; skip it */ }
  }

  manifest.sort((a, b) => b.signalKeys - a.signalKeys || b.records - a.records);
  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ capturedAt: new Date().toISOString(), startUrl: START_URL, responses: manifest }, null, 2)
  );

  await context.close();

  console.log("\n  " + "-".repeat(58));
  console.log(`  ${manifest.length} JSON responses saved to importer/captured/network/`);
  console.log(`  ${open.length} page snapshot(s) saved to importer/captured/pages/`);
  if (skipped.size) {
    console.log("  (skipped non-JSON: " +
      [...skipped.entries()].map(([k, v]) => `${k}×${v}`).join(", ") + ")");
  }

  const top = manifest.filter((m) => m.signalKeys > 0).slice(0, 12);
  if (top.length) {
    console.log("\n  Most promising payloads:");
    for (const m of top) {
      console.log(`    ${String(m.signalKeys).padStart(3)} keys  ${String(m.records).padStart(4)} recs  ${m.file}`);
      console.log(`         ${m.url}`);
    }
  } else {
    console.log("\n  Nothing scored as performance data. Either the portal renders progress");
    console.log("  server-side (check captured/pages/*.html) or you didn't reach a progress page.");
  }

  console.log("\n  Next: node parse.mjs\n");
}

main().catch((e) => { console.error("\n  Failed:", e.message, "\n"); process.exit(1); });
