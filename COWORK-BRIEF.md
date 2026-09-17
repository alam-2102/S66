# Cowork brief — Series 66 Kaplan pull

Everything below the line is one self-contained paste. Copy the whole thing into
Cowork (or any Claude surface that can drive Chrome on your machine), make sure
you're logged into Kaplan first, and tell it to go.

It needs no repo and no files. It ends by printing **one JSON payload**. Paste
that payload back to the Claude Code session that owns this repo and the
dashboard updates itself.

---

You are pulling my real Series 66 data out of the Kaplan student portal. I am
already logged into Kaplan in Chrome on this machine. Drive the browser yourself.

## The two rules that outrank everything else

**1. Real data only. Never fabricate.** No placeholder scores, no illustrative
numbers, no example data, no invented unit names. Not even temporarily, not even
to show me the shape of the output. If you cannot reach something, leave it out
and say so. Empty is correct. Invented is worse than nothing, because three weeks
from now nobody can tell it was invented.

**2. Read every scored activity, question by question.** Not just the most
recent. Not just the exams. If it has a score, it gets opened and decomposed.
This is the whole point of the run — a row that says "Exam 1: 68%" is nearly
useless to me; the question-level detail is what I actually study from.

## If the session is dead

Go to `https://www.kaplanlearn.com/`. If you land on a Sign In page or get
redirected to `/login`, **stop immediately and tell me to log in and re-trigger.**

Never type credentials. Never touch the login form. Chrome's saved-password
dropdown is browser UI you cannot see or click, so there is nothing you can do
here — only I can fix it. Do not try to work around it. Do not produce a payload.

## Browser notes

- If a browser call reports it is not connected, **retry up to 3 times** before
  concluding it is down. The second attempt usually succeeds.
- Prefer page-text and accessibility-tree reads over screenshots — actual text
  rather than pixels, and faster.

## Getting into the course

The enrollment tile on the landing page **looks clickable and is not** — the
click registers but the page never navigates. Read the tile's `href` with
JavaScript and navigate to that URL directly. Note the course dashboard URL; you
will need it again.

## Course dashboard — top-line numbers

One page-text read gives you all of:

- **Completed Activities** as `x / y` — the denominator is the full activity count
- **Exam Average %** and **QBank Average %**
- **Study plan progress %**
- Days until exam, if a date is set (there isn't one — I have not booked it)

## Performance Tracker — the canonical per-unit numbers

Path is **`<course-dashboard-url>/performancetracker/<id>`**. It is **relative to
the course dashboard URL**; a bare `/education/performancetracker/<id>` returns
404. This is a recurring trap — get it right the first time.

Its **Breakdown table** gives per-unit QBank and Exam percentages. These are
cumulative and authoritative: **they override any older single-quiz score** shown
in a unit's section header. If the tracker and an old quiz result disagree, the
tracker wins, always.

Record for each unit: name, QBank answered/correct, Exam answered/correct. If the
tracker gives percentages rather than raw counts, record the percentages and the
question counts it shows, and say which you got.

## Finding the quizzes — Study Tools menu

**Coordinate clicks on the header menu miss.** The screenshot coordinate frame is
scaled relative to the real viewport, so a click aimed at "Study Tools" lands on
the neighbouring item and opens a stray tab. Do not click by coordinate here.

What works:

1. `find` → "Study Tools button in header" → click **by ref**
2. The menu opens as a full-screen overlay
3. `find` → "SecuritiesPro QBank menu link" (or the Series 66 equivalent) → click **by ref**

Same for Checkpoint Exams. **Always find-then-click-by-ref for header navigation.**

## My Quizzes — the master list

Inside the QBank, **"My Quizzes"** lists every quiz I have taken with name, date,
question count, time taken and score. This is your index.

**Sweep all of it.** Every quiz, every checkpoint exam, every practice and
simulated exam, every QBank session with a result.

For each one, use its **3-dot menu → "Review"**. That is read-only and safe.

> **Never click "Launch."** That starts a fresh attempt and would destroy my real
> results. This is the single most damaging thing you could do in this run.

## Reading a quiz in Review

Click through **every question** with NEXT — the correct ones as well as the
misses. **Wait about a second after each click before reading**, or you will read
the previous question's DOM and silently record the wrong answer against the
wrong question.

Capture per question:

- Question text
- What I answered
- The correct answer
- The full rationale Kaplan gives
- The learning-objective or topic tag, if shown

Then write it up:

- **Incorrect** → a full tutoring-style explanation of the underlying concept.
  Not "the answer is C." Explain *why*, what distinction the question is testing,
  and what the distractor was built to catch. Write like a tutor, not a marking
  scheme.
- **Correct** → one line on the concept tested. Enough that a pattern is visible
  later.

## Full-length exams — extra capture

For any simulated or practice exam, also capture:

- **Per-question topic tags**, so a per-topic breakdown can be built
- **Miss categories** — what kind of error each miss was (misread the question,
  did not know the rule, narrowed to two and picked wrong, ran out of time)
- **Per-quarter miss counts** — questions 1–25, 26–50, 51–75, 76–100 — so stamina
  and late-exam fade can be tracked

## Map the units to NASAA topics

Kaplan's unit numbering is its own and does not line up with NASAA's four topics.
Read each unit's learning objectives and map it.

The four NASAA topics, from NASAA's own outline effective 12 June 2023:

| Topic | Weight | Questions |
|---|---|---|
| I — Economic Factors and Business Information | 8% | 8 |
| II — Investment Vehicle Characteristics | 17% | 17 |
| III — Client/Customer Investment Recommendations and Strategies | 30% | 30 |
| IV — Laws, Regulations and Guidelines, incl. Prohibition on Unethical Business Practice | 45% | 45 |

Several prep sites publish 5/20/30/45. That is wrong — use the table above.

Where a unit spans two topics, **split it** (e.g. `{"II": 0.6, "III": 0.4}`) and
say why. Never force it into one bucket. Split weights must sum to exactly 1.

**Show me the mapping and stop for my confirmation before you finalise the
payload.** If it is wrong, every weighted number downstream is wrong, and I can
check it faster than you can.

## What the exam is

100 scored questions plus 10 pretest = 110 total, 150 minutes, **73% to pass.**
I have already passed the Series 7. I have completed **one exam** in the Kaplan
course; everything else is unstarted. **No exam date is booked** — leave
`examDate` as `null` and do not invent one or write a dated study plan.

## Output — one JSON payload

End the run by printing exactly one JSON object in a fenced code block, in this
schema. Nothing else after it.

```json
{
  "meta": {
    "lastVerified": "YYYY-MM-DD",
    "lastRunAttempted": "YYYY-MM-DD",
    "source": "kaplan",
    "examDate": null,
    "noDataRuns": 0,
    "lastActivityDate": "YYYY-MM-DD",
    "courseActivitiesDone": 0,
    "courseActivitiesTotal": 0,
    "studyPlanPct": 0,
    "kaplanExamAvg": 0,
    "kaplanQBankAvg": null,
    "unreadReason": ""
  },
  "unitTopicMap": [
    { "id": "U1", "name": "unit name", "split": { "IV": 1.0 }, "note": "why" },
    { "id": "U2", "name": "unit name", "split": { "II": 0.6, "III": 0.4 }, "note": "spans two topics" }
  ],
  "unitData": [
    { "id": "U1", "name": "unit name",
      "qbankAnswered": 0, "qbankCorrect": 0,
      "examAnswered": 0, "examCorrect": 0,
      "mixedAnswered": 0, "mixedCorrect": 0,
      "covers": "one line on what the unit covers",
      "recurring": "mistakes that keep recurring here" }
  ],
  "mixedQuizzes": [ { "date": "YYYY-MM-DD", "label": "name", "answered": 0, "correct": 0 } ],
  "kaplanQBank":  [ { "date": "YYYY-MM-DD", "label": "name", "answered": 0, "correct": 0 } ],
  "simExams": [
    { "name": "Exam 1", "date": "YYYY-MM-DD", "score": 0, "total": 100,
      "timeUsed": 0, "timeAllowed": 150,
      "byTopic": { "I": { "answered": 0, "correct": 0 }, "IV": { "answered": 0, "correct": 0 } },
      "byUnit":  { "U1": { "answered": 0, "correct": 0 } },
      "segments": [ { "label": "1-25", "missed": 0 }, { "label": "26-50", "missed": 0 },
                    { "label": "51-75", "missed": 0 }, { "label": "76-100", "missed": 0 } ],
      "missCats": { "misread the question": 0, "did not know the rule": 0 } }
  ],
  "weakSpots": [], "strongSpots": [],
  "missedQuestions": [
    { "id": "e1q07", "date": "YYYY-MM-DD", "unitId": "U1", "topic": "IV", "lo": "LO 4.2",
      "question": "the full question text",
      "myAnswer": "what I picked",
      "correctAnswer": "the right answer",
      "rationale": "Kaplan's rationale, verbatim",
      "explanation": "the tutoring write-up" }
  ],
  "answeredCorrect": [
    { "id": "e1q08", "question": "the question text", "note": "one line on the concept tested" }
  ],
  "errorPatterns": [
    { "rule": "the rule I keep missing", "count": 2, "topic": "IV",
      "occurrences": ["e1q07"], "note": "why it keeps happening" }
  ],
  "quickTips": [
    { "id": "t-short-slug", "kind": "rule", "topic": "IV", "unitId": "U1",
      "count": 2, "fromMisses": ["e1q07"],
      "trigger": "a question asking which criteria make someone 'in the business' of giving advice",
      "move": "Count exactly three: regular advice + paid FOR THE ADVICE + holds himself out. Strike transaction earnings.",
      "why": "one line on why this keeps catching me" }
  ],
  "priorSnapshot": null
}
```

Rules for the payload:

- Dates are `YYYY-MM-DD`. Unit ids are yours to assign (`U1`, `U2`, …) but must
  be consistent across `unitData`, `unitTopicMap` and `byUnit`.
- **`quickTips` is the compressed version of what I got wrong** - a trigger I will
  recognise mid-question and the move that answers it. Write one per distinct error.
  **Never generic exam advice**: every tip must cite real misses in `fromMisses`, or
  it will be rejected. `kind` is `"rule"` for content or `"technique"` for how I am
  answering questions wrong (e.g. mishandling Roman-numeral questions). `count` is
  how many times that error has shown up.
- **Every entry in `missedQuestions` must have an `explanation`.** It is the
  highest-value field in the whole payload. A payload with misses missing it will
  be rejected.
- `correct` must never exceed `answered`. Split weights must sum to exactly 1.
  Every unit in `unitData` must appear in `unitTopicMap`.
- **Do not set `lastVerified` unless you actually read Kaplan.** If the run read
  nothing, do not produce a payload at all — just tell me the session was dead.
- Anything in `errorPatterns` with `count` 2 or more is the most useful thing you
  can give me. Look for it deliberately: the same rule missed twice.

After the payload, give me a short plain-prose summary — what my pooled score is,
what is weakest, 2–4 of the misses with their explanations, and one concrete next
focus. Write like a study partner, not a report generator.
