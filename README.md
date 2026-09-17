# Series 66 study dashboard

A single self-contained dashboard for the NASAA Uniform Combined State Law
Examination, kept current by a sync job that reads real Kaplan data.

**Live:** https://alam-2102.github.io/S66/

## The deliverable

`index.html` at the repo root. One file, all CSS and JS inline, no build step, no
bundler, no npm dependencies at runtime. Chart.js loads from a CDN at the bottom of
the script and the page falls back to readable tables if it is unreachable.

Six tabs: Performance, Practice & Sim Exams, Study Guide, Reference Sheet, Dump
Sheet, Claude Paste.

## The two rules the architecture enforces

**Real data only.** Every number comes from Kaplan. No placeholder scores, no
illustrative numbers, no example data, no synthetic units. When there is no data the
arrays are empty and the dashboard renders an explicit "no data yet" state. An empty
dashboard is correct; a populated fake one is worse than nothing.

**No typed numbers.** Every figure shown anywhere — including inside hand-written
prose — is injected from the data arrays at render time through `data-bind`. A
`bindAll()` pass runs on load and after any data change. Nothing is ever typed into
the HTML, so a figure cannot drift from the data that produced it.

Exam-rule constants on the Reference and Dump tabs (AUM thresholds, statute periods)
are static regulatory facts, not performance data, and are written out.

## The readiness metric

```
pooled = (QBank correct + Exam correct) / (QBank answered + Exam answered)
```

Every question counted exactly once. Not a weighted blend of category averages.

Mixed and cumulative review quizzes and simulated exams are drawn from the QBank, so
their questions are already inside the QBank counts. They are reported alongside the
pooled score as a separate counterweight column and never added back into it.

Reweighted against the blueprint:

```
0.08×T1 + 0.17×T2 + 0.30×T3 + 0.45×T4
```

## The exam

Written by NASAA, administered by FINRA. 100 scored questions plus 10 pretest = 110
total, in 150 minutes — about 82 seconds a question. **Passing score 73%.**
Co-requisite with the Series 7.

| Topic | Weight | Questions |
|---|---|---|
| I — Economic Factors and Business Information | 8% | 8 |
| II — Investment Vehicle Characteristics | 17% | 17 |
| III — Client/Customer Investment Recommendations and Strategies | 30% | 30 |
| IV — Laws, Regulations and Guidelines, incl. Prohibition on Unethical Business Practice | **45%** | **45** |

Verified against `Series-66-Outline-June-2023.pdf`, fetched directly from NASAA,
effective 12 June 2023. Several prep vendors publish 5/20/30/45 for this exam; that
does not match NASAA's published test specifications. If you re-verify, verify
against NASAA's own PDF, not a vendor summary.

## Syncing

The sync needs browser control of a machine with a live, logged-in Kaplan session. A
cloud session cannot do it — no access to the browser's cookies, and Kaplan refuses
its requests.

From a local clone, with browser tooling attached:

```
/s66-sync
```

The playbook is `.claude/skills/s66-sync/SKILL.md` — Kaplan navigation, the
question-by-question capture procedure, what to do when the session has expired, and
the rules for writing data back.

## Getting data in from a session that has no clone

`COWORK-BRIEF.md` is a ready-to-paste brief for Cowork or any other Claude
surface that can drive Chrome but has no clone of this repo. It is self-contained:
paste it, make sure Kaplan is logged in, and tell it to run. It ends by printing a
JSON payload.

That payload then gets applied mechanically:

```bash
node tools/apply-payload.js payload.json   # validates, then writes the SYNC block
node tools/sanity-check.js
```

`apply-payload.js` refuses a payload that claims to have verified something with
empty arrays, has unit split weights that don't sum to 1, has `correct` exceeding
`answered`, or leaves a unit unmapped. The schema is in the skill.

Nothing is ever hand-typed into the dashboard: `index.html` has a single marked
`SYNC` block and the script writes that block and nothing else.

## Before every commit

```bash
node tools/sanity-check.js
```

28 checks against a stubbed DOM: the script runs clean, the pooled score matches an
independent recomputation from the raw arrays, every unit resolves into the topic
buckets with split weights summing to 1, topic question counts sum to 100,
`renderSimulated(0)` called five times produces a stable row count, and **every
`data-bind` attribute resolves to a real key** — the main failure mode now that there
is no second file to reconcile against.

Do not push a file that fails it.

## Layout

```
index.html                        the dashboard — the deliverable
tools/sanity-check.js             pre-commit checks
.claude/skills/s66-sync/SKILL.md  the Kaplan sync playbook
```
