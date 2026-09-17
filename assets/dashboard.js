/* Series 66 dashboard — no build step, no dependencies.
 * Reads window.S66_EXAM (blueprint) + window.S66_DATA (your progress).
 */
(function () {
  "use strict";

  var EXAM = window.S66_EXAM;
  var PASS = EXAM.passingScorePct;
  var usingSample = false;

  /* ---------------- small helpers ---------------- */

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pct(v, dp) { return v == null ? "—" : v.toFixed(dp == null ? 0 : dp) + "%"; }
  function num(v) { return v == null ? "—" : Math.round(v).toLocaleString(); }
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function parseDate(s) {
    var p = String(s).split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }
  function fmtDate(s) {
    var d = parseDate(s);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  }
  function mondayOf(s) {
    var d = parseDate(s);
    var dow = (d.getUTCDay() + 6) % 7;     // Mon = 0
    d.setUTCDate(d.getUTCDate() - dow);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /* status for a value against a target: good / warning / critical / muted */
  function statusOf(value, target) {
    if (value == null) return "muted";
    if (value >= target) return "good";
    if (value >= target - 10) return "warning";
    return "critical";
  }
  var STATUS_ICON = { good: "●", warning: "▲", critical: "■", muted: "○" };
  var STATUS_WORD = { good: "on target", warning: "close", critical: "not yet", muted: "no data" };
  var STATUS_SHORT = { good: "clears", warning: "close", critical: "short", muted: "—" };

  /* ---------------- model ---------------- */

  function buildModel(data) {
    var m = { meta: data.meta || {}, hasAnyData: false };
    var targets = (data.meta && data.meta.targets) || {};
    m.targets = {
      qbankAccuracyPct: targets.qbankAccuracyPct != null ? targets.qbankAccuracyPct : 70,
      examScorePct: targets.examScorePct != null ? targets.examScorePct : 80,
      courseCompletePct: targets.courseCompletePct != null ? targets.courseCompletePct : 100
    };

    var units = data.units || [];
    var qbank = (data.qbank || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var exams = (data.exams || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var study = (data.study || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    m.units = units; m.qbank = qbank; m.exams = exams; m.study = study;
    m.latestExam = exams.length ? exams[exams.length - 1] : null;
    m.prevExam = exams.length > 1 ? exams[exams.length - 2] : null;
    m.hasAnyData = !!(units.length || qbank.length || exams.length || study.length ||
                      (data.areas && Object.keys(data.areas).length));

    /* ---- per-area rollup ---- */
    var bucket = {};
    EXAM.areas.forEach(function (a) {
      bucket[a.id] = { answered: 0, correct: 0, mSum: 0, mN: 0, lTotal: 0, lDone: 0, unitCount: 0 };
    });
    if (units.length) {
      units.forEach(function (u) {
        var b = bucket[u.area];
        if (!b) return;
        b.answered += u.answered || 0;
        b.correct += u.correct || 0;
        if (typeof u.masteryPct === "number") { b.mSum += u.masteryPct; b.mN++; }
        b.lTotal += u.lessonsTotal || 0;
        b.lDone += u.lessonsComplete || 0;
        b.unitCount++;
      });
    } else if (data.areas) {
      Object.keys(data.areas).forEach(function (k) {
        var b = bucket[k], src = data.areas[k];
        if (!b || !src) return;
        b.answered = src.answered || 0;
        b.correct = src.correct || 0;
        if (typeof src.masteryPct === "number") { b.mSum = src.masteryPct; b.mN = 1; }
      });
    }

    var lat = m.latestExam;
    m.areas = EXAM.areas.map(function (a) {
      var b = bucket[a.id];
      var acc = null, basis = null;
      if (b.answered > 0) { acc = b.correct / b.answered * 100; basis = "qbank"; }
      else if (lat && lat.byArea && typeof lat.byArea[a.id] === "number") {
        acc = lat.byArea[a.id]; basis = "exam";
      }
      return {
        id: a.id, name: a.name, shortName: a.shortName,
        weightPct: a.weightPct, questions: a.questions,
        answered: b.answered, correct: b.correct,
        masteryPct: b.mN ? b.mSum / b.mN : null,
        accuracyPct: acc, basis: basis,
        expectedMissed: acc == null ? null : a.questions * (1 - acc / 100),
        lessonsTotal: b.lTotal, lessonsComplete: b.lDone, unitCount: b.unitCount
      };
    });

    /* ---- headline: weighted projected score ---- */
    var covered = 0, earned = 0;
    m.areas.forEach(function (a) {
      if (a.accuracyPct == null) return;
      covered += a.questions;
      earned += a.questions * a.accuracyPct / 100;
    });
    m.coveredQuestions = covered;
    m.coveragePct = covered / EXAM.scoredQuestions * 100;
    m.weightedScorePct = covered > 0 ? earned / covered * 100 : null;
    m.expectedMissedTotal = m.areas.reduce(function (s, a) {
      return s + (a.expectedMissed == null ? 0 : a.expectedMissed);
    }, 0);

    /* ---- QBank totals ----
     * Straight off `units` so a unit the importer could not map to a content area
     * still counts toward your totals; falls back to area rollups, then sittings. */
    var tAns = 0, tCor = 0;
    if (units.length) {
      units.forEach(function (u) { tAns += u.answered || 0; tCor += u.correct || 0; });
    } else {
      m.areas.forEach(function (a) { tAns += a.answered; tCor += a.correct; });
    }
    if (tAns === 0) {
      qbank.forEach(function (q) { tAns += q.answered || 0; tCor += q.correct || 0; });
    }
    m.unmappedUnits = units.filter(function (u) {
      return !EXAM.areas.some(function (a) { return a.id === u.area; });
    });
    m.qbankAnswered = tAns;
    m.qbankCorrect = tCor;
    m.qbankAccuracyPct = tAns > 0 ? tCor / tAns * 100 : null;

    /* ---- cumulative QBank series ---- */
    var ra = 0, rc = 0;
    m.qbankSeries = qbank.map(function (q) {
      ra += q.answered || 0; rc += q.correct || 0;
      return {
        date: q.date, label: q.label || null,
        sessionPct: q.answered ? (q.correct / q.answered) * 100 : null,
        cumulativePct: ra ? rc / ra * 100 : null,
        cumulativeAnswered: ra
      };
    });

    /* ---- course completion ---- */
    var lt = 0, ld = 0;
    units.forEach(function (u) { lt += u.lessonsTotal || 0; ld += u.lessonsComplete || 0; });
    m.lessonsTotal = lt; m.lessonsComplete = ld;
    m.coursePct = lt > 0 ? ld / lt * 100 : null;

    /* ---- study time ---- */
    var mins = 0;
    study.forEach(function (s) { mins += s.minutes || 0; });
    m.studyMinutes = mins;
    m.lastStudyDate = study.length ? study[study.length - 1].date : null;
    m.daysSinceStudy = m.lastStudyDate ? daysBetween(m.lastStudyDate, todayISO()) : null;

    var weeks = {};
    study.forEach(function (s) {
      var w = mondayOf(s.date);
      weeks[w] = (weeks[w] || 0) + (s.minutes || 0);
    });
    var wKeys = Object.keys(weeks).sort();
    if (wKeys.length) {                                // fill gap weeks with zero
      var cur = parseDate(wKeys[0]), end = parseDate(wKeys[wKeys.length - 1]), filled = [];
      while (cur <= end) {
        var k = cur.toISOString().slice(0, 10);
        filled.push({ week: k, minutes: weeks[k] || 0 });
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
      m.studyWeeks = filled.slice(-12);
    } else {
      m.studyWeeks = [];
    }

    /* ---- weakest area (areas with data only) ---- */
    var withData = m.areas.filter(function (a) { return a.accuracyPct != null; });
    m.weakestArea = withData.length
      ? withData.slice().sort(function (a, b) { return a.accuracyPct - b.accuracyPct; })[0]
      : null;

    /* ---- exam date pacing ---- */
    m.examDate = m.meta.examDate || null;
    m.daysToExam = m.examDate ? daysBetween(todayISO(), m.examDate) : null;

    return m;
  }

  /* ---------------- empty state ---------------- */

  function emptyState(host, title, body) {
    host.innerHTML = "";
    var e = el("div", "empty");
    e.appendChild(el("b", null, title));
    e.appendChild(document.createTextNode(body));
    host.appendChild(e);
  }

  /* ---------------- hero ---------------- */

  function renderHero(m) {
    var valEl = $("hero-val"), metaEl = $("hero-meta"), meter = $("hero-meter");

    if (m.weightedScorePct == null) {
      valEl.className = "hero-fig none";
      valEl.innerHTML = "—";
      metaEl.textContent = m.hasAnyData
        ? "No per-question results yet — log a QBank session or a practice exam to project a score."
        : "No data yet. Run an import or log a session; the numbers land here.";
      meter.hidden = true;
      return;
    }

    var v = m.weightedScorePct;
    valEl.className = "hero-fig";
    valEl.innerHTML = v.toFixed(1) + '<span class="unit">/ 100</span>';

    var gap = v - PASS;
    var parts = [];
    parts.push(gap >= 0
      ? "+" + gap.toFixed(1) + " above the 75 pass mark"
      : Math.abs(gap).toFixed(1) + " below the 75 pass mark");
    parts.push("expect to miss ~" + m.expectedMissedTotal.toFixed(0) + " of " + EXAM.scoredQuestions);
    parts.push(m.coveragePct >= 99.5
      ? "all four content areas have data"
      : "covers " + m.coveragePct.toFixed(0) + "% of the blueprint");
    if (m.daysToExam != null) {
      parts.push(m.daysToExam >= 0 ? m.daysToExam + " days to exam day" : "exam date has passed");
    }
    metaEl.textContent = parts.join(" · ");

    meter.hidden = false;
    var fill = $("meter-fill");
    fill.style.width = Math.max(0, Math.min(100, v)) + "%";
    var st = statusOf(v, PASS);
    fill.style.background = st === "good" ? "var(--series-1)"
      : st === "warning" ? "var(--warning)" : "var(--critical)";
    $("meter-mark").style.left = PASS + "%";
    $("meter-pass").textContent = PASS + " to pass";
  }

  /* ---------------- readiness ---------------- */

  function renderChecks(m) {
    var host = $("checks");
    host.innerHTML = "";

    var rows = [
      {
        label: "Course material complete",
        value: m.coursePct,
        target: m.targets.courseCompletePct,
        detail: m.lessonsTotal
          ? m.lessonsComplete + " of " + m.lessonsTotal + " lessons"
          : "no lesson data"
      },
      {
        label: "QBank accuracy",
        value: m.qbankAccuracyPct,
        target: m.targets.qbankAccuracyPct,
        detail: m.qbankAnswered ? num(m.qbankAnswered) + " questions answered" : "no questions answered"
      },
      {
        label: "Latest practice exam",
        value: m.latestExam ? m.latestExam.scorePct : null,
        target: m.targets.examScorePct,
        detail: m.latestExam
          ? m.latestExam.name + " on " + fmtDate(m.latestExam.date)
          : "no practice exam taken"
      },
      {
        label: "Weakest content area clears " + PASS,
        value: m.weakestArea ? m.weakestArea.accuracyPct : null,
        target: PASS,
        detail: m.weakestArea
          ? m.weakestArea.shortName + " is lowest"
          : "no per-area data"
      }
    ];

    rows.forEach(function (r) {
      var st = statusOf(r.value, r.target);
      var li = el("li");

      var ico = el("span", "ico " + st, STATUS_ICON[st]);
      ico.setAttribute("aria-hidden", "true");
      li.appendChild(ico);

      var lab = el("span", "check-label");
      lab.appendChild(el("b", null, r.label));
      lab.appendChild(document.createTextNode(" — " + r.detail));
      li.appendChild(lab);

      var state = el("span", "check-state",
        (r.value == null ? "—" : pct(r.value)) + " / " + r.target + "% · " + STATUS_WORD[st]);
      li.appendChild(state);

      host.appendChild(li);
    });
  }

  /* ---------------- sparkline ---------------- */

  function sparkline(values) {
    var W = 120, H = 26, pad = 3;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "spark");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    if (values.length < 2) return svg;

    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (hi - lo < 1) { hi = lo + 1; }
    var x = function (i) { return pad + i * (W - 2 * pad) / (values.length - 1); };
    var y = function (v) { return H - pad - (v - lo) / (hi - lo) * (H - 2 * pad); };

    var pts = values.map(function (v, i) { return x(i) + "," + y(v); });
    var base = document.createElementNS(svg.namespaceURI, "polyline");
    base.setAttribute("points", pts.join(" "));
    base.setAttribute("fill", "none");
    base.setAttribute("stroke", "var(--deemph)");
    base.setAttribute("stroke-width", "2");
    base.setAttribute("stroke-linejoin", "round");
    base.setAttribute("stroke-linecap", "round");
    base.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(base);

    var tail = document.createElementNS(svg.namespaceURI, "polyline");
    tail.setAttribute("points", pts.slice(-2).join(" "));
    tail.setAttribute("fill", "none");
    tail.setAttribute("stroke", "var(--series-1)");
    tail.setAttribute("stroke-width", "2");
    tail.setAttribute("stroke-linecap", "round");
    tail.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(tail);

    return svg;
  }

  /* ---------------- KPI row ---------------- */

  function renderKpis(m) {
    var host = $("kpis");
    host.innerHTML = "";

    var examDelta = null;
    if (m.latestExam && m.prevExam) {
      examDelta = m.latestExam.scorePct - m.prevExam.scorePct;
    }

    var tiles = [
      {
        label: "QBank accuracy",
        value: m.qbankAccuracyPct == null ? "—" : m.qbankAccuracyPct.toFixed(0),
        unit: m.qbankAccuracyPct == null ? "" : "%",
        sub: m.qbankAnswered ? num(m.qbankAnswered) + " questions · target " +
             m.targets.qbankAccuracyPct + "%" : "target " + m.targets.qbankAccuracyPct + "%",
        spark: m.qbankSeries.length > 2
          ? m.qbankSeries.slice(-12).map(function (p) { return p.cumulativePct; })
          : null
      },
      {
        label: "Questions answered",
        value: m.qbankAnswered ? num(m.qbankAnswered) : "—",
        unit: "",
        sub: m.qbank.length
          ? m.qbank.length + " sittings · " + num(m.qbankCorrect) + " correct"
          : "no sittings logged"
      },
      {
        label: "Latest practice exam",
        value: m.latestExam ? String(m.latestExam.scorePct) : "—",
        unit: m.latestExam ? "%" : "",
        sub: m.latestExam
          ? (examDelta == null
              ? m.latestExam.name
              : (examDelta >= 0 ? "+" : "−") + Math.abs(examDelta) + " pts vs " + m.prevExam.name)
          : "none taken yet",
        subUp: examDelta != null && examDelta > 0
      },
      {
        label: "Study time logged",
        value: m.studyMinutes ? (m.studyMinutes / 60).toFixed(0) : "—",
        unit: m.studyMinutes ? "h" : "",
        sub: m.daysSinceStudy == null
          ? "no sessions logged"
          : (m.daysSinceStudy === 0 ? "studied today"
             : m.daysSinceStudy === 1 ? "last studied yesterday"
             : "last studied " + m.daysSinceStudy + " days ago")
      }
    ];

    tiles.forEach(function (t) {
      var c = el("div", "kpi");
      c.appendChild(el("p", "k-label", t.label));
      var v = el("div", "k-val" + (t.value === "—" ? " none" : ""));
      v.appendChild(document.createTextNode(t.value));
      if (t.unit) v.appendChild(el("span", "unit", t.unit));
      c.appendChild(v);
      c.appendChild(el("p", "k-sub" + (t.subUp ? " up" : ""), t.sub));
      if (t.spark) c.appendChild(sparkline(t.spark));
      host.appendChild(c);
    });
  }

  /* ---------------- horizontal bar chart ---------------- */
  /* rows: [{ name, sub, value, display, max, tip }]  — one series, one hue */

  function renderBars(host, rows, opts) {
    opts = opts || {};
    host.innerHTML = "";
    var wrap = el("div", "bars");
    var max = opts.max || Math.max.apply(null, rows.map(function (r) {
      return r.value == null ? 0 : r.value;
    })) || 1;

    rows.forEach(function (r) {
      var row = el("div", "bar-row");
      row.title = r.tip || "";

      var nm = el("div", "bar-name");
      nm.appendChild(document.createTextNode(r.name));
      if (r.sub) nm.appendChild(el("span", null, r.sub));
      row.appendChild(nm);

      var lane = el("div", "bar-lane");
      var meta = el("div", "bar-meta");

      if (r.value == null) {
        lane.appendChild(el("span", "bar-empty", "no data yet"));
        meta.appendChild(el("span", "v", "\u2014"));
      } else {
        var fill = el("div", "bar-fill");
        fill.style.width = Math.max(0, Math.min(100, r.value / max * 100)) + "%";
        lane.appendChild(fill);

        if (opts.refAt != null) {
          var ref = el("div", "bar-ref");
          ref.style.left = (opts.refAt / max * 100) + "%";
          lane.appendChild(ref);
        }

        meta.appendChild(el("span", "v", r.display));
        /* status never rides on color alone — the icon always carries a word */
        if (r.status) {
          var st = el("span", "st");
          var ico = el("span", "ico " + r.status.kind, STATUS_ICON[r.status.kind]);
          ico.setAttribute("aria-hidden", "true");
          st.appendChild(ico);
          st.appendChild(document.createTextNode(r.status.word));
          meta.appendChild(st);
        }
      }

      row.appendChild(lane);
      row.appendChild(meta);
      wrap.appendChild(row);
    });

    host.appendChild(wrap);

    if (opts.refLabel) {
      var key = el("div", "ref-key");
      var k = el("span");
      k.innerHTML = "<i></i>" + opts.refLabel;
      key.appendChild(k);
      host.appendChild(key);
    }
  }

  /* ---------------- column chart ---------------- */

  function renderColumns(host, rows) {
    host.innerHTML = "";
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;

    var plot = el("div", "cols");
    rows.forEach(function (r) {
      var slot = el("div", "col-slot");
      var fill = el("div", "col-fill");
      fill.style.height = Math.max(r.value > 0 ? 2 : 0, r.value / max * 100) + "%";
      slot.title = r.tip;
      slot.appendChild(fill);
      plot.appendChild(slot);
    });
    host.appendChild(plot);

    var axis = el("div", "col-axis");
    rows.forEach(function (r) { axis.appendChild(el("div", "col-tick", r.tick)); });
    host.appendChild(axis);
  }

  /* ---------------- table view ---------------- */

  function renderTable(host, caption, head, body) {
    host.innerHTML = "";
    var scroll = el("div", "scroll-x");
    var t = el("table", "dv");
    var cap = el("caption", null, caption);
    t.appendChild(cap);
    var thead = el("thead"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    thead.appendChild(tr);
    t.appendChild(thead);
    var tb = el("tbody");
    body.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (c) { row.appendChild(el("td", null, c)); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    scroll.appendChild(t);
    host.appendChild(scroll);
  }

  /* ---------------- line chart (score trend) ---------------- */

  var trendState = null;

  function drawTrend() {
    var host = $("trend-chart");
    var m = trendState;
    if (!m) return;

    var qs = m.qbankSeries.filter(function (p) { return p.cumulativePct != null; });
    var ex = m.exams;
    if (!qs.length && !ex.length) {
      emptyState(host, "Nothing to plot yet",
        "Once you have a QBank sitting or a practice exam on record, this shows both against the 75 pass line.");
      return;
    }

    host.innerHTML = "";
    var legend = el("div", "legend");
    function key(color, text) {
      var s = el("span");
      var i = el("i"); i.style.background = color;
      s.appendChild(i); s.appendChild(document.createTextNode(text));
      return s;
    }
    if (qs.length) legend.appendChild(key("var(--series-1)", "QBank accuracy (cumulative)"));
    if (ex.length) legend.appendChild(key("var(--series-2)", "Practice exams"));
    host.appendChild(legend);

    var shell = el("div", "chart-host");
    host.appendChild(shell);

    var W = Math.max(280, shell.clientWidth || host.clientWidth || 640);
    var H = 268;
    var padL = 34, padR = 58, padT = 14, padB = 30;

    /* domains */
    var allDates = qs.map(function (p) { return p.date; }).concat(ex.map(function (e) { return e.date; }));
    allDates.sort();
    var t0 = parseDate(allDates[0]).getTime();
    var t1 = parseDate(allDates[allDates.length - 1]).getTime();
    if (t1 === t0) { t1 = t0 + 86400000; t0 = t0 - 86400000; }

    var vals = qs.map(function (p) { return p.cumulativePct; })
      .concat(ex.map(function (e) { return e.scorePct; })).concat([PASS]);
    var lo = Math.floor(Math.min.apply(null, vals) / 10) * 10 - 5;
    var hi = 100;
    lo = Math.max(0, Math.min(lo, PASS - 10));

    var X = function (d) { return padL + (parseDate(d).getTime() - t0) / (t1 - t0) * (W - padL - padR); };
    var Y = function (v) { return padT + (hi - v) / (hi - lo) * (H - padT - padB); };

    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "line-chart");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Cumulative QBank accuracy and practice exam scores over time");

    function add(tag, attrs, text) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (text != null) n.textContent = text;
      svg.appendChild(n);
      return n;
    }

    /* gridlines + y ticks — solid hairlines, recessive */
    var step = (hi - lo) > 55 ? 20 : 10;
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      add("line", { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v),
                    stroke: "var(--grid)", "stroke-width": 1 });
      add("text", { x: padL - 8, y: Y(v) + 4, "text-anchor": "end", fill: "var(--text-muted)",
                    "font-size": 11, "font-family": "inherit",
                    style: "font-variant-numeric:tabular-nums" }, v);
    }

    /* pass line — labelled at the left, where the series end-labels aren't */
    add("line", { x1: padL, x2: W - padR, y1: Y(PASS), y2: Y(PASS),
                  stroke: "var(--axis)", "stroke-width": 1 });
    add("text", { x: padL + 3, y: Y(PASS) - 6, fill: "var(--text-muted)",
                  "font-size": 11, "font-family": "inherit" }, PASS + " to pass");

    /* x axis */
    add("line", { x1: padL, x2: W - padR, y1: Y(lo), y2: Y(lo),
                  stroke: "var(--axis)", "stroke-width": 1 });
    var xticks = [allDates[0], allDates[allDates.length - 1]];
    if (allDates.length > 4) xticks.splice(1, 0, allDates[Math.floor(allDates.length / 2)]);
    xticks.forEach(function (d, i) {
      add("text", { x: X(d), y: H - 10,
                    "text-anchor": i === 0 ? "start" : (i === xticks.length - 1 ? "end" : "middle"),
                    fill: "var(--text-muted)", "font-size": 11, "font-family": "inherit" }, fmtDate(d));
    });

    function polyline(points, color) {
      if (points.length < 2) return;
      add("polyline", {
        points: points.map(function (p) { return X(p.d) + "," + Y(p.v); }).join(" "),
        fill: "none", stroke: color, "stroke-width": 2,
        "stroke-linejoin": "round", "stroke-linecap": "round"
      });
    }
    function marker(p, color) {
      add("circle", { cx: X(p.d), cy: Y(p.v), r: 4, fill: color,
                      stroke: "var(--surface-1)", "stroke-width": 2 });
    }
    /* Direct end-labels, nudged apart when the two series converge. A nudged label
     * gets a leader line back to its point, so it never detaches from its series. */
    function endLabels(items) {
      var live = items.filter(Boolean);
      if (live.length === 2 && Math.abs(live[0].y - live[1].y) < 13) {
        var mid = (live[0].y + live[1].y) / 2;
        var hi = live[0].y <= live[1].y ? live[0] : live[1];
        var lo2 = hi === live[0] ? live[1] : live[0];
        hi.ly = mid - 7.5;
        lo2.ly = mid + 7.5;
      }
      live.forEach(function (it) {
        var ly = it.ly == null ? it.y : it.ly;
        if (it.ly != null) {
          add("line", { x1: it.x + 4, y1: it.y, x2: it.x + 7, y2: ly - 3.5,
                        stroke: "var(--axis)", "stroke-width": 1 });
        }
        add("text", { x: it.x + 10, y: ly + 4, fill: "var(--text-primary)",
                      "font-size": 11.5, "font-family": "inherit",
                      style: "font-variant-numeric:tabular-nums" }, it.text);
      });
    }

    var qPts = qs.map(function (p) { return { d: p.date, v: p.cumulativePct }; });
    var ePts = ex.map(function (e) { return { d: e.date, v: e.scorePct }; });

    polyline(qPts, "var(--series-1)");
    polyline(ePts, "var(--series-2)");
    ePts.forEach(function (p) { marker(p, "var(--series-2)"); });
    if (qPts.length) marker(qPts[qPts.length - 1], "var(--series-1)");

    /* selective direct labels: series endpoints only */
    function endItem(pts) {
      if (!pts.length) return null;
      var p = pts[pts.length - 1];
      return { x: X(p.d), y: Y(p.v), ly: null, text: p.v.toFixed(0) + "%" };
    }
    endLabels([endItem(qPts), endItem(ePts)]);

    var cross = add("line", { x1: 0, x2: 0, y1: padT, y2: Y(lo),
                              stroke: "var(--axis)", "stroke-width": 1, opacity: 0 });

    shell.appendChild(svg);

    /* ---- hover layer: crosshair + tooltip, snapped to nearest date ---- */
    var tip = el("div", "tip");
    shell.appendChild(tip);

    var byDate = {};
    qs.forEach(function (p) {
      byDate[p.date] = byDate[p.date] || {};
      byDate[p.date].qbank = p;
    });
    ex.forEach(function (e) {
      byDate[e.date] = byDate[e.date] || {};
      byDate[e.date].exam = e;
    });
    var dates = Object.keys(byDate).sort();

    function show(clientX) {
      var box = svg.getBoundingClientRect();
      var px = clientX - box.left;
      var best = null, bestDist = Infinity;
      dates.forEach(function (d) {
        var dist = Math.abs(X(d) - px);
        if (dist < bestDist) { bestDist = dist; best = d; }
      });
      if (best == null) return;

      var slot = byDate[best];
      cross.setAttribute("x1", X(best));
      cross.setAttribute("x2", X(best));
      cross.setAttribute("opacity", 1);

      var html = '<div class="t-date">' + fmtDate(best) + "</div>";
      if (slot.qbank) {
        html += '<div class="t-row"><span class="nm"><i style="background:var(--series-1)"></i>' +
          "QBank</span><b>" + slot.qbank.cumulativePct.toFixed(1) + "%</b></div>";
        if (slot.qbank.sessionPct != null) {
          html += '<div class="t-row"><span class="nm" style="padding-left:15px">this sitting</span><b>' +
            slot.qbank.sessionPct.toFixed(0) + "%</b></div>";
        }
      }
      if (slot.exam) {
        html += '<div class="t-row"><span class="nm"><i style="background:var(--series-2)"></i>' +
          (slot.exam.name || "Exam") + "</span><b>" + slot.exam.scorePct + "%</b></div>";
      }
      tip.innerHTML = html;
      tip.style.opacity = 1;

      var tw = tip.offsetWidth, x = X(best) + 14;
      if (x + tw > W - 4) x = X(best) - tw - 14;
      tip.style.left = Math.max(4, x) + "px";
      tip.style.top = padT + "px";
    }
    function hide() { tip.style.opacity = 0; cross.setAttribute("opacity", 0); }

    svg.addEventListener("mousemove", function (e) { show(e.clientX); });
    svg.addEventListener("mouseleave", hide);
    svg.addEventListener("touchstart", function (e) { show(e.touches[0].clientX); }, { passive: true });
    svg.addEventListener("touchmove", function (e) { show(e.touches[0].clientX); }, { passive: true });
    svg.addEventListener("touchend", hide);

    /* table twin */
    var rows = dates.map(function (d) {
      var s = byDate[d];
      return [
        fmtDate(d),
        s.qbank ? s.qbank.cumulativePct.toFixed(1) + "%" : "—",
        s.qbank && s.qbank.sessionPct != null ? s.qbank.sessionPct.toFixed(0) + "%" : "—",
        s.qbank ? num(s.qbank.cumulativeAnswered) : "—",
        s.exam ? s.exam.name + " " + s.exam.scorePct + "%" : "—"
      ];
    });
    renderTable($("trend-table"), "Score trend — every dated data point.",
      ["Date", "QBank cumulative", "That sitting", "Questions to date", "Practice exam"], rows);
  }

  /* ---------------- area + priority charts ---------------- */

  function renderAreas(m) {
    var host = $("areas-chart");
    var any = m.areas.some(function (a) { return a.accuracyPct != null; });
    if (!any) {
      emptyState(host, "No per-area results yet",
        "Import from Kaplan, or sit a practice exam that reports a per-area breakdown, and all four areas appear here against the 75 line.");
      renderTable($("areas-table"), "Accuracy by content area — no data yet.",
        ["Content area", "Share of exam", "Accuracy"],
        m.areas.map(function (a) { return [a.shortName, a.weightPct + "%", "—"]; }));
      return;
    }

    var rows = m.areas.map(function (a) {
      return {
        name: a.shortName,
        sub: a.weightPct + "% of exam · " + a.questions + " q",
        value: a.accuracyPct,
        display: a.accuracyPct == null ? "—" : a.accuracyPct.toFixed(0) + "%",
        status: a.accuracyPct == null ? null
          : { kind: statusOf(a.accuracyPct, PASS), word: STATUS_SHORT[statusOf(a.accuracyPct, PASS)] },
        tip: a.name + (a.answered ? " — " + a.correct + "/" + a.answered + " correct" :
             (a.basis === "exam" ? " — from latest practice exam" : ""))
      };
    });
    renderBars(host, rows, { max: 100, refAt: PASS, refLabel: PASS + "% pass mark" });

    renderTable($("areas-table"), "Accuracy by content area.",
      ["Content area", "Share of exam", "Scored questions", "Answered", "Correct", "Accuracy", "Basis"],
      m.areas.map(function (a) {
        return [a.name, a.weightPct + "%", String(a.questions),
                a.answered ? num(a.answered) : "—",
                a.answered ? num(a.correct) : "—",
                a.accuracyPct == null ? "—" : a.accuracyPct.toFixed(1) + "%",
                a.basis === "qbank" ? "QBank" : a.basis === "exam" ? "practice exam" : "—"];
      }));
  }

  function renderPriority(m) {
    var host = $("priority-chart");
    var withData = m.areas.filter(function (a) { return a.expectedMissed != null; });
    if (!withData.length) {
      emptyState(host, "Nothing to rank yet",
        "This ranks content areas by expected scored questions missed — exam weight times your miss rate. It needs per-area accuracy first.");
      return;
    }

    var sorted = withData.slice().sort(function (a, b) { return b.expectedMissed - a.expectedMissed; });
    renderBars(host, sorted.map(function (a) {
      return {
        name: a.shortName,
        sub: a.weightPct + "% of exam · " + (a.accuracyPct).toFixed(0) + "% accuracy",
        value: a.expectedMissed,
        display: a.expectedMissed.toFixed(1) + " q",
        tip: a.name + " — " + a.questions + " scored questions at " +
             a.accuracyPct.toFixed(0) + "% accuracy"
      };
    }));

    renderTable($("priority-table"),
      "Expected scored questions missed, worst first. Total ≈ " +
      m.expectedMissedTotal.toFixed(1) + " of " + EXAM.scoredQuestions + ".",
      ["Content area", "Scored questions", "Accuracy", "Expected missed"],
      sorted.map(function (a) {
        return [a.name, String(a.questions), a.accuracyPct.toFixed(1) + "%",
                a.expectedMissed.toFixed(1)];
      }));
  }

  /* ---------------- study time ---------------- */

  function renderStudy(m) {
    var host = $("study-chart");
    if (!m.studyWeeks.length) {
      emptyState(host, "No study time logged",
        "Log a session with node importer/log.mjs --minutes 60, or let the importer pull it if Kaplan tracks your time.");
      renderTable($("study-table"), "Study time by week — no data yet.", ["Week of", "Hours"], []);
      return;
    }

    renderColumns(host, m.studyWeeks.map(function (w) {
      return {
        value: w.minutes / 60,
        tick: fmtDate(w.week),
        tip: "Week of " + fmtDate(w.week) + " — " + (w.minutes / 60).toFixed(1) + " h"
      };
    }));

    var total = m.studyWeeks.reduce(function (s, w) { return s + w.minutes; }, 0);
    var avg = total / m.studyWeeks.length / 60;
    var cap = el("div", "ref-key");
    cap.appendChild(el("span", null,
      "Average " + avg.toFixed(1) + " h/week over " + m.studyWeeks.length +
      " weeks · " + (m.studyMinutes / 60).toFixed(0) + " h logged in total"));
    host.appendChild(cap);

    renderTable($("study-table"), "Study time by week.", ["Week of", "Hours", "Minutes"],
      m.studyWeeks.slice().reverse().map(function (w) {
        return [fmtDate(w.week), (w.minutes / 60).toFixed(1), num(w.minutes)];
      }));
  }

  /* ---------------- chrome ---------------- */

  function renderBanner(m) {
    var slot = $("banner-slot");
    slot.innerHTML = "";
    var msg = null;
    if (usingSample) {
      msg = "<strong>Showing sample data.</strong> Nothing here is yours — press " +
            "“Sample data” again to go back to data/progress.js.";
    } else if (!m.hasAnyData) {
      msg = "<strong>No data yet.</strong> Run <code class=\"inline\">node importer/capture.mjs</code> " +
            "to pull from Kaplan, <code class=\"inline\">node importer/log.mjs</code> to log a session by " +
            "hand, or press “Sample data” to see the dashboard filled in.";
    }
    if (msg) {
      var b = el("div", "banner");
      b.innerHTML = msg;
      slot.appendChild(b);
    }

    /* units the importer could not place in a content area: they count toward your
     * totals but not toward the per-area charts, so say so rather than silently drop them */
    if (m.unmappedUnits && m.unmappedUnits.length) {
      var u = el("div", "banner");
      u.innerHTML = "<strong>" + m.unmappedUnits.length + " unit" +
        (m.unmappedUnits.length === 1 ? "" : "s") + " not mapped to a content area.</strong> " +
        "Counted in your totals but missing from the per-area charts: " +
        m.unmappedUnits.map(function (x) { return x.name; }).join(", ") +
        ". Add them to <code class=\"inline\">importer/mapping.json</code> under " +
        "<code class=\"inline\">areaOverrides</code>.";
      slot.appendChild(u);
    }
  }

  function renderFooter(m) {
    var f = $("foot-updated");
    if (usingSample) { f.textContent = "Sample data, not your progress."; return; }
    if (!m.meta.lastUpdated) { f.textContent = "No data loaded."; return; }
    var d = new Date(m.meta.lastUpdated);
    f.textContent = "Updated " + d.toLocaleString() +
      (m.meta.source ? " from " + m.meta.source + "." : ".");
  }

  function renderSubline(m) {
    var base = EXAM.name.replace(/^Series 66 — /, "") + " · " +
      EXAM.scoredQuestions + " scored questions · " + PASS + " to pass · " + EXAM.minutes + " minutes";
    if (m.daysToExam != null && m.daysToExam >= 0) {
      base = "Exam " + fmtDate(m.examDate) + " · " + m.daysToExam + " days out · " + base;
    } else {
      base = "No exam date set · " + base;
    }
    $("subline").textContent = base;
  }

  /* ---------------- render all ---------------- */

  var model = null;

  function renderAll() {
    var data = usingSample ? window.S66_SAMPLE : window.S66_DATA;
    model = buildModel(data);
    trendState = model;

    renderSubline(model);
    renderBanner(model);
    renderHero(model);
    renderChecks(model);
    renderKpis(model);
    drawTrend();
    renderAreas(model);
    renderPriority(model);
    renderStudy(model);
    renderFooter(model);
  }

  /* table toggles */
  document.querySelectorAll("button[data-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-toggle");
      var showTable = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(showTable));
      btn.textContent = showTable ? "Chart" : "Table";
      $(key + "-chart").hidden = showTable;
      $(key + "-table").hidden = !showTable;
    });
  });

  /* theme toggle — persisted, but never required */
  (function () {
    var KEY = "s66-theme";
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === "dark" || saved === "light") {
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch (e) { /* private mode / blocked storage — fine */ }

    $("theme-btn").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var isDark = cur ? cur === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
      drawTrend();
    });
  })();

  /* sample-data toggle */
  $("sample-btn").addEventListener("click", function () {
    usingSample = !usingSample;
    this.setAttribute("aria-pressed", String(usingSample));
    renderAll();
  });

  /* re-measure the line chart on resize */
  var rt = null;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(drawTrend, 120);
  });

  renderAll();
})();
