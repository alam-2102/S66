---
name: s66-sync
description: Pull Austin's real Series 66 data out of the Kaplan student portal and update the dashboard at index.html. Use when asked to "run the S66 check", "sync Kaplan", "pull my Series 66 data", or to refresh the study dashboard. Requires a live, already-logged-in Kaplan session in a browser this machine controls.
---

# Series 66 Kaplan sync

Updates `index.html` from real Kaplan data. Primarily run **on demand**, when Austin
says so, with his Kaplan session already live in the browser.

## The two rules that outrank everything else

**1. Real data only. Never fabricate.**
No placeholder scores, no illustrative numbers, no example data, no synthetic units.
Not even temporarily, not even to "show the layout". If you cannot reach Kaplan, leave
the arrays empty and say so. An empty dashboard is correct. A populated fake one is
worse than nothing, because three weeks later nobody can tell it is fake.

**2. Never type a number into the HTML.**
Every figure on the page - including inside hand-written prose - is injected from the
data arrays at render time through `data-bind`. If you find yourself hand-editing a
value, the binding is missing: **add the binding instead**. This is the whole reason
the file is built this way.

## Why this runs where it runs

This needs browser control of the machine holding the logged-in Kaplan session. A
cloud container cannot do it: it has no access to Austin's browser cookies, and
`kaplanlearn.com` refuses its requests outright. Run this from a session on his own
machine with browser tooling attached.

---

## Pre-flight, in order

Each of these has caused a silent total failure before.

1. **Repo.** Confirm the repo is reachable and clean, then `git pull` first. If the
   repo is not accessible, stop and say so in one line rather than burning the run on
   browsing you cannot save.
2. **Browser tools.** The first browser call frequently reports "not connected" even
   when the browser is fine. **Retry up to 3 times** before concluding it is down.
   The second attempt usually succeeds.
3. **Session.** Go to `https://www.kaplanlearn.com/`. If you land on a Sign In page or
   get redirected to `/login`, the session is dead: **stop, tell Austin to log in and
   re-trigger, end the run.** Never type credentials. Never touch the login form.
   Chrome's saved-password dropdown is browser UI that automated tools cannot see or
   click, so there is nothing to "help" with here - only he can fix it.

   On an expired session, increment `META.noDataRuns`, set `META.lastRunAttempted` to
   today, leave `META.lastVerified` **unchanged**, change nothing else substantive,
   commit, and say plainly that the run read nothing.

---

## Navigating Kaplan

The structure is the same product as the Series 7 course; the URLs and IDs differ.
Verify each step the first time and record what you find in `data/kaplan-map.json`.

### Getting into the course
The enrollment tile on the landing page **looks clickable and is not** - the click
registers but the page never navigates. Read the tile's `href` with JavaScript and
navigate to that URL directly. Record the course dashboard URL and reuse it; only
re-derive it if it 404s.

### Course dashboard - top-line numbers
One page-text read gives you all of:
- **Completed Activities** as `x / y` (the denominator is the full activity count)
- **Exam Average %** and **QBank Average %**
- **Study plan progress %**
- Days until exam, if a date is set

Prefer page-text and accessibility-tree reads over screenshots throughout - actual
text rather than pixels, and faster.

### Performance Tracker - the canonical per-unit numbers
Path is **`<course-dashboard-url>/performancetracker/<id>`**. It is **relative to the
course dashboard URL**; a bare `/education/performancetracker/<id>` returns 404. This
was a recurring trap.

Its **Breakdown table** gives per-unit QBank and Exam percentages. These are
cumulative and authoritative: **they override any older single-quiz score** shown in a
unit's section header. When the tracker and an old quiz result disagree, the tracker
wins, always. Read it every run. This is the primary source for `unitData`.

### Finding the quizzes - Study Tools menu
**Coordinate clicks on the header menu miss.** The screenshot coordinate frame is
scaled relative to the real viewport, so a click aimed at "Study Tools" lands on the
neighbouring item and opens a stray tab. Do not click by coordinate here.

What works:
1. `find` -> "Study Tools button in header" -> click **by ref**
2. The menu opens as a full-screen overlay
3. `find` -> "SecuritiesPro QBank menu link" (or the Series 66 equivalent) -> click **by ref**

Same for Checkpoint Exams. **Always find-then-click-by-ref for header navigation.**

### My Quizzes - the master list
Inside the QBank, **"My Quizzes"** lists every quiz taken with name, date, question
count, time taken and score. This is the index: compare it against what the dashboard
has already captured to identify new work.

**Sweep all of it.** Every quiz, every checkpoint exam, every practice and simulated
exam, every QBank session with a result. Not just the most recent. Not just exams.
**If it has a score, it gets read and decomposed.**

For each item not yet captured, use its **3-dot menu -> "Review"**. Read-only and safe.

> **Never click "Launch."** That starts a fresh attempt and would corrupt his real results.

---

## Reading a quiz in Review

Click through **every question** with NEXT - correct ones as well as misses. Allow
about a second after each click before reading, or you will read the previous
question's DOM.

Capture per question:
- Question text
- His answer
- The correct answer
- The full rationale Kaplan gives
- The learning-objective or topic tag, if shown

Then write it up:

- **Incorrect** -> a full tutoring-style explanation of the underlying concept. Not
  "the answer is C". Explain *why*, what the distinction is, and what the distractor
  was built to catch. Goes in `missedQuestions` with an `explanation` field.
- **Correct** -> a one-line note on the concept tested, enough to spot a pattern
  later. Goes in `answeredCorrect` with a `note` field.

### Full-length exams - extra capture
For any simulated or practice exam also capture:
- **Per-question topic tags**, so `byTopic` can be built
- **Miss categories** - what kind of error each miss was (`missCats`)
- **Per-quarter miss counts** (1-25, 26-50, 51-75, 76-100) as `segments`, so stamina
  and late-exam fade can be tracked. This earned its keep on the Series 7: it caught a
  late-exam fade across two consecutive sittings, then confirmed it was gone.

---

## The unit -> topic map

Kaplan's unit numbering is its own and does not line up with NASAA's four topics.
Everything weighted depends on this being right.

1. Read Kaplan's real unit list and each unit's learning objectives
2. Map each unit to one or more of NASAA Topics I-IV
3. Where a unit spans two topics, **split it and say so** rather than forcing it into
   one bucket. Split weights for a unit must sum to exactly 1.
4. Store it in `UNIT_TOPIC_MAP` as data, never as prose
5. **Show Austin the mapping and stop for confirmation before building anything on
   top of it.** If it is wrong every weighted number is wrong, and it is the one thing
   he can check faster than you can.

Do not hardcode a unit count. The Series 66 course is smaller than the Series 7's 21
units; derive the real number from Kaplan.

---

## Getting the data back to the repo

There are two shapes this run can take. Work out which one you are in **before**
you start reading Kaplan, because it changes what you produce at the end.

### Path A - this session is inside the repo
A Claude Code session started in a local clone, with browser tooling attached.
You can edit, check and push directly. Edit the `SYNC` block in `index.html`,
run `node tools/sanity-check.js`, commit, push. GitHub Pages redeploys in 30-60
seconds. Nothing to hand off.

### Path B - this session can drive Chrome but has no clone
A Cowork run, or any surface with browser control and no repo. The ready-to-paste
brief for that case is `COWORK-BRIEF.md` at the repo root — self-contained, no
files needed. You can read Kaplan but you cannot commit. **Do not try to describe the numbers in prose and
hope they get transcribed** - that is exactly how figures drift.

Instead, end the run by emitting **one JSON payload** in a fenced code block,
complete and self-contained, using the schema below. Austin hands that payload
to a session that does have the repo (or pastes it into the Claude Code session
that built this dashboard), and it gets applied mechanically:

```bash
node tools/apply-payload.js payload.json
node tools/sanity-check.js
git commit -am "Sim 2 logged, 71.2% -> pooled 68.4%" && git push
```

`apply-payload.js` validates before it writes and **refuses** a payload that
claims `lastVerified` with empty arrays, has split weights that do not sum to 1,
has `correct` exceeding `answered`, or leaves a unit unmapped. It writes the
`SYNC` block and nothing else, so no number is ever hand-typed.

### The payload schema

```json
{
  "meta": {
    "lastVerified": "2026-09-17",
    "lastRunAttempted": "2026-09-17",
    "source": "kaplan",
    "examDate": null,
    "noDataRuns": 0,
    "lastActivityDate": "2026-09-15",
    "courseActivitiesDone": 3,
    "courseActivitiesTotal": 48,
    "studyPlanPct": 6,
    "kaplanExamAvg": 68,
    "kaplanQBankAvg": null,
    "unreadReason": ""
  },
  "unitTopicMap": [
    { "id": "U1", "name": "...", "split": { "IV": 1.0 }, "note": "why" },
    { "id": "U2", "name": "...", "split": { "II": 0.6, "III": 0.4 }, "note": "spans two topics" }
  ],
  "unitData": [
    { "id": "U1", "name": "...", "qbankAnswered": 50, "qbankCorrect": 31,
      "examAnswered": 20, "examCorrect": 12, "mixedAnswered": 10, "mixedCorrect": 7,
      "covers": "optional one-liner", "recurring": "optional" }
  ],
  "mixedQuizzes": [ { "date": "2026-09-12", "label": "...", "answered": 25, "correct": 18 } ],
  "kaplanQBank":  [ { "date": "2026-09-10", "label": "...", "answered": 40, "correct": 26 } ],
  "simExams": [
    { "name": "Exam 1", "date": "2026-09-15", "score": 68, "total": 100,
      "timeUsed": 141, "timeAllowed": 150,
      "byTopic": { "I": { "answered": 8, "correct": 5 }, "IV": { "answered": 45, "correct": 28 } },
      "byUnit":  { "U1": { "answered": 30, "correct": 18 } },
      "segments": [ { "label": "1-25", "missed": 6 }, { "label": "26-50", "missed": 7 },
                    { "label": "51-75", "missed": 8 }, { "label": "76-100", "missed": 11 } ],
      "missCats": { "misread the question": 5, "did not know the rule": 12 } }
  ],
  "weakSpots": [], "strongSpots": [],
  "missedQuestions": [
    { "id": "e1q07", "date": "2026-09-15", "unitId": "U1", "topic": "IV", "lo": "LO 4.2",
      "question": "full question text",
      "myAnswer": "what he picked", "correctAnswer": "the right one",
      "rationale": "Kaplan's rationale, verbatim",
      "explanation": "the tutoring write-up - why, what the distinction is, what the distractor was built to catch" }
  ],
  "answeredCorrect": [ { "id": "e1q08", "question": "...", "note": "one line on the concept tested" } ],
  "errorPatterns": [ { "rule": "...", "count": 2, "topic": "IV",
                       "occurrences": ["e1q07"], "note": "..." } ],
  "priorSnapshot": { "asOf": "2026-09-10", "pooledPct": 66.1, "units": { "U1": 61.4 },
                     "missIds": ["e1q07"], "patternRules": ["..."], "activityIds": ["Exam 1"] }
}
```

Every field is optional except `meta`; omitted arrays default to empty. Dates are
`YYYY-MM-DD`. **`explanation` on every miss is the highest-value field on the
page - never ship a payload with misses that lack it.**

If the run could not reach Kaplan, emit a payload that leaves `lastVerified` at
its previous value, increments `noDataRuns`, and changes nothing else.

## Writing the data back

- Append to the arrays. A new simulated exam is a **one-line append to `simExams`**
  plus the write-ups - nothing else.
- Write missed-question explanations into `missedQuestions`; the Study Guide tab
  renders them.
- Add any rule missed twice to `errorPatterns` with its count. **The same rule missed
  twice is the strongest signal this thing produces - always surface it.**
- Update `META`: `lastVerified` (today, only on a real read), `lastRunAttempted`,
  `source: "kaplan"`, the activity counts, `studyPlanPct`, `lastActivityDate`, and
  reset `noDataRuns` to 0.
- Update `PRIOR_SNAPSHOT` **last**, to the state as of this run, so the next run's
  delta briefing is computed rather than guessed. Shape:
  `{ asOf, pooledPct, units: {id: pct}, missIds: [], patternRules: [], activityIds: [] }`
- Everything else recomputes. Do not hand-edit a derived value.

### Exam date
`META.examDate` stays `null` until Austin books one. **Do not write a dated
day-by-day study plan without a date.** On the Series 7 file an undated plan slid
forward by one day on four consecutive runs before it got retired. Booking the date
is the standing top action until it is set.

---

## If nothing is new - expect this to be the common case

- Update the last-updated stamp and day counts (bound, so this is a data change)
- **State plainly that no activity was logged and for how many days, and lead with
  it.** A gap in activity is a real finding, not a footnote to unchanged scores.
- Re-check whether any dated advice has been overtaken by the calendar; rewrite it
  rather than letting it slide forward
- **Do not invent work and do not re-decompose old quizzes to look busy**
- Still run the sanity check, still audit all six tabs, still regenerate the Claude
  Paste tab, still commit and push

## Prose staleness is a defect, not cosmetic

With full data-binding a *number* cannot go stale, but a prose *claim* still can -
"Topic IV is your weakest area" stops being true when it isn't. Every run, re-read the
prose in the Study Guide and Dump Sheet tabs and check each claim against the current
arrays. If a claim has been overtaken, rewrite it. **If the same claim keeps needing
rewriting, derive it instead.**

## Consecutive no-data runs

Track `META.noDataRuns`. If a scheduled run reaches a login page several times
running, **say so loudly and recommend pausing the schedule.** A job returning the
same answer repeatedly is not gathering information. This is not hypothetical: the
Series 7 version spent nine consecutive days reading a login page and producing a
report that only re-dated a frozen file.

---

## Before committing

```bash
node tools/apply-payload.js payload.json   # Path B only
node tools/sanity-check.js                 # always
```

28 checks. **Do not push a file that fails it.** The `data-bind` resolution check is
the important one now that there is no second file to reconcile against.

Then commit and push, with a message saying what actually changed:

```
Sim 2 logged, 71.2% -> pooled 68.4%
no new activity, day 6
```

The commit history becomes a free study log. Push to
`claude/series-66-study-dashboard-19e89h`; GitHub Pages serves the live site from it.
Pages takes 30-60 seconds to redeploy and caches - if the site looks stale, hard-refresh
before hunting for a bug.

## End every run with the live link

The dashboard is the deliverable, not the report. Finish every run by giving
Austin a link he can open and interact with straight away:

```
https://alam-2102.github.io/S66/?v=<short-sha>
```

Use the short SHA of the commit you just pushed. GitHub Pages caches hard and
hard-refreshing on a phone is awkward; the `?v=` makes the browser treat it as a
new URL, so tapping the link always loads the build you just pushed. The query
string is ignored for file lookup, so it serves the same page.

Pages takes 30-60 seconds to redeploy. **Confirm it is actually live before
sending the link** - fetch the URL and check it contains something only the new
build has, rather than assuming the push was enough. Do not send a link to a
build that has not deployed.

## Reporting back

Short, direct, plain prose, minimal markdown. Write like a study partner, not a report
generator.

- Progress snapshot
- What is new, or plainly that nothing is
- 2-4 newly missed questions with real tutoring explanations
- Current weak topics, led by pooled per-unit scores
- One concrete next focus

Where a unit's exam performance diverges from its pooled score, say which to believe
and why - **exam-conditions data wins**.

If the run could not reach Kaplan: change nothing substantive, say so explicitly,
and state which figures were not re-verified and as of when they are current.
**Never let an unverified run look like a verified one.**
