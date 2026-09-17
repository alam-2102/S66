#!/usr/bin/env node
/* Series 66 dashboard sanity check.
 *
 * Tooling, not the deliverable. Extracts the inline <script> block out of
 * index.html, runs it against a stubbed DOM, and asserts the things that have
 * actually broken before. Run it before every commit; do not push a file that
 * fails it.
 *
 *   node tools/sanity-check.js
 *
 * Exit 0 = clean, exit 1 = at least one assertion failed.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

let failures = 0, checks = 0;
function ok(name, detail)   { checks++; console.log("  PASS  " + name + (detail ? "  " + detail : "")); }
function bad(name, detail)  { checks++; failures++; console.log("  FAIL  " + name + (detail ? "  " + detail : "")); }
function assert(cond, name, detail) { cond ? ok(name, detail) : bad(name, detail); }

/* ------------------------------------------------------------------ extract */
const m = HTML.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!m) { console.error("FATAL: could not find the inline <script> block in index.html"); process.exit(1); }
const SOURCE = m[1];

/* data-bind keys that appear in the STATIC markup. Scanned with the <script>
   and <style> blocks stripped, so the bound() helper's own string literal in
   the source is not mistaken for a real binding. */
const MARKUP = HTML.replace(/<script>[\s\S]*?<\/script>/g, "")
                   .replace(/<style>[\s\S]*?<\/style>/g, "");
const staticBinds = new Set();
for (const mm of MARKUP.matchAll(/data-bind="([^"]+)"/g)) staticBinds.add(mm[1]);

/* ---------------------------------------------------------------- DOM stub */
/* Records every data-bind key that reaches the DOM, whether it was typed into
   the static HTML or emitted by a renderer into innerHTML. */
const seenBinds = new Set(staticBinds);
const nodeStore = new Map();

function collectBinds(html) {
  if (typeof html !== "string") return;
  for (const mm of html.matchAll(/data-bind="([^"]+)"/g)) seenBinds.add(mm[1]);
}

function makeEl(id) {
  const el = {
    id: id || "", _html: "", _text: "", hidden: false, style: {},
    dataset: {}, classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
    attributes: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); collectBinds(this._html); },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    setAttribute(k, v) { this.attributes[k] = String(v); if (k === "data-bind") seenBinds.add(String(v)); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    appendChild() {},
    getContext() { return {}; }
  };
  return el;
}

/* Every data-bind key currently known, surfaced as bindable nodes so that
   bindAll() genuinely walks them and reports the unresolved ones. */
function bindNodes() {
  return Array.from(seenBinds).map(key => {
    const el = makeEl("");
    el.attributes["data-bind"] = key;
    return el;
  });
}

const documentStub = {
  readyState: "complete",
  getElementById(id) {
    if (!nodeStore.has(id)) nodeStore.set(id, makeEl(id));
    return nodeStore.get(id);
  },
  createElement(tag) { const el = makeEl(""); el.tagName = String(tag).toUpperCase(); return el; },
  querySelectorAll(sel) {
    if (sel === "[data-bind]") return bindNodes();
    return [];
  },
  querySelector() { return null; },
  addEventListener() {},
  body: makeEl("body"),
  documentElement: makeEl("html")
};

/* A fake Chart that records construction, so chart code is exercised without
   a real canvas. */
let chartsBuilt = 0;
function FakeChart() { chartsBuilt++; this.destroy = function () {}; }

const localStorageStub = {
  getItem() { throw new Error("localStorage unavailable"); },  // correctness must not depend on it
  setItem() { throw new Error("localStorage unavailable"); }
};

const sandbox = {
  document: documentStub,
  navigator: { clipboard: null },
  console: { log() {}, warn() {}, error() {} },
  setTimeout: () => 0,
  clearTimeout: () => {},
  Chart: FakeChart,
  localStorage: localStorageStub,
  Intl,
  Date, Math, JSON, String, Number, Boolean, Array, Object, Set, Map, RegExp, Error,
  isFinite, parseInt, parseFloat
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.getSelection = () => ({ removeAllRanges() {}, addRange() {} });

/* ------------------------------------------------------------------- run it */
const EXPORTS = `
;globalThis.__X__ = {
  nasaaData, EXAM, META, unitData, mixedQuizzes, kaplanQBank, simExams,
  UNIT_TOPIC_MAP, missedQuestions, errorPatterns,
  pooledTotals, topicTotals, unitPool, buildBindings, bindAll, renderAll,
  renderSimulated, renderPerformance, buildPaste, MISSING_BINDS
};`;

let X;
try {
  vm.createContext(sandbox);
  new vm.Script(SOURCE + EXPORTS, { filename: "index.html:inline" }).runInContext(sandbox);
  X = sandbox.__X__;
  ok("inline script parses and runs with no error");
} catch (e) {
  bad("inline script parses and runs with no error", "\n        " + (e && e.stack || e));
  console.log("\n" + checks + " checks, " + failures + " failed");
  process.exit(1);
}

console.log("\nSeries 66 dashboard sanity check\n");

/* -------------------------------------------------- 1. blueprint constants */
{
  const t = X.nasaaData.topics;
  const sumW = t.reduce((a, b) => a + b.weight, 0);
  const sumQ = t.reduce((a, b) => a + b.questions, 0);
  assert(sumW === 100, "topic weights sum to 100", "got " + sumW);
  assert(sumQ === 100, "topic question counts sum to 100", "got " + sumQ);
  assert(X.EXAM.PASS_LINE === 73, "pass line is 73 (not the Series 7's 72, not 75)",
    "got " + X.EXAM.PASS_LINE);
  const expect = { I: 8, II: 17, III: 30, IV: 45 };
  const actual = {}; t.forEach(x => actual[x.id] = x.weight);
  assert(JSON.stringify(expect) === JSON.stringify(actual),
    "weights match NASAA's published 8/17/30/45",
    JSON.stringify(actual));
}

/* ------------------------------------- 2. pooled score, recomputed independently */
{
  /* Deliberately NOT reusing the page's own helpers - recompute from the raw
     arrays and compare, so a bug in pooledTotals() cannot hide itself. */
  let correct = 0, answered = 0;
  for (const u of X.unitData) {
    correct  += (u.qbankCorrect  || 0) + (u.examCorrect  || 0);
    answered += (u.qbankAnswered || 0) + (u.examAnswered || 0);
  }
  const independent = answered ? (correct / answered) * 100 : null;
  const reported = X.pooledTotals();
  const same = (independent === null && reported.pct === null)
    || (independent !== null && reported.pct !== null && Math.abs(independent - reported.pct) < 1e-9);
  assert(same, "pooled score matches an independent recomputation",
    "independent=" + (independent === null ? "null" : independent.toFixed(4))
    + " page=" + (reported.pct === null ? "null" : reported.pct.toFixed(4)));

  /* mixed quizzes and sim exams must NOT be inside the pool */
  let mixedAnswered = 0;
  for (const u of X.unitData) mixedAnswered += (u.mixedAnswered || 0);
  assert(reported.answered === answered,
    "mixed quizzes and sim exams are excluded from the pool (no double-count)",
    "pool=" + reported.answered + " mixed-held-out=" + mixedAnswered);
}

/* ------------------------------------------- 3. unit -> topic map integrity */
{
  const topicIds = new Set(X.nasaaData.topics.map(t => t.id));
  let badSplit = [], unmapped = [], unknownTopic = [];
  for (const u of X.unitData) {
    const mm = X.UNIT_TOPIC_MAP.find(x => x.id === u.id);
    if (!mm) { unmapped.push(u.id); continue; }
    const sum = Object.values(mm.split).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-9) badSplit.push(u.id + " (" + sum + ")");
    for (const tid of Object.keys(mm.split)) if (!topicIds.has(tid)) unknownTopic.push(u.id + "->" + tid);
  }
  assert(unmapped.length === 0,
    "every unit in unitData resolves into the topic buckets",
    unmapped.length ? "unmapped: " + unmapped.join(", ") : "(" + X.unitData.length + " units)");
  assert(badSplit.length === 0,
    "each unit's split weights sum to exactly 1 (no unit double-counted or dropped)",
    badSplit.length ? badSplit.join(", ") : "");
  assert(unknownTopic.length === 0,
    "no unit maps to a topic id outside the NASAA blueprint",
    unknownTopic.join(", "));

  /* duplicate unit ids would silently corrupt every rollup */
  const ids = X.unitData.map(u => u.id);
  assert(new Set(ids).size === ids.length, "unit ids are unique");
  const mapIds = X.UNIT_TOPIC_MAP.map(u => u.id);
  assert(new Set(mapIds).size === mapIds.length, "unit-topic map has no duplicate entries");
}

/* ------------------------------------------ 4. renderSimulated is idempotent */
function rowCount(html) { return (String(html).match(/<tr/g) || []).length; }
{
  const detail = sandbox.document.getElementById("exam-detail");
  const counts = [];
  for (let i = 0; i < 5; i++) { X.renderSimulated(0); counts.push(rowCount(detail.innerHTML)); }
  const stable = counts.every(c => c === counts[0]);
  assert(stable, "renderSimulated(0) x5 produces a stable row count",
    "[" + counts.join(", ") + "]" + (X.simExams.length ? "" : " (no exams logged yet)"));

  /* With no exams the check above is vacuous, so run it again against an
     in-memory fixture that exists ONLY inside this test process. It is never
     written to index.html and never reaches the dashboard. */
  if (X.simExams.length === 0) {
    X.simExams.push({
      name: "__TEST_FIXTURE__", date: "2026-01-01", score: 70, total: 100,
      timeUsed: 140, timeAllowed: 150,
      byTopic: { I: { answered: 8, correct: 5 }, IV: { answered: 45, correct: 30 } },
      byUnit:  { __fixture__: { answered: 10, correct: 6 } },
      segments: [{ label: "1-25", missed: 5 }, { label: "26-50", missed: 9 }],
      missCats: { "misread the question": 3 }
    });
    const c2 = [];
    for (let i = 0; i < 5; i++) { X.renderSimulated(0); c2.push(rowCount(detail.innerHTML)); }
    const stable2 = c2.every(c => c === c2[0]) && c2[0] > 0;
    assert(stable2, "renderSimulated(0) x5 stable against a test fixture",
      "[" + c2.join(", ") + "] rows");
    X.simExams.length = 0;
    X.renderSimulated(0);
  }
}

/* --------------------------------------------- 5. every data-bind resolves */
{
  /* Render everything first so generated markup contributes its bindings too. */
  try { X.renderAll(); } catch (e) { bad("renderAll() completes", String(e && e.message || e)); }
  const missing = X.bindAll();
  const keys = X.buildBindings();
  const unresolved = Array.from(seenBinds).filter(k => !Object.prototype.hasOwnProperty.call(keys, k));
  assert(unresolved.length === 0,
    "every data-bind attribute resolves to a real binding key",
    unresolved.length ? "\n        unresolved: " + unresolved.join("\n        unresolved: ")
                      : "(" + seenBinds.size + " bindings checked, "
                        + staticBinds.size + " of them in static HTML)");
  assert(missing.length === 0, "bindAll() reports no unresolved keys at runtime",
    missing.length ? missing.join(", ") : "");
}

/* ------------------------------------- 6. no typed performance figures in HTML */
{
  /* The pass line and target must never be typed into the markup - they are
     bound. Catch a literal "73%"/"81%" outside the <script> and <style>. */
  const typedPass = /(^|[^\d.])73\s?%/.test(MARKUP);
  const typedTarget = /(^|[^\d.])81\s?%/.test(MARKUP);
  assert(!typedPass && !typedTarget,
    "pass line and target average are bound, not typed into the markup",
    (typedPass ? "found a literal 73% " : "") + (typedTarget ? "found a literal 81%" : ""));
}

/* ------------------------------------------------ 7. paste variants generate */
{
  for (const v of ["full", "delta", "focused", "quiz"]) {
    let text = "";
    try { text = X.buildPaste(v); } catch (e) { text = ""; }
    assert(typeof text === "string" && text.length > 200,
      "Claude Paste variant '" + v + "' generates", text.length + " chars");
  }
  const full = X.buildPaste("full");
  assert(/AS OF:/.test(full), "full briefing carries an 'as of' line");
  assert(/HOW I WANT TO BE HELPED/.test(full), "full briefing carries the how-to-help instructions");
  assert(/73%/.test(full), "full briefing states the pass line");
  const delta = X.buildPaste("delta");
  assert(/SUPERSEDES ALL EARLIER FIGURES|NO PRIOR SNAPSHOT/.test(delta),
    "delta briefing opens with a supersede line, or says no snapshot exists");
  /* every miss must reach the full briefing - it is the highest-value payload */
  const missed = X.missedQuestions.length;
  const inBrief = (full.match(/^- Q: /gm) || []).length;
  assert(missed === 0 || inBrief === missed,
    "every missed question reaches the full briefing",
    inBrief + " of " + missed);
}

/* ------------------------------------------------ 8. empty means empty */
{
  const populated = X.unitData.length || X.simExams.length || X.missedQuestions.length;
  if (!populated) {
    assert(X.META.lastVerified === null && X.META.source === null,
      "with empty arrays, nothing claims to have been verified");
    const P = X.pooledTotals();
    assert(P.pct === null, "with empty arrays the pooled score is null, not 0");
  } else {
    assert(X.META.lastVerified !== null,
      "populated data carries a lastVerified date");
  }
}

console.log("\n" + checks + " checks, " + failures + " failed\n");
process.exit(failures ? 1 : 0);
