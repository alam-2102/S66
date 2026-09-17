# Data shape

`data/exam.js` — static exam blueprint (`window.S66_EXAM`). Content areas and
weights from the NASAA Series 66 outline. Nothing writes to this but you.

`data/progress.js` — your progress (`window.S66_DATA`). The importer overwrites
this file wholesale, so don't keep anything else in it.

## `meta`

| field | type | notes |
|---|---|---|
| `lastUpdated` | ISO string \| null | shown in the header |
| `source` | `"empty"` \| `"manual"` \| `"kaplan"` | provenance badge |
| `examDate` | `"YYYY-MM-DD"` \| null | when set, the dashboard adds a countdown and a required-pace line |
| `targets.qbankAccuracyPct` | number | readiness bar for QBank accuracy |
| `targets.examScorePct` | number | readiness bar for practice exams — set above 75 to leave headroom |
| `targets.courseCompletePct` | number | readiness bar for course completion |

## `units[]`

One per Kaplan study unit / chapter.

| field | type | notes |
|---|---|---|
| `id` | string | stable slug |
| `name` | string | as Kaplan labels it |
| `area` | one of `econ` \| `vehicles` \| `recommendations` \| `laws` | maps to `S66_EXAM.areas[].id` |
| `answered` | number | QBank questions answered in this unit |
| `correct` | number | of those, how many correct |
| `masteryPct` | number \| null | Kaplan's own mastery/proficiency score, if it reports one |
| `lessonsTotal` | number \| null | |
| `lessonsComplete` | number \| null | |

## `areas{}`

Fallback rollup, keyed by area id — only read when `units` is empty.

```js
areas: { laws: { answered: 120, correct: 91, masteryPct: 76 } }
```

## `qbank[]`

| field | type | notes |
|---|---|---|
| `date` | `"YYYY-MM-DD"` | |
| `answered` | number | |
| `correct` | number | |
| `unitId` | string \| null | optional |
| `area` | area id \| null | optional |
| `label` | string \| null | e.g. `"Quiz 4"` |

## `exams[]`

| field | type | notes |
|---|---|---|
| `date` | `"YYYY-MM-DD"` | |
| `name` | string | e.g. `"Mastery Exam 1"` |
| `scorePct` | number | 0–100 |
| `answered` | number \| null | |
| `correct` | number \| null | |
| `minutes` | number \| null | time used |
| `byArea` | object \| null | `{ laws: 71, econ: 88, ... }` percentages |

## `study[]`

| field | type | notes |
|---|---|---|
| `date` | `"YYYY-MM-DD"` | |
| `minutes` | number | |
| `activity` | string \| null | `"video"`, `"reading"`, `"qbank"`, … |

## `assignments[]`

| field | type | notes |
|---|---|---|
| `name` | string | |
| `type` | string \| null | |
| `status` | `"complete"` \| `"in_progress"` \| `"not_started"` | |
| `dueDate` | `"YYYY-MM-DD"` \| null | |
