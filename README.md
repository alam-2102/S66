# Series 66 study dashboard

A progress dashboard for the NASAA Uniform Combined State Law Examination, with an
importer that pulls your numbers out of the Kaplan student portal.

Open `index.html`. That's it — no build step, no dependencies, works offline and
from a `file://` URL. Press **Sample data** to see it filled in before you have any
data of your own.

## What it shows

- **Weighted projected score** — your accuracy per content area, weighted by that
  area's share of the exam, against the 75 you need. One number, the one that matters.
- **Readiness** — four bars you set yourself, deliberately above 75 so a bad exam
  morning still clears.
- **Score trend** — cumulative QBank accuracy against each practice exam, one axis.
- **Accuracy by content area** — all four NASAA areas against the pass mark.
- **Where your lost points are** — expected scored questions missed per area
  (exam weight × your miss rate). This is the study-next list: a weak area worth 42
  questions costs you five times what one worth 8 does.
- **Study time by week.**

Every chart has a table view behind the **Table** button, and the whole thing has
a dark mode.

## Getting your data in

### Pull it from Kaplan

Kaplan publishes no API for student progress, so the importer works the way you
would: it drives a real browser. **You** log in — at the real Kaplan login page, with
your own hands — and the script takes over from there, recording what the portal
sends while you click through your progress pages. It never asks for, sees, or
stores your password, and it keeps response bodies only: no cookies, no tokens, no
request headers.

```bash
cd importer
npm install
npx playwright install chromium     # once
node capture.mjs                    # a browser opens; log in, browse, press Enter
node parse.mjs                      # writes ../data/progress.js
```

Then reopen `index.html`.

`capture.mjs --url https://your.portal.url` starts somewhere specific;
`--auto` also clicks through progress-looking links itself after you've logged in.

Worth knowing before you rely on this:

- **Check Kaplan's terms of use.** This pulls your own data from a service you pay
  for, which is reasonable, but automated access may be restricted. The script does
  one unhurried pass and nothing more.
- **It will break when Kaplan changes their site.** Field names are matched by
  family rather than fixed paths, which survives small changes but not redesigns.
- `importer/captured/` holds your personal data and is gitignored. Delete it whenever.

If `parse.mjs` guesses wrong:

```bash
node parse.mjs --inspect    # dump every candidate array and its keys
node parse.mjs --dry        # show what it found, write nothing
node parse.mjs --merge      # add to existing entries instead of replacing
```

and correct it in `importer/mapping.json` — `areaOverrides` forces a unit onto a
content area, `endpoints` narrows parsing to the URLs you know hold your data, and
`ignoreUnits` drops chapters you don't want counted.

### Or log it by hand

Works with no Kaplan involvement at all, and covers study time Kaplan doesn't track:

```bash
node importer/log.mjs --minutes 60 --activity qbank \
                      --answered 40 --correct 31 --unit "Unethical Business Practices"
node importer/log.mjs --exam "Mastery Exam 3" --score 78 --minutes 130
node importer/log.mjs --exam-date 2026-11-14     # adds a countdown and pacing
node importer/log.mjs --target-exam 82           # move a readiness bar
node importer/log.mjs --show
```

Unit names are matched to content areas automatically where possible
(`"Unethical Business Practices"` → `laws`).

### Or edit the file

`data/progress.js` is a plain object. `data/schema.md` documents every field.

## Layout

```
index.html              the dashboard
assets/dashboard.js     rendering and the derived numbers
assets/sample.js        demo dataset behind the "Sample data" button
data/exam.js            NASAA blueprint — content areas and weights (static)
data/progress.js        your progress (the importer overwrites this)
data/schema.md          field-by-field documentation
importer/capture.mjs    you log in, it records
importer/parse.mjs      captured payloads -> data/progress.js
importer/log.mjs        log a session by hand
importer/mapping.json   corrections for when the parser guesses wrong
importer/serve.mjs      optional local http server
```

`node importer/serve.mjs` serves it at <http://localhost:8066> if you'd rather not
use `file://`.

## The exam

100 scored questions (plus 10 unscored pretest), 150 minutes, **75% to pass**.
Content areas and weights, from the NASAA outline:

| Area | Share | Questions |
|---|---|---|
| Economic Factors and Business Information | 8% | 8 |
| Investment Vehicle Characteristics | 20% | 20 |
| Client/Client Investment Recommendations and Strategies | 30% | 30 |
| Laws, Regulations, and Guidelines, incl. Prohibition on Unethical Business Practices | 42% | 42 |

Verify against NASAA's current outline before exam day — if it changes, edit
`data/exam.js` and every chart follows.
