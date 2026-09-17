#!/usr/bin/env node
/* Write a sync payload into index.html.
 *
 * For the case where the session that READ Kaplan is not the session that can
 * commit - a Cowork run driving Chrome, say. That run emits a JSON payload;
 * this script injects it into the SYNC block in index.html.
 *
 *   node tools/apply-payload.js payload.json
 *   node tools/apply-payload.js payload.json --dry     # show, write nothing
 *
 * Then always:
 *   node tools/sanity-check.js
 *
 * This exists so nobody hand-edits a number into the dashboard. Hand-editing
 * is how figures drift from the data that produced them.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HTML_PATH = path.join(ROOT, "index.html");
const BEGIN = "/* ===== BEGIN SYNC DATA";
const END = "/* ===== END SYNC DATA ===== */";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const file = args.find(a => !a.startsWith("--"));
if (!file) {
  console.error("usage: node tools/apply-payload.js <payload.json> [--dry]");
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
} catch (e) {
  console.error("Could not read or parse " + file + ": " + e.message);
  process.exit(2);
}

/* ------------------------------------------------------------------ shape */
const KEYS = ["meta", "unitTopicMap", "unitData", "mixedQuizzes", "kaplanQBank",
  "simExams", "weakSpots", "strongSpots", "missedQuestions", "answeredCorrect",
  "errorPatterns", "quickTips", "priorSnapshot"];
const ARRAYS = KEYS.filter(k => k !== "meta" && k !== "priorSnapshot");

const errors = [], warnings = [];
const isISO = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

if (!payload.meta || typeof payload.meta !== "object") errors.push("meta is missing");
for (const k of ARRAYS) {
  if (payload[k] === undefined) payload[k] = [];
  else if (!Array.isArray(payload[k])) errors.push(k + " must be an array");
}
if (payload.priorSnapshot === undefined) payload.priorSnapshot = null;
for (const k of Object.keys(payload)) {
  if (!KEYS.includes(k)) warnings.push("unknown key '" + k + "' will be dropped");
}

const m = payload.meta || {};
for (const d of ["lastVerified", "lastRunAttempted", "examDate", "lastActivityDate"]) {
  if (m[d] != null && !isISO(m[d])) errors.push("meta." + d + " must be YYYY-MM-DD or null, got " + JSON.stringify(m[d]));
}

/* ----------------------------------------- the never-fabricate guard rails */
const hasAnyData = (payload.unitData.length || payload.simExams.length
  || payload.kaplanQBank.length || payload.missedQuestions.length);

if (m.source === "kaplan" && !m.lastVerified) {
  errors.push("meta.source is 'kaplan' but meta.lastVerified is null - a verified run must carry the date it read");
}
if (m.lastVerified && !hasAnyData) {
  errors.push("meta.lastVerified is set but every data array is empty - a run that read nothing must not claim to have verified anything");
}
if (hasAnyData && !m.lastVerified) {
  errors.push("data is present but meta.lastVerified is null - populated data must carry the date it was read");
}
if (m.noDataRuns == null || typeof m.noDataRuns !== "number" || m.noDataRuns < 0) {
  errors.push("meta.noDataRuns must be a number >= 0");
}

/* ----------------------------------------------- unit / topic consistency */
const TOPICS = new Set(["I", "II", "III", "IV"]);
const unitIds = payload.unitData.map(u => u.id);
if (new Set(unitIds).size !== unitIds.length) errors.push("duplicate ids in unitData");

const mapIds = payload.unitTopicMap.map(u => u.id);
if (new Set(mapIds).size !== mapIds.length) errors.push("duplicate ids in unitTopicMap");

for (const mm of payload.unitTopicMap) {
  if (!mm.split || typeof mm.split !== "object") { errors.push("unitTopicMap " + mm.id + " has no split"); continue; }
  const sum = Object.values(mm.split).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) errors.push("unitTopicMap " + mm.id + " split sums to " + sum + ", must be exactly 1");
  for (const t of Object.keys(mm.split)) if (!TOPICS.has(t)) errors.push("unitTopicMap " + mm.id + " maps to unknown topic '" + t + "'");
}
const mapSet = new Set(mapIds);
const unmapped = unitIds.filter(id => !mapSet.has(id));
if (unmapped.length) {
  errors.push("unmapped units (excluded from every weighted figure): " + unmapped.join(", "));
}

for (const u of payload.unitData) {
  for (const f of ["qbankAnswered", "qbankCorrect", "examAnswered", "examCorrect"]) {
    if (u[f] != null && (typeof u[f] !== "number" || u[f] < 0)) errors.push(u.id + "." + f + " must be a non-negative number");
  }
  if ((u.qbankCorrect || 0) > (u.qbankAnswered || 0)) errors.push(u.id + ": qbankCorrect exceeds qbankAnswered");
  if ((u.examCorrect || 0) > (u.examAnswered || 0)) errors.push(u.id + ": examCorrect exceeds examAnswered");
}
for (const e of payload.simExams) {
  if (e.score > e.total) errors.push("exam '" + e.name + "': score exceeds total");
  if (!isISO(e.date)) errors.push("exam '" + e.name + "': date must be YYYY-MM-DD");
}
for (const t of payload.quickTips) {
  for (const f of ["trigger", "move"]) {
    if (!t[f]) errors.push("quickTip " + (t.id || "?") + " has no " + f);
  }
  for (const mid of (t.fromMisses || [])) {
    if (!payload.missedQuestions.some(q => q.id === mid)) {
      warnings.push("quickTip " + (t.id || "?") + " cites miss '" + mid + "' that is not in this payload");
    }
  }
}
for (const q of payload.missedQuestions) {
  for (const f of ["question", "myAnswer", "correctAnswer"]) {
    if (!q[f]) warnings.push("missed question " + (q.id || "?") + " has no " + f);
  }
  if (!q.explanation) warnings.push("missed question " + (q.id || "?") + " has no tutoring explanation - that is the highest-value field on the page");
}

/* --------------------------------------------------------------- report */
const counts = ARRAYS.map(k => "  " + k.padEnd(16) + payload[k].length).join("\n");
console.log("\nPayload: " + path.resolve(file));
console.log("  lastVerified    " + (m.lastVerified || "null"));
console.log("  source          " + (m.source || "null"));
console.log("  noDataRuns      " + m.noDataRuns);
console.log(counts);

if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log("  ! " + w);
}
if (errors.length) {
  console.log("\nRefusing to write - " + errors.length + " problem(s):");
  for (const e of errors) console.log("  x " + e);
  console.log("");
  process.exit(1);
}

/* ---------------------------------------------------------------- inject */
const html = fs.readFileSync(HTML_PATH, "utf8");
const i = html.indexOf(BEGIN);
const j = html.indexOf(END);
if (i < 0 || j < 0) {
  console.error("Could not find the SYNC DATA markers in index.html.");
  process.exit(1);
}
const header = html.slice(i, html.indexOf("const SYNC = {", i));
const ordered = {};
for (const k of KEYS) ordered[k] = payload[k];
const block = header + "const SYNC = " + JSON.stringify(ordered, null, 2) + ";\n";
const out = html.slice(0, i) + block + html.slice(j);

if (dry) {
  console.log("\n--dry: nothing written. The block would become:\n");
  console.log(block.slice(0, 1200) + (block.length > 1200 ? "\n  ...(" + block.length + " chars)" : ""));
  process.exit(0);
}
fs.writeFileSync(HTML_PATH, out);
console.log("\nWrote index.html.  Now run:  node tools/sanity-check.js\n");
