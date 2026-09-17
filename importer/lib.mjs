/* Shared bits: reading/writing data/progress.js, and mapping Kaplan unit names
 * onto the four NASAA content areas. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");
export const PROGRESS_FILE = path.join(ROOT, "data", "progress.js");
export const MAPPING_FILE = path.join(HERE, "mapping.json");

export const AREA_IDS = ["econ", "vehicles", "recommendations", "laws"];

/* Ordered most-specific first: "Investment Adviser Registration" must land in
 * laws, not vehicles, so the law patterns get first look. */
const AREA_PATTERNS = [
  ["laws", /\b(law|legal|regulat|registrat|licens|ethic|unethical|prohibit|fiduciar|agency|agent|adviser|advisor|broker.?dealer|blue.?sky|uniform (securities|state)|nasaa|usa\b|sec\b|finra|state (securities|administrat)|administrat|jurisdiction|exemption|enforcement|remedies|civil|criminal|liabilit|recordkeep|custody|advertis|disclos|conflict of interest|insider|fraud|antifraud)/i],
  ["econ", /\b(econom|macro|micro|business cycle|business information|gdp|inflation|deflation|interest rate|monetary|fiscal|yield curve|financial statement|balance sheet|income statement|cash flow|ratio analys|currency|exchange rate|indicator)/i],
  ["recommendations", /\b(client|customer|suitab|profil|recommend|strateg|portfolio|asset allocation|diversif|modern portfolio|capital market|risk (toler|profile|manage|measure)|return|alpha|beta|sharpe|benchmark|performance measure|tax|taxation|retirement|qualified plan|ira\b|401|pension|estate|trust|insurance need|time horizon|investment objective|liquidity need|behavioral)/i],
  ["vehicles", /\b(vehicle|equit|stock|share|preferred|common|debt|bond|note|bill|treasur|municipal|corporate|convertible|pooled|mutual fund|closed.?end|open.?end|etf|exchange.?traded|uit|unit investment|reit|hedge fund|private (equity|placement)|dpp|limited partnership|option|derivativ|future|forward|swap|warrant|annuit|variable|life insurance|commodit|precious metal|cash equivalent|money market)/i]
];

export function loadMapping() {
  try {
    const raw = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8"));
    return {
      areaOverrides: raw.areaOverrides || {},
      endpoints: raw.endpoints || [],
      ignoreUnits: raw.ignoreUnits || []
    };
  } catch {
    return { areaOverrides: {}, endpoints: [], ignoreUnits: [] };
  }
}

/* name -> area id, or null when nothing matches (the dashboard says so out loud) */
export function areaFor(name, overrides = {}) {
  const n = String(name || "");
  for (const [needle, area] of Object.entries(overrides)) {
    if (n.toLowerCase().includes(needle.toLowerCase())) {
      return AREA_IDS.includes(area) ? area : null;
    }
  }
  for (const [area, rx] of AREA_PATTERNS) {
    if (rx.test(n)) return area;
  }
  return null;
}

/* data/progress.js is a plain assignment to `window`, so running it against a
 * stand-in object is enough to read it back. */
export function readProgress() {
  const src = fs.readFileSync(PROGRESS_FILE, "utf8");
  const win = {};
  new Function("window", src)(win);
  const d = win.S66_DATA || {};
  return {
    meta: d.meta || {},
    units: d.units || [],
    areas: d.areas || {},
    qbank: d.qbank || [],
    exams: d.exams || [],
    study: d.study || [],
    assignments: d.assignments || []
  };
}

const HEADER = `/* Your Series 66 progress — GENERATED, edits get overwritten.
 *
 * Written by importer/parse.mjs (Kaplan import) or importer/log.mjs (hand-logged).
 * Shape is documented in data/schema.md. Hand-editing is fine, just know that the
 * next import replaces the file; keep anything permanent in data/exam.js instead.
 */
`;

export function writeProgress(data, source) {
  const out = {
    meta: {
      lastUpdated: new Date().toISOString(),
      source: source || data.meta?.source || "manual",
      examDate: data.meta?.examDate ?? null,
      targets: {
        qbankAccuracyPct: data.meta?.targets?.qbankAccuracyPct ?? 70,
        examScorePct: data.meta?.targets?.examScorePct ?? 80,
        courseCompletePct: data.meta?.targets?.courseCompletePct ?? 100
      }
    },
    units: data.units || [],
    areas: data.areas || {},
    qbank: data.qbank || [],
    exams: data.exams || [],
    study: data.study || [],
    assignments: data.assignments || []
  };
  fs.writeFileSync(
    PROGRESS_FILE,
    HEADER + "window.S66_DATA = " + JSON.stringify(out, null, 2) + ";\n"
  );
  return out;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
