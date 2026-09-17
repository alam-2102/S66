#!/usr/bin/env node
/* parse.mjs — turn what capture.mjs recorded into data/progress.js.
 *
 * Kaplan's payload shapes aren't published, so this works by field-name families
 * rather than hardcoded paths: it hunts for arrays of objects that carry both a
 * name and some performance numbers, then maps each unit onto a content area.
 *
 *   node parse.mjs              # extract and write ../data/progress.js
 *   node parse.mjs --dry        # show what it found, write nothing
 *   node parse.mjs --inspect    # dump candidate arrays and their keys, write nothing
 *   node parse.mjs --merge      # keep existing study[]/exams[] entries, add new ones
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProgress, writeProgress, loadMapping, areaFor, AREA_IDS } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NET = path.join(HERE, "captured", "network");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const INSPECT = argv.includes("--inspect");
const MERGE = argv.includes("--merge");

/* ---------- field-name families ---------- */

const F = {
  name: [/^(name|title|displayName|label|text)$/i,
         /^(topic|chapter|unit|module|lesson|section|subject|category)(Name|Title|Label)?$/i],
  answered: [/^(questions?Answered|answered|attempted|questions?Attempted|totalAnswered|numAnswered|answeredCount|questionsSeen|totalQuestions|questionCount)$/i],
  correct: [/^(questions?Correct|correct|numCorrect|correctCount|totalCorrect|rightAnswers|correctAnswers)$/i],
  incorrect: [/^(questions?Incorrect|incorrect|numIncorrect|incorrectCount|wrongAnswers|missed)$/i],
  percent: [/^(percentCorrect|pctCorrect|percentage|percent|accuracy|scorePercent|masteryScore|mastery|proficiency|proficiencyScore|performance)$/i],
  score: [/^(score|examScore|finalScore|result|grade)$/i],
  lessonsTotal: [/^(totalLessons|lessonsTotal|lessonCount|totalItems|itemCount|totalTopics)$/i],
  lessonsDone: [/^(completedLessons|lessonsComplete|lessonsCompleted|completedItems|itemsComplete|completedCount|completed)$/i],
  completePct: [/^(percentComplete|pctComplete|completionPercent|progressPercent|progress)$/i],
  date: [/^(date|completedDate|completedOn|takenOn|takenAt|submittedAt|startedAt|endedAt|createdAt|timestamp|attemptDate|sessionDate)$/i],
  minutes: [/^(minutes|durationMinutes|timeSpentMinutes|elapsedMinutes)$/i],
  seconds: [/^(seconds|durationSeconds|timeSpent|timeSpentSeconds|elapsedSeconds|duration)$/i],
  id: [/^(id|_id|uuid|guid|topicId|chapterId|unitId|moduleId|code)$/i]
};

function pick(obj, family) {
  for (const rx of family) {
    for (const k of Object.keys(obj)) {
      if (rx.test(k)) {
        const v = obj[k];
        if (v !== null && v !== undefined && v !== "") return v;
      }
    }
  }
  return undefined;
}
const asNum = (v) => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[,%\s]/g, ""));
    if (isFinite(n)) return n;
  }
  return undefined;
};
const asDate = (v) => {
  if (!v) return undefined;
  const d = new Date(typeof v === "number" && v > 1e11 ? v : v);
  return isNaN(d) ? undefined : d.toISOString().slice(0, 10);
};

/* ---------- walk every payload, collect candidate arrays ---------- */

function collectArrays(root, urlTag) {
  const found = [];
  const seen = new Set();
  (function walk(node, trail, depth) {
    if (depth > 9 || node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      const objs = node.filter((v) => v && typeof v === "object" && !Array.isArray(v));
      if (objs.length >= 2) {
        const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))];
        found.push({ path: trail || "$", rows: objs, keys, url: urlTag });
      }
      objs.slice(0, 40).forEach((v, i) => walk(v, `${trail}[${i}]`, depth + 1));
      return;
    }
    for (const k of Object.keys(node)) walk(node[k], trail ? `${trail}.${k}` : k, depth + 1);
  })(root, "", 0);
  return found;
}

function loadCaptures() {
  if (!fs.existsSync(NET)) return [];
  const { endpoints } = loadMapping();
  return fs.readdirSync(NET)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return { file: f, ...JSON.parse(fs.readFileSync(path.join(NET, f), "utf8")) }; }
      catch { return null; }
    })
    .filter(Boolean)
    .filter((c) => !endpoints.length || endpoints.some((e) => String(c.url).includes(e)));
}

/* ---------- scoring: which array is the unit list? ---------- */

function scoreUnitArray(cand) {
  let named = 0, perf = 0;
  for (const row of cand.rows) {
    if (pick(row, F.name) !== undefined) named++;
    const hasPerf =
      asNum(pick(row, F.answered)) !== undefined ||
      asNum(pick(row, F.correct)) !== undefined ||
      asNum(pick(row, F.percent)) !== undefined ||
      asNum(pick(row, F.completePct)) !== undefined;
    if (hasPerf) perf++;
  }
  if (!named || !perf) return 0;
  /* prefer arrays where most rows look like units, and where names map to areas */
  const mapped = cand.rows.filter((r) => areaFor(pick(r, F.name), {})).length;
  return named * 2 + perf * 3 + mapped * 4;
}

function toUnit(row, i, overrides) {
  const name = String(pick(row, F.name) ?? `Unit ${i + 1}`).trim();
  let answered = asNum(pick(row, F.answered));
  let correct = asNum(pick(row, F.correct));
  const incorrect = asNum(pick(row, F.incorrect));
  let percent = asNum(pick(row, F.percent));

  if (answered === undefined && correct !== undefined && incorrect !== undefined) {
    answered = correct + incorrect;
  }
  if (correct === undefined && answered !== undefined && percent !== undefined) {
    correct = Math.round(answered * (percent > 1 ? percent / 100 : percent));
  }
  if (percent !== undefined && percent <= 1) percent = percent * 100;
  if (percent === undefined && answered > 0 && correct !== undefined) {
    percent = correct / answered * 100;
  }

  const lt = asNum(pick(row, F.lessonsTotal));
  const ld = asNum(pick(row, F.lessonsDone));
  const cp = asNum(pick(row, F.completePct));

  const rawId = pick(row, F.id);
  return {
    id: String(rawId ?? (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || `u${i + 1}`)),
    name,
    area: areaFor(name, overrides),
    answered: answered ?? 0,
    correct: correct ?? 0,
    masteryPct: percent === undefined ? null : Math.round(percent * 10) / 10,
    lessonsTotal: lt ?? null,
    lessonsComplete: ld !== undefined ? ld
      : (lt !== undefined && cp !== undefined ? Math.round(lt * (cp > 1 ? cp / 100 : cp)) : null)
  };
}

/* ---------- exam-attempt arrays ---------- */

function scoreExamArray(cand) {
  let dated = 0, scored = 0;
  for (const row of cand.rows) {
    if (asDate(pick(row, F.date)) !== undefined) dated++;
    if (asNum(pick(row, F.score)) !== undefined || asNum(pick(row, F.percent)) !== undefined) scored++;
  }
  const looksExam = /exam|attempt|test|mastery|quiz|session|history/i.test(cand.path + " " + cand.url);
  if (!dated || !scored) return 0;
  return dated * 2 + scored * 2 + (looksExam ? 12 : 0);
}

function toAttempt(row, i) {
  let score = asNum(pick(row, F.score));
  const percent = asNum(pick(row, F.percent));
  const answered = asNum(pick(row, F.answered));
  const correct = asNum(pick(row, F.correct));
  if (score === undefined) score = percent;
  if (score !== undefined && score <= 1) score = score * 100;
  if (score === undefined && answered > 0 && correct !== undefined) score = correct / answered * 100;

  let minutes = asNum(pick(row, F.minutes));
  if (minutes === undefined) {
    const s = asNum(pick(row, F.seconds));
    if (s !== undefined) minutes = Math.round(s > 10000 ? s / 60000 : s / 60);
  }

  return {
    date: asDate(pick(row, F.date)) ?? null,
    name: String(pick(row, F.name) ?? `Attempt ${i + 1}`).trim(),
    scorePct: score === undefined ? null : Math.round(score * 10) / 10,
    answered: answered ?? null,
    correct: correct ?? null,
    minutes: minutes ?? null,
    byArea: null
  };
}

/* ---------- main ---------- */

const captures = loadCaptures();
if (!captures.length) {
  console.error("\n  Nothing in importer/captured/network/. Run: node capture.mjs\n");
  process.exit(1);
}

const { areaOverrides, ignoreUnits } = loadMapping();
const candidates = captures.flatMap((c) => collectArrays(c.body, c.url));

if (INSPECT) {
  console.log(`\n  ${captures.length} payload(s), ${candidates.length} candidate array(s).\n`);
  candidates
    .map((c) => ({ c, u: scoreUnitArray(c), e: scoreExamArray(c) }))
    .filter((x) => x.u || x.e)
    .sort((a, b) => Math.max(b.u, b.e) - Math.max(a.u, a.e))
    .slice(0, 25)
    .forEach(({ c, u, e }) => {
      console.log(`  unit:${String(u).padStart(4)}  exam:${String(e).padStart(4)}  ` +
                  `${c.rows.length} rows  ${c.path}`);
      console.log(`      ${c.url}`);
      console.log(`      keys: ${c.keys.slice(0, 18).join(", ")}`);
      console.log(`      first: ${JSON.stringify(c.rows[0]).slice(0, 220)}\n`);
    });
  console.log("  Nothing written. Name the right endpoint in mapping.json to narrow this down.\n");
  process.exit(0);
}

const bestUnits = candidates
  .map((c) => ({ c, s: scoreUnitArray(c) }))
  .filter((x) => x.s > 0)
  .sort((a, b) => b.s - a.s)[0];

const bestExams = candidates
  .map((c) => ({ c, s: scoreExamArray(c) }))
  .filter((x) => x.s > 0)
  .sort((a, b) => b.s - a.s)[0];

let units = [];
if (bestUnits) {
  units = bestUnits.c.rows
    .map((r, i) => toUnit(r, i, areaOverrides))
    .filter((u) => !ignoreUnits.some((ig) => u.name.toLowerCase().includes(ig.toLowerCase())))
    .filter((u) => u.answered > 0 || u.masteryPct !== null || u.lessonsTotal);
}

let exams = [];
if (bestExams) {
  exams = bestExams.c.rows
    .map(toAttempt)
    .filter((e) => e.date && e.scorePct !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* Attempts that look like full practice exams go to exams[]; short ones are QBank
 * sittings. 60+ questions is the dividing line — a Series 66 practice exam is 100. */
const qbank = [];
exams = exams.filter((e) => {
  if (e.answered !== null && e.answered < 60) {
    qbank.push({
      date: e.date, answered: e.answered,
      correct: e.correct ?? Math.round(e.answered * e.scorePct / 100),
      unitId: null, area: null, label: e.name
    });
    return false;
  }
  return true;
});

const existing = readProgress();
const merged = {
  meta: { ...existing.meta, source: "kaplan" },
  units: units.length ? units : existing.units,
  areas: existing.areas,
  qbank: MERGE ? dedupe([...existing.qbank, ...qbank]) : (qbank.length ? qbank : existing.qbank),
  exams: MERGE ? dedupe([...existing.exams, ...exams]) : (exams.length ? exams : existing.exams),
  study: existing.study,
  assignments: existing.assignments
};

function dedupe(list) {
  const seen = new Set(), out = [];
  for (const r of list) {
    const k = `${r.date}|${r.label || r.name || ""}|${r.answered ?? r.scorePct ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* ---------- report ---------- */

console.log("");
console.log(`  Read ${captures.length} captured payload(s).`);
if (bestUnits) {
  console.log(`  Units:  ${units.length} from ${bestUnits.c.path || "$"}`);
  console.log(`          ${bestUnits.c.url}`);
} else {
  console.log("  Units:  none found — no array had both names and performance numbers.");
}
if (bestExams) {
  console.log(`  Attempts: ${exams.length} practice exam(s), ${qbank.length} QBank sitting(s)`);
  console.log(`          ${bestExams.c.url}`);
} else {
  console.log("  Attempts: none found.");
}

const byArea = {};
for (const id of AREA_IDS) byArea[id] = 0;
let unmapped = [];
for (const u of units) {
  if (u.area && byArea[u.area] !== undefined) byArea[u.area]++;
  else unmapped.push(u.name);
}
if (units.length) {
  console.log("\n  Content-area mapping: " +
    AREA_IDS.map((a) => `${a} ${byArea[a]}`).join(" · "));
  if (unmapped.length) {
    console.log(`  Unmapped (${unmapped.length}) — add these to mapping.json areaOverrides:`);
    unmapped.forEach((n) => console.log(`    "${n}": ""`));
  }
}

if (DRY) {
  console.log("\n  --dry: nothing written.\n");
  process.exit(0);
}
if (!units.length && !exams.length && !qbank.length) {
  console.log("\n  Nothing extractable. Try: node parse.mjs --inspect\n");
  process.exit(1);
}

writeProgress(merged, "kaplan");
console.log("\n  Wrote data/progress.js. Open index.html to see it.\n");
