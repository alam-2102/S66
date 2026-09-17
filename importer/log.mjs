#!/usr/bin/env node
/* log.mjs — add to data/progress.js by hand. Useful before your first Kaplan
 * import, and for study time Kaplan doesn't track (reading a textbook, notes).
 *
 *   node log.mjs --minutes 60 --activity qbank --answered 40 --correct 31 --area laws
 *   node log.mjs --exam "Mastery Exam 3" --score 78 --minutes 130
 *   node log.mjs --unit "Unethical Business Practices" --answered 25 --correct 19
 *   node log.mjs --exam-date 2026-11-14
 *   node log.mjs --target-exam 82
 *   node log.mjs --show
 *
 * Everything takes an optional --date YYYY-MM-DD (defaults to today).
 */

import { readProgress, writeProgress, areaFor, loadMapping, AREA_IDS, todayISO } from "./lib.mjs";

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf("--" + name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const n = (v) => (v === undefined || v === true ? undefined : Number(v));

if (!argv.length || flag("help") === true) {
  console.log(readFileHelp());
  process.exit(0);
}
function readFileHelp() {
  return [
    "",
    "  node log.mjs --minutes 60 --activity qbank --answered 40 --correct 31 --area laws",
    "  node log.mjs --exam \"Mastery Exam 3\" --score 78 --minutes 130",
    "  node log.mjs --unit \"Unethical Business Practices\" --answered 25 --correct 19",
    "  node log.mjs --exam-date 2026-11-14      set your test date (adds a countdown)",
    "  node log.mjs --target-qbank 72           move a readiness bar",
    "  node log.mjs --target-exam 82",
    "  node log.mjs --show                      print the current state",
    "",
    "  Areas: " + AREA_IDS.join(", "),
    ""
  ].join("\n");
}

const data = readProgress();
const date = flag("date") && flag("date") !== true ? String(flag("date")) : todayISO();
const { areaOverrides } = loadMapping();
let touched = [];

if (flag("show") === true) {
  const ua = data.units.reduce((s, u) => s + (u.answered || 0), 0);
  const uc = data.units.reduce((s, u) => s + (u.correct || 0), 0);
  console.log("");
  console.log(`  source          ${data.meta.source ?? "—"}`);
  console.log(`  last updated    ${data.meta.lastUpdated ?? "—"}`);
  console.log(`  exam date       ${data.meta.examDate ?? "not set"}`);
  console.log(`  units           ${data.units.length}` +
    (ua ? `  (${uc}/${ua} correct = ${(uc / ua * 100).toFixed(1)}%)` : ""));
  console.log(`  qbank sittings  ${data.qbank.length}`);
  console.log(`  practice exams  ${data.exams.length}` +
    (data.exams.length ? `  (latest ${data.exams[data.exams.length - 1].scorePct}%)` : ""));
  console.log(`  study sessions  ${data.study.length}` +
    `  (${(data.study.reduce((s, x) => s + (x.minutes || 0), 0) / 60).toFixed(1)} h)`);
  console.log("");
  process.exit(0);
}

/* --- exam date & targets --- */
const examDate = flag("exam-date");
if (examDate && examDate !== true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    console.error("  --exam-date wants YYYY-MM-DD");
    process.exit(1);
  }
  data.meta.examDate = examDate;
  touched.push(`exam date set to ${examDate}`);
}
data.meta.targets = data.meta.targets || {};
for (const [cli, key] of [["target-qbank", "qbankAccuracyPct"],
                          ["target-exam", "examScorePct"],
                          ["target-course", "courseCompletePct"]]) {
  const v = n(flag(cli));
  if (v !== undefined && !isNaN(v)) {
    data.meta.targets[key] = v;
    touched.push(`${key} target -> ${v}%`);
  }
}

/* --- a practice exam --- */
const examName = flag("exam");
if (examName && examName !== true) {
  const score = n(flag("score"));
  const answered = n(flag("answered"));
  const correct = n(flag("correct"));
  const scorePct = score ?? (answered && correct !== undefined ? correct / answered * 100 : undefined);
  if (scorePct === undefined || isNaN(scorePct)) {
    console.error("  --exam needs --score, or --answered and --correct");
    process.exit(1);
  }
  data.exams.push({
    date,
    name: String(examName),
    scorePct: Math.round(scorePct * 10) / 10,
    answered: answered ?? null,
    correct: correct ?? null,
    minutes: n(flag("minutes")) ?? null,
    byArea: null
  });
  data.exams.sort((a, b) => (a.date < b.date ? -1 : 1));
  touched.push(`exam "${examName}" at ${Math.round(scorePct)}%`);
}

/* --- a QBank sitting --- */
const answered = n(flag("answered"));
const correct = n(flag("correct"));
if (!examName && answered !== undefined && correct !== undefined) {
  let area = flag("area");
  if (area === true) area = undefined;
  const unitName = flag("unit") !== true ? flag("unit") : undefined;
  if (!area && unitName) area = areaFor(unitName, areaOverrides);
  if (area && !AREA_IDS.includes(area)) {
    console.error(`  --area must be one of: ${AREA_IDS.join(", ")}`);
    process.exit(1);
  }

  data.qbank.push({
    date, answered, correct,
    unitId: null,
    area: area ?? null,
    label: flag("label") !== true ? flag("label") ?? null : null
  });
  data.qbank.sort((a, b) => (a.date < b.date ? -1 : 1));
  touched.push(`${correct}/${answered} QBank${area ? ` in ${area}` : ""}`);

  /* keep the unit rollup in step, so the per-area charts move too */
  if (unitName) {
    let u = data.units.find((x) => x.name.toLowerCase() === String(unitName).toLowerCase());
    if (!u) {
      u = {
        id: String(unitName).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
        name: String(unitName),
        area: area ?? areaFor(unitName, areaOverrides),
        answered: 0, correct: 0, masteryPct: null,
        lessonsTotal: null, lessonsComplete: null
      };
      data.units.push(u);
      touched.push(`new unit "${unitName}"`);
    }
    u.answered += answered;
    u.correct += correct;
    u.masteryPct = Math.round(u.correct / u.answered * 1000) / 10;
  } else if (area) {
    /* no unit named — keep a synthetic per-area unit so rollups still work */
    const id = `area-${area}`;
    let u = data.units.find((x) => x.id === id);
    if (!u) {
      const label = { econ: "Economic factors", vehicles: "Investment vehicles",
                      recommendations: "Recommendations & strategies",
                      laws: "Laws & regulations" }[area];
      u = { id, name: `${label} (logged by hand)`, area,
            answered: 0, correct: 0, masteryPct: null,
            lessonsTotal: null, lessonsComplete: null };
      data.units.push(u);
    }
    u.answered += answered;
    u.correct += correct;
    u.masteryPct = Math.round(u.correct / u.answered * 1000) / 10;
  }
}

/* --- study time --- */
const minutes = n(flag("minutes"));
if (minutes !== undefined && !isNaN(minutes) && !(examName && examName !== true)) {
  const activity = flag("activity") !== true ? flag("activity") ?? null : null;
  data.study.push({ date, minutes, activity });
  data.study.sort((a, b) => (a.date < b.date ? -1 : 1));
  touched.push(`${minutes} min of study`);
} else if (examName && examName !== true && minutes !== undefined) {
  data.study.push({ date, minutes, activity: "exam" });
  data.study.sort((a, b) => (a.date < b.date ? -1 : 1));
  touched.push(`${minutes} min of study`);
}

if (!touched.length) {
  console.error("\n  Nothing to log." + readFileHelp());
  process.exit(1);
}

writeProgress(data, data.meta.source === "kaplan" ? "kaplan + manual" : "manual");
console.log("\n  " + date + ": " + touched.join(", "));
console.log("  Wrote data/progress.js.\n");
