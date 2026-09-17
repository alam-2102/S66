/* Your Series 66 progress.
 *
 * This file is the dashboard's single source of truth. Three ways to fill it:
 *   1. `node importer/capture.mjs` then `node importer/parse.mjs`  — pull from Kaplan
 *   2. `node importer/log.mjs ...`                                  — log a session by hand
 *   3. edit this file directly                                      — it is just an object
 *
 * It is a .js file rather than .json so the dashboard works by double-clicking
 * index.html (browsers block fetch() of local files, but allow <script src>).
 *
 * Shape is documented in data/schema.md.
 */
window.S66_DATA = {
  meta: {
    lastUpdated: null,        // ISO 8601 string
    source: "empty",          // "empty" | "manual" | "kaplan"
    examDate: null,           // "2026-11-14" once you schedule it
    targets: {
      qbankAccuracyPct: 70,   // your own readiness bars, not Kaplan's official advice
      examScorePct: 80,       // sit above this on practice exams, not just above 75
      courseCompletePct: 100
    }
  },

  // Kaplan study units / chapters. `area` maps each one to a NASAA content area
  // in data/exam.js so the dashboard can roll them up by exam weight.
  units: [],

  // Rolled-up per-area numbers. Optional — the dashboard derives these from
  // `units` when units are present, and only falls back to this when they aren't.
  areas: {},

  // One entry per QBank sitting.
  qbank: [],

  // Practice / mastery exams.
  exams: [],

  // Study time log.
  study: [],

  // Course roadmap items, if the importer finds them.
  assignments: []
};
