/* Demo dataset for the "Sample data" button. Never written to by the importer,
 * never mistaken for real progress — the dashboard shows a banner while it is on.
 * Useful for seeing what the dashboard looks like filled in before your first import. */
window.S66_SAMPLE = {
  meta: {
    lastUpdated: "2026-09-16T21:40:00Z",
    source: "sample",
    examDate: null,
    targets: { qbankAccuracyPct: 70, examScorePct: 80, courseCompletePct: 100 }
  },
  units: [
    { id: "u01", name: "Economic Fundamentals",          area: "econ",            answered: 42,  correct: 35, masteryPct: 83, lessonsTotal: 4, lessonsComplete: 4 },
    { id: "u02", name: "Business Information & Analysis", area: "econ",            answered: 28,  correct: 22, masteryPct: 79, lessonsTotal: 3, lessonsComplete: 3 },
    { id: "u03", name: "Equity Securities",              area: "vehicles",        answered: 61,  correct: 49, masteryPct: 80, lessonsTotal: 5, lessonsComplete: 5 },
    { id: "u04", name: "Debt Securities",                area: "vehicles",        answered: 58,  correct: 43, masteryPct: 74, lessonsTotal: 5, lessonsComplete: 5 },
    { id: "u05", name: "Pooled Investments",             area: "vehicles",        answered: 47,  correct: 34, masteryPct: 72, lessonsTotal: 4, lessonsComplete: 4 },
    { id: "u06", name: "Derivatives & Alternatives",     area: "vehicles",        answered: 22,  correct: 13, masteryPct: 59, lessonsTotal: 4, lessonsComplete: 2 },
    { id: "u07", name: "Client Profiling & Suitability",  area: "recommendations", answered: 74,  correct: 58, masteryPct: 78, lessonsTotal: 6, lessonsComplete: 6 },
    { id: "u08", name: "Portfolio Theory & Strategies",  area: "recommendations", answered: 55,  correct: 39, masteryPct: 71, lessonsTotal: 5, lessonsComplete: 4 },
    { id: "u09", name: "Taxation & Retirement Plans",    area: "recommendations", answered: 49,  correct: 32, masteryPct: 65, lessonsTotal: 5, lessonsComplete: 3 },
    { id: "u10", name: "Registration of Persons",        area: "laws",            answered: 88,  correct: 70, masteryPct: 79, lessonsTotal: 6, lessonsComplete: 6 },
    { id: "u11", name: "Registration of Securities",     area: "laws",            answered: 64,  correct: 46, masteryPct: 72, lessonsTotal: 5, lessonsComplete: 5 },
    { id: "u12", name: "Unethical Business Practices",   area: "laws",            answered: 71,  correct: 48, masteryPct: 68, lessonsTotal: 6, lessonsComplete: 4 },
    { id: "u13", name: "Fiduciary Duty & Agency Rules",  area: "laws",            answered: 33,  correct: 20, masteryPct: 61, lessonsTotal: 5, lessonsComplete: 2 }
  ],
  areas: {},
  qbank: [
    { date: "2026-08-04", answered: 40, correct: 24, label: "Quiz 1" },
    { date: "2026-08-07", answered: 35, correct: 23, label: "Quiz 2" },
    { date: "2026-08-11", answered: 50, correct: 33, label: "Quiz 3" },
    { date: "2026-08-14", answered: 45, correct: 31, label: "Quiz 4" },
    { date: "2026-08-18", answered: 60, correct: 43, label: "Quiz 5" },
    { date: "2026-08-21", answered: 40, correct: 30, label: "Quiz 6" },
    { date: "2026-08-25", answered: 55, correct: 41, label: "Quiz 7" },
    { date: "2026-08-28", answered: 50, correct: 38, label: "Quiz 8" },
    { date: "2026-09-01", answered: 65, correct: 50, label: "Quiz 9" },
    { date: "2026-09-04", answered: 45, correct: 35, label: "Quiz 10" },
    { date: "2026-09-08", answered: 60, correct: 47, label: "Quiz 11" },
    { date: "2026-09-11", answered: 55, correct: 44, label: "Quiz 12" },
    { date: "2026-09-15", answered: 70, correct: 56, label: "Quiz 13" },
    { date: "2026-09-16", answered: 22, correct: 18, label: "Quiz 14" }
  ],
  exams: [
    { date: "2026-08-23", name: "Mastery Exam 1", scorePct: 66, answered: 100, correct: 66, minutes: 141,
      byArea: { econ: 75, vehicles: 70, recommendations: 63, laws: 64 } },
    { date: "2026-09-13", name: "Mastery Exam 2", scorePct: 74, answered: 100, correct: 74, minutes: 128,
      byArea: { econ: 88, vehicles: 75, recommendations: 73, laws: 70 } }
  ],
  study: [
    { date: "2026-08-03", minutes: 75,  activity: "video" },
    { date: "2026-08-04", minutes: 60,  activity: "qbank" },
    { date: "2026-08-06", minutes: 90,  activity: "reading" },
    { date: "2026-08-07", minutes: 45,  activity: "qbank" },
    { date: "2026-08-10", minutes: 105, activity: "video" },
    { date: "2026-08-11", minutes: 70,  activity: "qbank" },
    { date: "2026-08-13", minutes: 55,  activity: "reading" },
    { date: "2026-08-14", minutes: 60,  activity: "qbank" },
    { date: "2026-08-17", minutes: 120, activity: "video" },
    { date: "2026-08-18", minutes: 80,  activity: "qbank" },
    { date: "2026-08-20", minutes: 65,  activity: "reading" },
    { date: "2026-08-21", minutes: 50,  activity: "qbank" },
    { date: "2026-08-23", minutes: 141, activity: "exam" },
    { date: "2026-08-25", minutes: 75,  activity: "qbank" },
    { date: "2026-08-27", minutes: 95,  activity: "video" },
    { date: "2026-08-28", minutes: 60,  activity: "qbank" },
    { date: "2026-09-01", minutes: 85,  activity: "qbank" },
    { date: "2026-09-02", minutes: 110, activity: "video" },
    { date: "2026-09-04", minutes: 55,  activity: "qbank" },
    { date: "2026-09-07", minutes: 100, activity: "reading" },
    { date: "2026-09-08", minutes: 80,  activity: "qbank" },
    { date: "2026-09-10", minutes: 90,  activity: "video" },
    { date: "2026-09-11", minutes: 70,  activity: "qbank" },
    { date: "2026-09-13", minutes: 128, activity: "exam" },
    { date: "2026-09-15", minutes: 95,  activity: "qbank" },
    { date: "2026-09-16", minutes: 40,  activity: "qbank" }
  ],
  assignments: []
};
