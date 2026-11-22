// Exercise Tracker: UI. Data stays in this device's local storage (export a backup from Settings).
(function () {
  'use strict';
  const P = window.ETP, D = window.ET_DATA;
  const KEY = 'exercise-tracker.v1';
  const view = document.getElementById('view');
  const sheet = document.getElementById('sheet');
  const restEl = document.getElementById('rest');

  // ---------- state ----------
  function defaults() {
    return {
      v: 1,
      sessions: [],
      days: {},      // 'YYYY-MM-DD' -> { combat?: [types], mode?: 'rest'|'train', gym?: bool }
      levels: {},    // 'abs.hollow' -> step index
      choices: {},   // lift slot -> chosen option id
      checkins: {},  // week start -> { bar, sleep, ill, tech }
      deloads: {},   // week start -> true
      draft: null,   // workout in progress
      settings: {
        schedule: [[], ['mt'], [], ['mt'], [], ['mt'], []],
        gym: true,
        restMin: 2,
        liftMax: 3,
        e1rm: { squat: 79, bench: 75, ohp: 36, deadlift: 111 },
        e1rmDate: '2026-07-14',
        homePull: false,
        setupDone: false
      }
    };
  }
  function merge(raw) {
    const base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    const out = Object.assign(base, raw);
    out.settings = Object.assign(defaults().settings, raw.settings || {});
    out.settings.e1rm = Object.assign(defaults().settings.e1rm, (raw.settings || {}).e1rm || {});
    if (!Array.isArray(out.sessions)) out.sessions = [];
    for (const k of ['days', 'levels', 'choices', 'checkins', 'deloads']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
    const sc = out.settings.schedule;
    if (!Array.isArray(sc) || sc.length !== 7 || !sc.every(Array.isArray)) out.settings.schedule = defaults().settings.schedule;
    return out;
  }
  function load() {
    try { return merge(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return defaults(); }
  }
  let state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { toast('Couldn’t save on this device. Export a backup from Settings.'); return false; }
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtLong(d) { const x = P.parse(d); return P.DAY_NAMES[P.weekday(d)] + ' ' + x.getDate() + ' ' + MONTHS[x.getMonth()]; }
  function fmtShort(d) { const x = P.parse(d); return x.getDate() + ' ' + MONTHS[x.getMonth()].slice(0, 3); }
  function fmtRange(a, b) {
    const x = P.parse(a), y = P.parse(b);
    return x.getMonth() === y.getMonth() ? `${x.getDate()}–${y.getDate()} ${MONTHS[y.getMonth()].slice(0, 3)}` : `${fmtShort(a)} – ${fmtShort(b)}`;
  }
  const fk = P.fmtKg;
  const lb = w => Math.round(w * P.LB);
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>', chevL: '<path d="M15 6l-6 6 6 6"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>', play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>', next: '<path d="M6 5l9 7-9 7zM18 5v14"/>', prev: '<path d="M18 5l-9 7 9 7zM6 5v14"/>'
  };
  const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const chip = (t, label, extra) => `<span class="chip t-${t}${extra ? ' ' + extra : ''}">${esc(label)}</span>`;
  const repTxt = r => Array.isArray(r) ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : `${r}`;
  function notice(title, text, extra) {
    return `<div class="card notice"><div class="ttl">${icon('warn')}${esc(title)}</div><p class="small" style="margin:0">${esc(text)}</p>${extra || ''}</div>`;
  }

  function setDay(date, patch) {
    const o = Object.assign({}, state.days[date] || {}, patch);
    for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null) delete o[k];
    if (Object.keys(o).length) state.days[date] = o; else delete state.days[date];
    save();
  }

  function weekPlan(date) { return P.planWeeks(state, D, date, 1)[0]; }
  function sessionTitle(s) {
    if (s.type === 'lift') return (D.lifting.sessions[s.data && s.data.routine] || {}).name || 'Weightlifting';
    if (s.type === 'home') return 'Home workout';
    if (s.type === 'abs') { const r = D.abs.days.find(x => s.data && x.id === s.data.routine); return r ? r.name : 'Abs'; }
    return P.TYPES[s.type].name;
  }
  function chipLabel(s) { return P.TYPES[s.type].short; }
  function sessionMeta(s) {
    const bits = [];
    if (s.dur) bits.push(s.dur + ' min');
    if (s.rpe) bits.push('RPE ' + s.rpe);
    const d = s.data || {};
    if (s.type === 'mt' && d.focus && d.focus.length) bits.push(d.focus.join(', '));
    if ((s.type === 'mt' || s.type === 'spar' || s.type === 'grap') && d.rounds) bits.push(d.rounds + (s.type === 'grap' ? ' rolls' : ' rounds') + (d.roundLen ? ' × ' + d.roundLen + ' min' : ''));
    if (s.type === 'spar' && d.intensity) bits.push(d.intensity);
    if (s.type === 'grap' && d.style) bits.push(d.style);
    if (s.type === 'lift' && Array.isArray(d.exercises)) {
      const main = d.exercises.filter(e => ['squat', 'bench', 'ohp', 'deadlift'].includes(e.id)).map(e => {
        const sets = (e.sets || []).filter(x => x.done);
        return sets.length ? `${e.name.replace('Overhead Press', 'OHP').replace('Bench Press', 'Bench')} ${P.fmtSets(sets)}` : null;
      }).filter(Boolean);
      if (main.length) bits.push(main.join(' · '));
    }
    if (s.type === 'abs' && d.rounds) bits.push(d.rounds + ' rounds');
    if (s.type === 'home' && d.results) {
      const n = Object.keys(d.results).filter(k => d.results[k] && d.results[k].reps != null).length;
      if (n) bits.push(n + ' of 5 gauntlets logged');
    }
    return bits.join(' · ');
  }
  function logRow(s) {
    return `<div class="log-item" data-act="session" data-id="${s.id}">${chip(s.type, chipLabel(s))}<div class="grow"><div style="font-weight:650">${esc(sessionTitle(s))}</div><div class="meta">${esc(sessionMeta(s) || fmtLong(s.date))}</div></div><span class="faint">${icon('chevR')}</span></div>`;
  }

  // ---------- lifting helpers ----------
  function slotDef(routine, slotId) {
    const s = D.lifting.sessions[routine];
    return s ? s.exercises.find(x => x.slot === slotId) || null : null;
  }
  function chosenOpt(slot) {
    const id = state.choices[slot.slot];
    return slot.options.find(o => o.id === id) || slot.options[0];
  }
  function setsFor(slot, deload) { return deload ? Math.max(1, Math.round(slot.sets * 2 / 3)) : slot.sets; }
  function buildEx(slot, opt, date, deload, excludeId) {
    const sg = P.suggest(state, slot, opt, { date, e1rm: state.settings.e1rm, excludeId });
    const reps = P.repRange(slot);
    const n = setsFor(slot, deload);
    let why = sg.why;
    if (deload && n < slot.sets) why += ` Deload: ${n} set${n > 1 ? 's' : ''} instead of ${slot.sets}.`;
    return {
      slot: slot.slot, id: opt.id, name: opt.name,
      target: { sets: n, reps, w: sg.w, deload: deload ? true : undefined },
      why, sets: Array.from({ length: n }, () => ({ w: opt.noWeight ? null : sg.w, r: sg.reps, done: false }))
    };
  }
  function valveCount(weekStart) {
    const c = state.checkins[weekStart] || {};
    return D.recovery.signs.filter(s => c[s.id]).length;
  }

  // ---------- abs helpers ----------
  function absRoutineFor(date) {
    const logged = P.sessionsOn(state, date).find(s => s.type === 'abs');
    if (logged && logged.data) { const r = D.abs.days.find(x => x.id === logged.data.routine); if (r) return r; }
    return D.abs.days[P.rotationNext(state, 'abs', D.abs.days.map(x => x.id), date)];
  }
  const lvl = (key, max) => Math.min(Math.max(0, state.levels[key] || 0), max - 1);
  function absStreak() {
    const days = new Set(state.sessions.filter(s => s.type === 'abs').map(s => s.date));
    let d = P.today(), n = 0;
    if (!days.has(d)) d = P.addDays(d, -1);
    while (days.has(d)) { n++; d = P.addDays(d, -1); }
    return n;
  }

  // =====================================================================
  // TODAY
  // =====================================================================
  function headline(day) {
    if (day.status === 'logged' && !day.extraTrain) return 'Done for today';
    if (day.status === 'combat') return P.namesOf(day.combat);
    if (day.train && (day.status === 'train' || day.extraTrain)) return day.train.type === 'lift' ? day.train.session.name : 'Home workout';
    if (day.status === 'rest') return 'Rest day';
    return 'Today';
  }

  function viewToday() {
    const now = P.today();
    const week = weekPlan(now);
    const day = week.days.find(d => d.isToday);
    let h = `<p class="eyebrow">${esc(fmtLong(now))}</p><h1>${esc(headline(day))}</h1>`;
    if (!state.settings.setupDone) {
      h += `<div class="card info"><h3>Set your usual week</h3><p class="small muted" style="margin:6px 0 12px">Pick the days you normally do Muay Thai, sparring and grappling. Lifting, home workouts and rest days are planned around them. You can change single days later.</p><button class="btn primary block" data-act="setup">Set my usual week</button></div>`;
    }
    if (state.draft) {
      const dr = state.draft;
      const name = dr.kind === 'lift' ? (D.lifting.sessions[dr.routine] || {}).name : 'Home workout';
      h += `<div class="card info"><div class="row between"><div><h3>${esc(name)} in progress</h3><p class="small muted" style="margin:2px 0 0">${esc(fmtLong(dr.date))}</p></div><a class="btn primary small" href="#/${dr.kind === 'lift' ? 'workout' : 'home'}">Continue</a></div></div>`;
    }
    week.warnings.forEach(w => { h += notice('Rest days', w); });
    if (valveCount(week.start) >= 2) h += notice('Escape valve this week', D.recovery.valve, `<a class="btn small" style="margin-top:10px" href="#/plan">Open the plan</a>`);
    h += dayCards(day, week);
    h += absCard(day);
    h += `<h2>This week</h2>` + strip(week) + restLine(week);
    return h;
  }

  function dayCards(day, week) {
    let h = '';
    if (day.logged.length) {
      h += `<div class="card"><div class="row between" style="margin-bottom:10px"><h3>Logged today</h3><span class="check">${icon('check')}Done</span></div>${day.logged.map(logRow).join('')}<button class="btn small" style="margin-top:6px" data-act="add" data-date="${day.date}">${icon('plus')}Add another session</button></div>`;
    }
    if (day.status === 'combat') {
      h += `<div class="card"><div class="chips">${day.combat.map(t => chip(t, P.TYPES[t].name)).join('')}</div><p class="small muted" style="margin:10px 0 12px">${esc(day.reason)}</p><div class="btn-row">${day.combat.map(t => `<button class="btn primary" data-act="log" data-type="${t}" data-date="${day.date}">Log ${esc(P.TYPES[t].short === 'MT' ? 'Muay Thai' : P.TYPES[t].name)}</button>`).join('')}</div><div class="row" style="gap:18px;margin-top:6px"><button class="link" data-act="skip-combat" data-date="${day.date}">Not training today</button><button class="link" data-act="day" data-date="${day.date}">Change today</button></div></div>`;
    }
    if (day.train && (day.status === 'train' || day.extraTrain)) h += trainCard(day, week);
    if (day.status === 'rest') {
      h += `<div class="card hero-rest"><h3>Rest day</h3><p class="small muted">${esc(day.reason)}</p><p class="small muted">${esc(D.recovery.restDay)}</p><div class="btn-row" style="justify-content:center;margin-top:12px"><button class="btn small" data-act="train-anyway" data-date="${day.date}">Train anyway</button><button class="btn small" data-act="add" data-date="${day.date}">Log a session</button></div></div>`;
    }
    if (!day.logged.length && day.status !== 'rest') {
      h += `<div class="row" style="justify-content:center;margin:-4px 0 8px"><button class="link" data-act="add" data-date="${day.date}">Log something else</button></div>`;
    }
    return h;
  }

  function gymSeg(day) {
    return `<div class="row between" style="margin-top:14px"><span class="small muted">Gym access today</span><div class="seg" style="width:150px"><button class="${day.gym ? 'on' : ''}" data-act="gym" data-date="${day.date}" data-val="1">Yes</button><button class="${day.gym ? '' : 'on'}" data-act="gym" data-date="${day.date}" data-val="0">No</button></div></div>`;
  }

  function trainCard(day, week) {
    const t = day.train;
    if (t.type === 'lift') {
      const sess = t.session;
      const items = sess.exercises.map(slot => {
        const opt = chosenOpt(slot);
        const sg = P.suggest(state, slot, opt, { date: day.date, e1rm: state.settings.e1rm });
        const w = sg.w != null ? ` · ${fk(sg.w)} kg${opt.bw ? ' added' : ''}` : '';
        return `<li><span>${esc(opt.name)}${slot.optional ? ' <span class="badge">optional</span>' : ''}</span><span>${setsFor(slot, week.deload)} × ${repTxt(slot.reps)}${w}</span></li>`;
      }).join('');
      return `<div class="card t-lift bar-left"><div class="row between top"><div><h3>${esc(sess.name)}</h3><p class="small muted" style="margin:2px 0 0">${esc(sess.focus)}</p></div>${chip('lift', 'Lift')}</div>
        <p class="small muted" style="margin:10px 0 4px">${esc(day.reason)}</p><ul class="preview-list">${items}</ul>
        <button class="btn primary block" style="margin-top:12px" data-act="start-lift" data-routine="${t.routine}" data-date="${day.date}">Start ${esc(sess.name)}</button>
        ${gymSeg(day)}<p class="source">${esc(D.recovery.liftDay)}</p>
        <button class="link" data-act="rest-instead" data-date="${day.date}">Rest instead</button></div>`;
    }
    const H = D.home;
    const items = H.gauntlets.map((g, i) => {
      const lad = state.settings.homePull && g.alt ? g.alt : g;
      return `<li><span>${i + 1}. ${esc(lad.name || g.name)}</span><span>${esc(lad.ladder[0])} →</span></li>`;
    }).join('');
    return `<div class="card t-home bar-left"><div class="row between top"><div><h3>${esc(H.name)}</h3><p class="small muted" style="margin:2px 0 0">No equipment, about 15 minutes</p></div>${chip('home', 'Home')}</div>
      <p class="small muted" style="margin:10px 0 4px">${esc(day.reason)}</p><ul class="preview-list">${items}</ul>
      <button class="btn primary block" style="margin-top:12px" data-act="start-home" data-date="${day.date}">Start home workout</button>
      ${gymSeg(day)}
      <button class="link" data-act="rest-instead" data-date="${day.date}">Rest instead</button></div>`;
  }

  function absCard(day) {
    const r = absRoutineFor(day.date);
    const done = day.abs;
    const training = day.isTrain || day.isCombat;
    const rounds = done && done.data && done.data.rounds ? done.data.rounds : (training ? D.abs.rounds.training : D.abs.rounds.rest);
    const sub = done ? `Done · ${rounds} rounds` : `${rounds} rounds · ${training ? 'training day, so the shorter version' : 'rest day, so the full version'}`;
    let h = `<div class="card t-abs bar-left"><div class="row between top"><div><h3>${esc(r.name)} · ${esc(r.focus)}</h3><p class="small muted" style="margin:2px 0 0">${esc(sub)}</p></div>${done ? `<span class="check">${icon('check')}Done</span>` : chip('abs', 'Daily')}</div><div style="margin-top:8px">`;
    r.exercises.forEach(ex => {
      const key = 'abs.' + ex.id;
      if (done) {
        const it = (done.data.items || []).find(x => x.id === ex.id);
        h += `<div class="ab-ex"><div class="grow"><div style="font-weight:650">${esc(ex.name)}</div><div class="step">${esc(it ? it.label : '')}</div></div></div>`;
      } else {
        const L = lvl(key, ex.steps.length);
        h += `<div class="ab-ex"><div class="grow"><div style="font-weight:650">${esc(ex.name)}</div><div class="step">Step ${L + 1} of ${ex.steps.length}: ${esc(ex.steps[L])}${ex.note ? ' · ' + esc(ex.note) : ''}</div></div><div class="lvl"><button class="icon-btn" data-act="lvl" data-key="${key}" data-max="${ex.steps.length}" data-d="-1" aria-label="Easier step for ${esc(ex.name)}" ${L === 0 ? 'disabled' : ''}>${icon('down')}</button><button class="icon-btn" data-act="lvl" data-key="${key}" data-max="${ex.steps.length}" data-d="1" aria-label="Harder step for ${esc(ex.name)}" ${L === ex.steps.length - 1 ? 'disabled' : ''}>${icon('up')}</button></div></div>`;
      }
    });
    h += '</div>';
    if (done) h += `<button class="link" data-act="abs-undo" data-id="${done.id}">Undo</button>`;
    else h += `<button class="btn primary block" style="margin-top:10px" data-act="abs-log" data-date="${day.date}" data-routine="${r.id}" data-rounds="${rounds}">Log abs</button>`;
    const st = absStreak();
    h += `<details style="margin-top:8px"><summary>How to do it${st ? ` · streak ${st} day${st === 1 ? '' : 's'}` : ''}</summary><p class="small muted">${esc(D.abs.how)}</p><p class="small muted">${esc(D.abs.progress)}</p><p class="source">${esc(D.abs.source)}</p></details></div>`;
    return h;
  }

  function dayTypes(d) {
    const types = d.status === 'logged' ? [...new Set(d.logged.map(s => s.type))] : d.combat.slice();
    if (d.train && (d.status === 'train' || d.extraTrain)) types.push(d.train.type);
    return types;
  }
  function dayLabel(d) {
    if (d.status === 'rest' || d.status === 'rested') return 'Rest';
    const labels = [];
    if (d.status === 'logged') d.logged.forEach(s => { const l = s.type === 'lift' && s.data && s.data.routine ? 'Lift ' + s.data.routine : P.TYPES[s.type].short; if (!labels.includes(l)) labels.push(l); });
    else d.combat.forEach(t => labels.push(P.TYPES[t].short));
    if (d.train && (d.status === 'train' || d.extraTrain)) labels.push(d.train.type === 'lift' ? 'Lift ' + d.train.routine : 'Home');
    if (labels.length > 1) return labels[0].split(' ')[0] + '+' + (labels.length - 1);
    return labels[0] || '';
  }
  function strip(week) {
    return `<a class="strip" href="#/plan" aria-label="Open the week plan">${week.days.map(d => {
      const types = dayTypes(d);
      const isRest = d.status === 'rest' || d.status === 'rested';
      const planned = !(d.status === 'logged' || d.status === 'rested');
      const cls = [d.isToday ? 'today' : '', planned ? 'planned' : '', isRest ? 'rest' : ''].join(' ');
      const bars = types.length ? `<div class="bars">${types.map(t => `<span class="t-${t}"></span>`).join('')}</div>` : '';
      const dot = d.abs ? '<div class="abs-dot" title="Abs done"></div>' : (d.date <= P.today() ? '<div class="abs-dot no" title="No abs logged"></div>' : '<div class="abs-dot" style="visibility:hidden"></div>');
      return `<div class="${cls}"><div class="d">${P.DAY_SHORT[d.wd]}</div><div class="pip">${bars}<span class="lbl">${esc(dayLabel(d))}</span></div>${dot}</div>`;
    }).join('')}</a>`;
  }
  function restLine(week) {
    const s = week.summary;
    return `<p class="small muted" style="margin-top:10px">Rest days: ${s.restTaken} taken, ${s.restPlanned} planned (at least ${s.restMin}). Abs: ${s.absDone} of ${s.absSoFar} days so far. Dashed days are planned.</p>`;
  }

  // =====================================================================
  // PLAN
  // =====================================================================
  let planOffset = 0;
  function viewPlan() {
    const now = P.today();
    const base = P.addDays(P.weekStart(now), planOffset * 7);
    const week = weekPlan(base);
    const label = planOffset === 0 ? 'This week' : planOffset === 1 ? 'Next week' : planOffset === -1 ? 'Last week' : 'Week of ' + fmtShort(week.start);
    const s = week.summary;
    let h = `<div class="row between" style="margin-bottom:10px"><button class="icon-btn" data-act="week" data-dir="-1" aria-label="Previous week">${icon('chevL')}</button><div style="text-align:center"><p class="eyebrow">${esc(fmtRange(week.start, week.end))}</p><h1 style="margin:0">${esc(label)}</h1></div><button class="icon-btn" data-act="week" data-dir="1" aria-label="Next week">${icon('chevR')}</button></div>`;
    h += `<div class="stats"><div class="stat"><b>${7 - s.restTotal}</b><span>Training days</span></div><div class="stat"><b>${s.restTotal}<span class="faint" style="font-size:15px"> / ${s.restMin}+</span></b><span>Rest days</span></div><div class="stat"><b>${s.train}<span class="faint" style="font-size:15px"> / ${s.liftMax}</span></b><span>Lift or home</span></div></div>`;
    week.warnings.forEach(w => { h += notice('Rest days', w); });
    h += `<div class="card">${week.days.map(d => `<div class="plan-day ${d.isToday ? 'is-today' : ''}" data-act="day" data-date="${d.date}"><div class="d">${P.DAY_SHORT[d.wd]}<small>${P.parse(d.date).getDate()} ${MONTHS[P.parse(d.date).getMonth()].slice(0, 3)}</small></div><div class="grow"><div class="chips">${dayChips(d)}</div><div class="why">${esc(d.reason)}</div></div><span class="chev">${icon('chevR')}</span></div>`).join('')}</div>`;
    h += `<p class="small muted">Tap a day to change it. The planner fills days without Muay Thai or grappling with lifting (or the home workout when there's no gym), keeps at least ${s.restMin} rest days, never lifts two days running and caps lifting at ${s.liftMax} a week. The ab workout doesn't stop a day counting as rest.</p>`;
    if (week.end >= now) h += deloadCard(week);
    if (week.start <= now) h += checkinCard(week);
    return h;
  }

  function dayChips(d) {
    let h = '';
    if (d.status === 'logged') h += d.logged.map(s => chip(s.type, (s.type === 'lift' && s.data && s.data.routine ? 'Lift ' + s.data.routine : P.TYPES[s.type].name) + ' ✓', 'done')).join('');
    if (d.status === 'combat') h += d.combat.map(t => chip(t, P.TYPES[t].name)).join('');
    if (d.train && (d.status === 'train' || d.extraTrain)) h += chip(d.train.type, d.train.type === 'lift' ? d.train.session.name : 'Home workout');
    if (d.status === 'rest' || d.status === 'rested') h += chip('rest', 'Rest');
    if (d.abs) h += chip('abs', 'Abs ✓', 'done');
    if (!d.gym && !d.past) h += '<span class="badge">No gym</span>';
    return h;
  }

  function weeksSinceDeload(weekStart) {
    const past = Object.keys(state.deloads).filter(k => state.deloads[k] && k < weekStart).sort();
    if (past.length) return { weeks: Math.round(P.daysBetween(past[past.length - 1], weekStart) / 7) - 1, from: 'deload' };
    const lifts = state.sessions.filter(s => s.type === 'lift').map(s => s.date).sort();
    if (!lifts.length) return null;
    return { weeks: Math.round(P.daysBetween(P.weekStart(lifts[0]), weekStart) / 7), from: 'start' };
  }
  function deloadCard(week) {
    const on = !!state.deloads[week.start];
    const since = weeksSinceDeload(week.start);
    let msg = 'Counting starts from your first logged lifting session.';
    if (since) {
      msg = `${since.weeks} full week${since.weeks === 1 ? '' : 's'} since ${since.from === 'deload' ? 'your last deload' : 'your first logged lift'}.`;
      if (!on && since.weeks >= 6) msg += ' A deload is overdue.';
      else if (!on && since.weeks >= 4) msg += ' A deload is due in the next couple of weeks.';
    }
    return `<div class="card"><label class="switch"><div><h3>Deload week</h3><p class="small muted" style="margin:4px 0 0">${esc(msg)}</p></div><input type="checkbox" data-act="deload" data-week="${week.start}" ${on ? 'checked' : ''} aria-label="Deload this week"></label><p class="source">${esc(D.recovery.deload)} (section 8)</p></div>`;
  }
  function checkinCard(week) {
    const c = state.checkins[week.start] || {};
    const n = valveCount(week.start);
    let h = `<div class="card"><h3>Recovery check-in</h3><p class="small muted" style="margin:4px 0 6px">Tick any that apply this week (section 6).</p>`;
    h += D.recovery.signs.map(s => `<label class="switch"><span class="small">${esc(s.label)}</span><input type="checkbox" data-act="sign" data-week="${week.start}" data-sign="${s.id}" ${c[s.id] ? 'checked' : ''}></label>`).join('');
    if (n >= 2) {
      const next = week.days.find(d => !d.past && d.status === 'combat' && d.combat.includes('mt') && !d.hardest);
      h += `<div class="card notice" style="margin:10px 0 0"><div class="ttl">${icon('warn')}Escape valve: ${n} signs this week</div><p class="small" style="margin:0 0 10px">${esc(D.recovery.valve)}</p><div class="btn-row">${next ? `<button class="btn small" data-act="rest-instead" data-date="${next.date}">Make ${P.DAY_NAMES[next.wd]}'s Muay Thai a rest day</button>` : ''}${!state.deloads[week.start] && week.end >= P.today() ? `<button class="btn small" data-act="deload-on" data-week="${week.start}">Deload this week</button>` : ''}</div></div>`;
    } else {
      h += `<p class="small muted" style="margin:6px 0 0">${n} of 4 this week. Two or more opens the escape valve.</p>`;
    }
    return h + '</div>';
  }

  // =====================================================================
  // LOG
  // =====================================================================
  let logFilter = 'all';
  function viewLog() {
    let h = `<div class="row between"><h1>Log</h1><button class="btn small" data-act="add">${icon('plus')}Add</button></div>`;
    const f = [['all', 'All']].concat(Object.keys(P.TYPES).map(t => [t, P.TYPES[t].short]));
    h += `<div class="seg" style="margin-bottom:14px">${f.map(([k, l]) => `<button class="${logFilter === k ? 'on' : ''}" data-act="filter" data-val="${k}">${esc(l)}</button>`).join('')}</div>`;
    const list = state.sessions.filter(s => logFilter === 'all' || s.type === logFilter).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));
    if (!list.length) return h + `<div class="empty">Nothing logged yet. Sessions you log on the Today screen show up here.</div>`;
    let cur = '';
    list.slice(0, 300).forEach(s => {
      if (s.date !== cur) { if (cur) h += '</div>'; cur = s.date; h += `<div class="log-day"><p class="d">${esc(fmtLong(s.date))}</p>`; }
      h += logRow(s);
    });
    return h + '</div>';
  }

  // =====================================================================
  // PROGRESS
  // =====================================================================
  function viewProgress() {
    let h = `<h1>Progress</h1><p class="small muted">Working weight is your heaviest logged set. Estimated 1RM uses the Epley formula on sets of 10 reps or fewer, so it's an estimate, not a tested max.</p>`;
    for (const id of ['squat', 'bench', 'ohp', 'deadlift']) h += liftCard(id);
    h += `<h2>Weekly summary</h2>${weeklyTable()}`;
    h += `<h2>Home workout</h2>${homeTable()}`;
    h += `<h2>Abs</h2>${absSummary()}`;
    return h;
  }

  function meter(label, value, target, unit, done) {
    const pct = Math.max(0, Math.min(100, value / target * 100));
    return `<div class="meter ${done ? 'done' : ''}"><div class="lab"><span>${label}</span><span><b>${esc(value ? fk(Math.round(value * 10) / 10) : '–')}</b> / ${esc(fk(target))} ${unit}${done ? ' ✓' : ''}</span></div><div class="track" role="img" aria-label="${esc(label)}: ${Math.round(pct)}%"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div></div>`;
  }

  function liftCard(id) {
    const L = D.lifting.lifts[id];
    const pts = P.liftSeries(state, id);
    const est = +state.settings.e1rm[id] || 0;
    const last = pts[pts.length - 1];
    const best5 = Math.max(0, ...pts.map(p => p.five || 0));
    const bestE1 = Math.max(0, ...pts.map(p => p.e1rm || 0));
    let h = `<div class="card"><div class="row between top"><h3>${esc(L.name)}</h3><span class="small muted">${last ? 'Last: ' + esc(fmtShort(last.date)) : 'Not logged yet'}</span></div>`;
    if (last) {
      h += `<p class="small" style="margin:6px 0 0"><b>${fk(last.work)} kg</b> (${lb(last.work)} lb) last working weight · best est. 1RM <b>${fk(Math.round(bestE1 * 10) / 10)} kg</b> (${lb(bestE1)} lb)</p>`;
    } else {
      h += `<p class="small muted" style="margin:6px 0 0">July estimate: ${fk(est)} kg 1RM (${lb(est)} lb). Your first session's weight comes from this.</p>`;
    }
    h += meter('5-rep milestone', best5, L.milestone, 'kg × 5', best5 >= L.milestone);
    h += meter(`Club 1RM (${L.clubLb} lb)`, bestE1 || est, L.club, 'kg', bestE1 >= L.club);
    if (!last) h += `<p class="source">The club bar shows the July estimate until you log this lift.</p>`;
    if (pts.length >= 2) {
      h += lineChart(pts.map(p => ({ d: p.date, y: p.work, tip: `${fmtShort(p.date)}: ${P.fmtSets(p.sets)}` })), `${L.name} working weight`);
      h += `<details><summary>Show as a table</summary><div class="scroll-x"><table class="data"><thead><tr><th>Date</th><th>Sets</th><th class="r">Est. 1RM</th></tr></thead><tbody>${pts.slice().reverse().map(p => `<tr><td>${esc(fmtShort(p.date))}</td><td>${esc(P.fmtSets(p.sets))}</td><td class="r">${p.e1rm ? fk(Math.round(p.e1rm * 10) / 10) : '–'}</td></tr>`).join('')}</tbody></table></div></details>`;
    }
    return h + '</div>';
  }

  function niceStep(span) {
    const raw = span / 3, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  // Single-series line chart: y in kg over date. Tap or hover shows the session.
  function lineChart(pts, title) {
    const W = 320, H = 132, pl = 34, pr = 40, pt = 12, pb = 22;
    const ys = pts.map(p => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo < 5) { lo -= 2.5; hi += 2.5; }
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const d0 = pts[0].d, span = Math.max(1, P.daysBetween(d0, pts[pts.length - 1].d));
    const X = d => pl + (P.daysBetween(d0, d) / span) * (W - pl - pr);
    const Y = y => pt + (1 - (y - lo) / (hi - lo)) * (H - pt - pb);
    const xy = pts.map(p => [X(p.d), Y(p.y)]);
    let g = '';
    for (let v = lo; v <= hi + 1e-9; v += step) g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axis" x="${pl - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${fk(v)}</text>`;
    const path = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = path + ` L${xy[xy.length - 1][0].toFixed(1)} ${(H - pb).toFixed(1)} L${xy[0][0].toFixed(1)} ${(H - pb).toFixed(1)} Z`;
    const e = xy[xy.length - 1];
    const data = esc(JSON.stringify(pts.map((p, i) => ({ x: +(xy[i][0] / W * 100).toFixed(2), y: +xy[i][1].toFixed(1), t: p.tip }))));
    return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}, ${pts.length} sessions, latest ${fk(pts[pts.length - 1].y)} kg" data-pts="${data}">
      ${g}<path class="area" d="${area}"/><path class="line" d="${path}"/>
      <line class="cross" x1="0" x2="0" y1="${pt}" y2="${H - pb}" visibility="hidden"/>
      <circle class="dot" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="4"/>
      <circle class="dot hover-dot" cx="0" cy="0" r="4" visibility="hidden"/>
      <text class="end-label" x="${(e[0] + 7).toFixed(1)}" y="${(e[1] + 4).toFixed(1)}">${fk(pts[pts.length - 1].y)}</text>
      <text class="axis" x="${pl}" y="${H - 6}">${esc(fmtShort(pts[0].d))}</text><text class="axis" x="${W - pr}" y="${H - 6}" text-anchor="end">${esc(fmtShort(pts[pts.length - 1].d))}</text>
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent" class="hit"/></svg><div class="tip" hidden></div></div>`;
  }
  function chartPointer(e) {
    const svg = e.target.closest && e.target.closest('svg.chart');
    document.querySelectorAll('.chart-wrap .tip').forEach(t => { if (!svg || t.parentNode !== svg.parentNode) t.hidden = true; });
    if (!svg) return;
    const pts = JSON.parse(svg.dataset.pts);
    const r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * 100;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - px) < Math.abs(best.x - px)) best = p;
    const W = svg.viewBox.baseVal.width;
    const cx = best.x / 100 * W;
    const cross = svg.querySelector('.cross'), dot = svg.querySelector('.hover-dot');
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', best.y); dot.setAttribute('visibility', 'visible');
    const tip = svg.parentNode.querySelector('.tip');
    tip.textContent = best.t; tip.hidden = false;
    const left = Math.min(Math.max(best.x / 100 * r.width, tip.offsetWidth / 2), r.width - tip.offsetWidth / 2);
    tip.style.left = left + 'px'; tip.style.top = '-14px';
  }
  function chartLeave(e) {
    const svg = e.target.closest && e.target.closest('svg.chart');
    if (!svg || e.pointerType === 'touch') return;
    svg.querySelector('.cross').setAttribute('visibility', 'hidden');
    svg.querySelector('.hover-dot').setAttribute('visibility', 'hidden');
    svg.parentNode.querySelector('.tip').hidden = true;
  }

  function weeklyTable() {
    const now = P.today();
    const rows = [];
    const firstLog = state.sessions.map(s => s.date).sort()[0];
    for (let k = 0; k < 8; k++) {
      const ws = P.addDays(P.weekStart(now), -7 * k);
      if (!firstLog || P.addDays(ws, 6) < firstLog) break;
      const c = { mt: 0, spar: 0, grap: 0, lift: 0, home: 0, abs: 0, rest: 0, load: 0 };
      for (let i = 0; i < 7; i++) {
        const d = P.addDays(ws, i);
        if (d > now) break;
        const ss = P.sessionsOn(state, d);
        ss.forEach(s => { c[s.type]++; if (s.rpe && s.dur && s.type !== 'abs') c.load += s.rpe * s.dur; });
        if (!ss.some(s => P.MAIN.includes(s.type)) && d < now) c.rest++;
      }
      rows.push([ws, c]);
    }
    if (!state.sessions.length) return `<div class="card empty">Your weekly totals appear here once you start logging.</div>`;
    const cols = ['mt', 'spar', 'grap', 'lift', 'home', 'rest', 'abs'];
    return `<div class="card"><div class="scroll-x"><table class="data"><thead><tr><th>Week</th>${cols.map(t => `<th class="r">${t === 'rest' ? 'Rest' : P.TYPES[t].short}</th>`).join('')}<th class="r">Load</th></tr></thead><tbody>${rows.map(([ws, c]) => `<tr><td>${esc(fmtShort(ws))}</td>${cols.map(t => `<td class="r">${c[t] || '·'}</td>`).join('')}<td class="r">${c.load || '·'}</td></tr>`).join('')}</tbody></table></div><p class="source">Load = session effort (RPE 1–10) × minutes, summed over the week (the session-RPE method). Abs aren't included. Rest counts past days with no main session.</p></div>`;
  }

  function homeTable() {
    const list = state.sessions.filter(s => s.type === 'home').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    if (!list.length) return `<div class="card empty">No home workouts logged yet.</div>`;
    const G = D.home.gauntlets;
    return `<div class="card"><div class="scroll-x"><table class="data"><thead><tr><th>Date</th>${G.map(g => `<th class="r">${esc(g.name.split(' ')[0])}</th>`).join('')}</tr></thead><tbody>${list.map(s => `<tr><td>${esc(fmtShort(s.date))}</td>${G.map(g => { const r = (s.data && s.data.results || {})[g.id]; return `<td class="r">${r && r.reps != null ? r.reps : '·'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="source">Reps on the first (hardest) variation of each gauntlet. More reps, or reaching a harder start, means progress.</p></div>`;
  }

  function absSummary() {
    const now = P.today();
    const last30 = new Set(state.sessions.filter(s => s.type === 'abs' && P.daysBetween(s.date, now) < 30 && s.date <= now).map(s => s.date)).size;
    let h = `<div class="stats"><div class="stat"><b>${absStreak()}</b><span>Day streak</span></div><div class="stat"><b>${last30}</b><span>Days in last 30</span></div><div class="stat"><b>${state.sessions.filter(s => s.type === 'abs').length}</b><span>Total sessions</span></div></div><div class="card">`;
    D.abs.days.forEach((r, i) => {
      h += `${i ? '<hr class="sep">' : ''}<p class="small" style="margin:0 0 4px;font-weight:700">${esc(r.name)} · ${esc(r.focus)}</p>`;
      r.exercises.forEach(ex => { const L = lvl('abs.' + ex.id, ex.steps.length); h += `<div class="row between small" style="padding:3px 0"><span>${esc(ex.name)}</span><span class="muted" style="text-align:right">${esc(ex.steps[L])} (${L + 1}/${ex.steps.length})</span></div>`; });
    });
    return h + '</div>';
  }

  // =====================================================================
  // SETTINGS
  // =====================================================================
  function scheduleGrid() {
    return P.DAY_NAMES.map((n, i) => `<div class="plan-day sched"><div class="d">${P.DAY_SHORT[i]}</div><div class="toggles tight grow">${P.COMBAT.map(t => `<button class="toggle t-${t} ${state.settings.schedule[i].includes(t) ? 'on' : ''}" data-act="sched" data-day="${i}" data-type="${t}" aria-pressed="${state.settings.schedule[i].includes(t)}">${esc(P.TYPES[t].short === 'MT' ? 'Muay Thai' : P.TYPES[t].short === 'Spar' ? 'Sparring' : 'Grappling')}</button>`).join('')}</div></div>`).join('');
  }
  function stepper(key, min, max) {
    const v = state.settings[key];
    return `<span class="stepper"><button class="icon-btn" data-act="step" data-key="${key}" data-d="-1" ${v <= min ? 'disabled' : ''} aria-label="Fewer">−</button><b>${v}</b><button class="icon-btn" data-act="step" data-key="${key}" data-d="1" ${v >= max ? 'disabled' : ''} aria-label="More">+</button></span>`;
  }
  function viewSettings() {
    const S = state.settings;
    let h = `<h1>Settings</h1><h2>Usual week</h2><div class="card sched-card"><p class="small muted" style="margin:0 0 6px">The days you normally do Muay Thai, sparring and grappling. Change a single day from the Plan tab.</p>${scheduleGrid()}</div>`;
    h += `<h2>Planning rules</h2><div class="card">
      <div class="switch"><span>At least this many rest days a week</span>${stepper('restMin', 2, 4)}</div>
      <div class="switch"><span>Lifting or home sessions a week, at most</span>${stepper('liftMax', 1, 4)}</div>
      <label class="switch"><span>Gym access by default</span><input type="checkbox" data-act="set-bool" data-key="gym" ${S.gym ? 'checked' : ''}></label>
      <label class="switch"><span>Home workout: swap gauntlet 3 for the pull ladder (needs a bar or sturdy table)</span><input type="checkbox" data-act="set-bool" data-key="homePull" ${S.homePull ? 'checked' : ''}></label>
      <p class="source">The programme runs 3 lifting sessions a week (section 3.1). Lifting is never planned on a Muay Thai or grappling day, or two days running.</p></div>`;
    h += `<h2>Starting lift numbers</h2><div class="card"><p class="small muted" style="margin:0 0 10px">Estimated 1RMs as of 14 July 2026. They only set the first session's weights; after that the app goes by what you log.</p><div class="field-row">${['squat', 'bench', 'ohp', 'deadlift'].map(id => `<label class="field"><span>${esc(D.lifting.lifts[id].name)} (kg)</span><input type="number" inputmode="decimal" step="any" data-act="e1rm" data-key="${id}" value="${esc(S.e1rm[id])}"></label>`).join('')}</div></div>`;
    h += `<h2>Backup</h2><div class="card"><p class="small muted" style="margin:0 0 10px">Your log is stored only on this phone. Export a backup now and then, especially before changing phones.</p><div class="btn-row"><button class="btn" data-act="export">Export backup</button><button class="btn" data-act="import">Import backup</button><button class="btn" data-act="csv">Export CSV</button></div><input type="file" id="import-file" accept="application/json,.json" hidden></div>`;
    h += `<h2>Sources</h2><div class="card small"><p><b>Lift A/B/C, progression, escape valve, deloads:</b> ${esc(D.lifting.source)}, sections 5, 6 and 8. Face pulls in B and C were added to match section 3.3.</p><p><b>Home workout:</b> ${esc(D.home.source)}.</p><p style="margin:0"><b>Ab workout and accessory progression (double progression on rep ranges):</b> general knowledge, not from the source review.</p></div>`;
    h += `<h2>Reset</h2><div class="card"><button class="btn danger block" data-act="reset">Delete all data on this phone</button></div><p class="small faint" style="text-align:center">Exercise Tracker v1</p>`;
    return h;
  }

  // =====================================================================
  // LIFT WORKOUT
  // =====================================================================
  function startLift(routine, date) {
    if (state.draft) { toast('Finish or discard the workout in progress first.'); location.hash = '#/' + (state.draft.kind === 'lift' ? 'workout' : 'home'); return; }
    const sess = D.lifting.sessions[routine];
    const deload = !!state.deloads[P.weekStart(date)];
    state.draft = { kind: 'lift', id: uid(), date, routine, startedAt: Date.now(), deload, rpe: null, notes: '', exercises: sess.exercises.map(slot => buildEx(slot, chosenOpt(slot), date, deload)) };
    save();
    location.hash = '#/workout';
  }

  function viewWorkout() {
    const dr = state.draft;
    if (!dr || dr.kind !== 'lift') { setTimeout(() => { location.hash = '#/today'; }); return ''; }
    const sess = D.lifting.sessions[dr.routine];
    const doneCount = dr.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
    let h = `<div class="wk-head"><button class="icon-btn" data-act="leave" aria-label="Leave workout">${icon('close')}</button><div class="t"><strong>${esc(sess.name)} · ${esc(sess.focus)}</strong><span>${esc(fmtLong(dr.date))}${dr.startedAt ? ' · <span id="elapsed" class="num"></span>' : ''}</span></div><button class="btn primary small" data-act="finish">Finish</button></div>`;
    if (dr.deload) h += notice('Deload week', 'About a third less volume: fewer sets at the same weights.');
    if (valveCount(P.weekStart(dr.date)) >= 2) {
      const drop = sess.exercises.find(s => s.valveDrop);
      h += notice('Escape valve this week', `You can drop one accessory today${drop ? ` (for example ${chosenOpt(drop).name})` : ''}. Keep the pulling work.`);
    }
    dr.exercises.forEach((e, i) => {
      const slot = e.slot ? slotDef(dr.routine, e.slot) : null;
      const opt = slot ? (slot.options.find(o => o.id === e.id) || slot.options[0]) : { noWeight: !!e.noWeight };
      const noW = !!opt.noWeight;
      const head = slot && slot.options.length > 1
        ? `<select class="variant" data-act="variant" data-i="${i}" aria-label="Exercise choice">${slot.options.map(o => `<option value="${o.id}" ${o.id === e.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`
        : `<h3>${esc(e.name)}</h3>`;
      const badges = (slot && slot.optional ? ' <span class="badge">optional</span>' : '') + (slot && slot.added ? ' <span class="badge">added §3.3</span>' : '');
      const tw = e.target.w != null && !noW ? ` · ${fk(e.target.w)} kg${opt.bw ? ' added' : ` (${lb(e.target.w)} lb)`}` : '';
      h += `<div class="card ex-card"><div class="row between top"><div class="grow">${head}${badges}</div><button class="icon-btn" data-act="ex-remove" data-i="${i}" aria-label="Remove ${esc(e.name)}">${icon('close')}</button></div>
        <div class="target">${e.target.sets} × ${repTxt(e.target.reps)}${slot && slot.slot === 'medball' ? ' each side' : ''}${tw}</div>
        <div class="why">${esc(e.why)}</div>${slot && slot.note ? `<div class="why">${esc(slot.note)}</div>` : ''}
        <table class="sets"><thead><tr><th>Set</th>${noW ? '' : `<th>${opt.bw ? 'Added kg' : 'kg'}</th>`}<th>Reps</th><th></th></tr></thead><tbody>
        ${e.sets.map((s, j) => `<tr class="${s.done ? 'is-done' : ''}"><td>${j + 1}</td>${noW ? '' : `<td><input type="number" inputmode="decimal" step="any" data-f="w" data-i="${i}" data-j="${j}" value="${s.w == null ? '' : s.w}" aria-label="Set ${j + 1} weight"></td>`}<td><input type="number" inputmode="numeric" step="1" data-f="r" data-i="${i}" data-j="${j}" value="${s.r == null ? '' : s.r}" aria-label="Set ${j + 1} reps"></td><td class="ok"><button class="set-done ${s.done ? 'on' : ''}" data-act="set-done" data-i="${i}" data-j="${j}" aria-pressed="${s.done}" aria-label="Set ${j + 1} done">${icon('check')}</button></td></tr>`).join('')}
        </tbody></table>
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn small ghost" data-act="set-add" data-i="${i}">${icon('plus')}Set</button>${e.sets.length > 1 ? `<button class="btn small ghost" data-act="set-del" data-i="${i}">Remove last set</button>` : ''}</div></div>`;
    });
    h += `<button class="btn block" data-act="ex-add">${icon('plus')}Add an exercise</button>`;
    h += `<p class="small muted" style="margin-top:14px">Tick each set as you finish it; ticked sets are what the progression reads. A rest timer starts when you tick a set. ${doneCount} set${doneCount === 1 ? '' : 's'} ticked so far.</p>`;
    h += `<p class="source">${esc(D.lifting.rule)} (section 5)</p>`;
    return h;
  }

  function finishSheet() {
    const dr = state.draft;
    const isLift = dr.kind === 'lift';
    const mins = dr.dur || (dr.startedAt ? Math.max(1, Math.round((Date.now() - dr.startedAt) / 60000)) : 15);
    const doneCount = isLift ? dr.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0) : 0;
    openSheet(() => `<div class="sheet-title"><h3>Finish ${esc(isLift ? D.lifting.sessions[dr.routine].name : 'home workout')}</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div>
      ${isLift && !doneCount ? notice('No sets ticked', 'Only ticked sets count towards progression. Go back and tick the sets you did, or save anyway.') : ''}
      <label class="field"><span>Duration (min)</span><input type="number" inputmode="numeric" id="fin-dur" value="${mins}"></label>
      <div class="field"><span class="field-label">Effort (session RPE, 1–10)</span>${rpeRow(dr.rpe, 'draft-rpe')}</div>
      <label class="field"><span>Notes</span><textarea id="fin-notes">${esc(dr.notes || '')}</textarea></label>
      <button class="btn primary block" data-act="save-draft">Save session</button>`);
  }
  function rpeRow(val, act) {
    return `<div class="rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="${val === n ? 'on' : ''}" data-act="${act}" data-val="${n}" aria-pressed="${val === n}">${n}</button>`).join('')}</div>`;
  }
  function saveDraft() {
    const dr = state.draft;
    const dur = num(document.getElementById('fin-dur').value);
    const notes = document.getElementById('fin-notes').value.trim();
    const s = { id: dr.editId || dr.id, date: dr.date, type: dr.kind, ts: dr.ts || Date.now(), dur: dur || null, rpe: dr.rpe || null, notes };
    if (dr.kind === 'lift') {
      s.data = { routine: dr.routine, deload: dr.deload || undefined, exercises: dr.exercises.map(e => ({ slot: e.slot, id: e.id, name: e.name, target: e.target, sets: e.sets.map(x => ({ w: x.w, r: x.r, done: !!x.done })) })) };
    } else {
      s.data = { routine: 'H', pull: !!dr.pull, results: dr.results };
    }
    state.sessions = state.sessions.filter(x => x.id !== s.id).concat([s]);
    const name = sessionTitle(s);
    state.draft = null;
    stopRest();
    save(); closeSheet();
    toast('Saved ' + name);
    location.hash = '#/today';
  }

  // =====================================================================
  // HOME WORKOUT (guided timer)
  // =====================================================================
  function homePhases(pull) {
    const H = D.home;
    const ph = [{ kind: 'warm', name: 'Warm-up', dur: H.warmup.dur, items: H.warmup.items }];
    H.gauntlets.forEach((g, i) => {
      const lad = pull && g.alt ? g.alt : g;
      ph.push({ kind: 'work', id: g.id, n: i + 1, name: lad.name || g.name, dur: H.work, ladder: lad.ladder });
      if (i < H.gauntlets.length - 1) {
        const nx = H.gauntlets[i + 1], nl = pull && nx.alt ? nx.alt : nx;
        ph.push({ kind: 'trans', name: 'Transition', dur: H.transition, next: `${nl.name || nx.name}: start on ${nl.ladder[0]}` });
      }
    });
    ph.push({ kind: 'cool', name: 'Mobility cool-down', dur: H.cooldown.dur, items: H.cooldown.items });
    return ph;
  }
  function startHome(date) {
    if (state.draft) { toast('Finish or discard the workout in progress first.'); location.hash = '#/' + (state.draft.kind === 'lift' ? 'workout' : 'home'); return; }
    state.draft = { kind: 'home', id: uid(), date, startedAt: Date.now(), pull: !!state.settings.homePull, results: {}, rpe: null, notes: '', timer: { idx: 0, acc: 0, mark: null } };
    save();
    location.hash = '#/home';
  }
  function timerState(dr) {
    const ph = homePhases(dr.pull);
    const t = dr.timer || (dr.timer = { idx: 0, acc: 0, mark: null });
    const run = t.mark ? (Date.now() - t.mark) / 1000 : 0;
    let idx = t.idx, el = t.acc + run;
    while (idx < ph.length && el >= ph[idx].dur) { el -= ph[idx].dur; idx++; }
    return { ph, idx, el, running: !!t.mark, done: idx >= ph.length };
  }
  // Fold elapsed running time into the stored phase index (call before pausing or skipping).
  function settleTimer(dr) {
    const ts = timerState(dr);
    dr.timer.idx = Math.min(ts.idx, ts.ph.length);
    dr.timer.acc = ts.done ? 0 : ts.el;
    dr.timer.mark = dr.timer.mark && !ts.done ? Date.now() : null;
    return ts;
  }

  function viewHome() {
    const dr = state.draft;
    if (!dr || dr.kind !== 'home') { setTimeout(() => { location.hash = '#/today'; }); return ''; }
    const H = D.home;
    let h = `<div class="wk-head"><button class="icon-btn" data-act="leave" aria-label="Leave workout">${icon('close')}</button><div class="t"><strong>${esc(H.name)}</strong><span>${esc(fmtLong(dr.date))}</span></div><button class="btn primary small" data-act="finish">Finish</button></div>`;
    h += `<div class="card" id="clock-card">${clockHTML(dr)}</div>`;
    h += `<div class="card"><label class="switch"><span class="small">Bar or sturdy table here? Swap gauntlet 3 for the pull ladder</span><input type="checkbox" data-act="home-pull" ${dr.pull ? 'checked' : ''}></label></div>`;
    h += `<h2>Log as you go</h2><div class="card">`;
    H.gauntlets.forEach((g, i) => {
      const lad = dr.pull && g.alt ? g.alt : g;
      const r = dr.results[g.id] || {};
      h += `${i ? '<hr class="sep">' : ''}<p style="margin:0 0 8px;font-weight:650">${i + 1}. ${esc(lad.name || g.name)}</p><div class="field-row"><label class="field" style="margin:0"><span>Reps on ${esc(lad.ladder[0])}</span><input type="number" inputmode="numeric" data-hf="reps" data-g="${g.id}" value="${r.reps == null ? '' : r.reps}"></label><label class="field" style="margin:0"><span>Lowest step reached</span><select data-hf="low" data-g="${g.id}">${lad.ladder.map((n, k) => `<option value="${k}" ${+r.low === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>`;
    });
    h += `</div><p class="small muted">${esc(H.how)}</p><p class="source">${esc(H.source)}</p>`;
    return h;
  }
  function clockHTML(dr) {
    const ts = timerState(dr);
    const total = ts.ph.reduce((n, p) => n + p.dur, 0);
    const doneSec = ts.ph.slice(0, ts.idx).reduce((n, p) => n + p.dur, 0) + (ts.done ? 0 : ts.el);
    if (ts.done) return `<div class="clock"><div class="phase">Finished</div><div class="big">0:00</div><div class="name">Nice work. Log your reps below, then tap Finish.</div></div><div class="progress-line"><div style="width:100%"></div></div><div class="btn-row"><button class="btn" data-act="t-restart">Start again</button></div>`;
    const p = ts.ph[ts.idx];
    const label = p.kind === 'work' ? `Gauntlet ${p.n} of 5` : p.kind === 'trans' ? 'Transition' : p.name;
    let body = '';
    if (p.kind === 'work') body = `<ol class="ladder">${p.ladder.map(n => `<li>${esc(n)}</li>`).join('')}</ol><p class="small muted" style="margin-top:6px">Start at the top. Drop a step only at failure, no planned rest.</p>`;
    else if (p.kind === 'trans') body = `<p class="small" style="margin:0">Next: ${esc(p.next)}</p>`;
    else body = `<ul class="plain">${p.items.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    return `<div class="clock"><div class="phase">${esc(label)}</div><div class="big" id="clock-big">${mmss(p.dur - ts.el)}</div><div class="name">${esc(p.kind === 'work' ? p.name : p.kind === 'trans' ? 'Breathe, set up' : '')}</div></div>
      <div class="progress-line"><div id="clock-bar" style="width:${(doneSec / total * 100).toFixed(1)}%"></div></div>
      <div class="row" style="justify-content:center;gap:10px"><button class="icon-btn" data-act="t-prev" aria-label="Previous part">${icon('prev')}</button><button class="btn primary" style="min-width:140px" data-act="t-toggle">${ts.running ? icon('pause') + 'Pause' : icon('play') + (ts.idx === 0 && ts.el === 0 ? 'Start' : 'Resume')}</button><button class="icon-btn" data-act="t-next" aria-label="Next part">${icon('next')}</button></div>
      <div style="margin-top:12px">${body}</div>`;
  }

  let homeLoop = null, lastPhaseKey = '', audio = null, wakeLock = null;
  function beep(freq, len) {
    try {
      if (!audio) return;
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.18, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + len);
      o.start(); o.stop(audio.currentTime + len);
    } catch (e) { /* sound is optional */ }
  }
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }
  let lastBeepSec = null;
  function homeTick() {
    const dr = state.draft;
    if (!dr || dr.kind !== 'home') return;
    const ts = timerState(dr);
    const key = ts.idx + (ts.done ? 'd' : '');
    if (key !== lastPhaseKey) {
      if (lastPhaseKey && ts.running) beep(ts.done ? 520 : 880, 0.35);
      lastPhaseKey = key;
      const card = document.getElementById('clock-card');
      if (card) card.innerHTML = clockHTML(dr);
      if (ts.done && dr.timer.mark) { settleTimer(dr); save(); keepAwake(false); }
      return;
    }
    if (ts.done) return;
    const left = ts.ph[ts.idx].dur - ts.el;
    const big = document.getElementById('clock-big');
    if (big) big.textContent = mmss(left);
    const bar = document.getElementById('clock-bar');
    if (bar) {
      const total = ts.ph.reduce((n, p) => n + p.dur, 0);
      const doneSec = ts.ph.slice(0, ts.idx).reduce((n, p) => n + p.dur, 0) + ts.el;
      bar.style.width = (doneSec / total * 100).toFixed(1) + '%';
    }
    const sec = Math.ceil(left);
    if (ts.running && sec <= 3 && sec >= 1 && sec !== lastBeepSec) { beep(660, 0.12); }
    lastBeepSec = sec;
  }
  function startHomeLoop() { stopHomeLoop(); lastPhaseKey = ''; homeTick(); homeLoop = setInterval(homeTick, 250); }
  function stopHomeLoop() { if (homeLoop) clearInterval(homeLoop); homeLoop = null; }

  // =====================================================================
  // REST TIMER (lifting)
  // =====================================================================
  let rest = null;
  restEl.innerHTML = `<span class="tm num"></span><span class="lbl"></span><button data-act="rest-add">+30 s</button><button data-act="rest-stop">Done</button>`;
  function startRest(sec, label) { rest = { end: Date.now() + sec * 1000, label }; tickRest(); }
  function stopRest() { rest = null; tickRest(); }
  function tickRest() {
    const on = !!rest && location.hash.startsWith('#/workout');
    restEl.hidden = !on;
    document.body.classList.toggle('has-timer', on);
    if (!on) return;
    const left = (rest.end - Date.now()) / 1000;
    restEl.classList.toggle('over', left <= 0);
    restEl.querySelector('.tm').textContent = left <= 0 ? 'Go' : mmss(left);
    restEl.querySelector('.lbl').textContent = left <= 0 ? 'Rest over: next set' : 'Rest · ' + rest.label;
    if (left <= 0 && !rest.beeped) { rest.beeped = true; beep(880, 0.4); }
    if (left < -60) stopRest();
  }
  setInterval(() => { if (rest) tickRest(); const el = document.getElementById('elapsed'); if (el && state.draft && state.draft.startedAt) el.textContent = mmss((Date.now() - state.draft.startedAt) / 1000) + ' elapsed'; }, 500);

  // =====================================================================
  // SHEETS
  // =====================================================================
  let sheetRender = null;
  function openSheet(fn) {
    sheetRender = fn;
    sheet.innerHTML = `<div class="sheet-body"><div class="sheet-grip"></div>${fn()}</div>`;
    if (!sheet.open) { try { sheet.showModal(); } catch (e) { sheet.setAttribute('open', ''); } }
  }
  function refreshSheet() {
    if (!sheet.open || !sheetRender) return;
    const body = sheet.querySelector('.sheet-body');
    const top = body ? body.scrollTop : 0;
    sheet.innerHTML = `<div class="sheet-body"><div class="sheet-grip"></div>${sheetRender()}</div>`;
    const nb = sheet.querySelector('.sheet-body'); if (nb) nb.scrollTop = top;
  }
  function closeSheet() { sheetRender = null; if (sheet.open) sheet.close(); sheet.innerHTML = ''; }
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('close', () => { sheetRender = null; });

  function openAdd(date) {
    date = date || P.today();
    const next = D.lifting.rotation[P.rotationNext(state, 'lift', D.lifting.rotation)];
    openSheet(() => `<div class="sheet-title"><h3>Log a session</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div>
      <label class="field"><span>Date</span><input type="date" id="add-date" value="${date}" max="${P.addDays(P.today(), 7)}"></label>
      <div class="type-list">
        ${['mt', 'spar', 'grap'].map(t => `<button class="t-${t}" data-act="add-type" data-type="${t}">${esc(P.TYPES[t].name)}</button>`).join('')}
        ${D.lifting.rotation.map(r => `<button class="t-lift" data-act="add-lift" data-routine="${r}"><span>${esc(D.lifting.sessions[r].name)} · ${esc(D.lifting.sessions[r].focus)}<small>${r === next ? 'Next in the rotation' : 'Weightlifting'}</small></span></button>`).join('')}
        <button class="t-home" data-act="add-home"><span>Home workout<small>${esc(D.home.name)}</small></span></button>
        <button class="t-abs" data-act="add-type" data-type="abs">Daily abs</button>
      </div>`);
  }
  const addDate = () => { const el = document.getElementById('add-date'); return (el && el.value) || P.today(); };

  // ----- simple session form (MT, sparring, grappling, abs) -----
  const FOCUS = ['Technique', 'Pads', 'Bag', 'Clinch', 'Kicks', 'Drilling', 'Conditioning'];
  const INTENSITY = ['Technical', 'Light', 'Moderate', 'Hard'];
  const STYLES = ['No-gi', 'Gi', 'Wrestling', 'Other'];
  let form = null;
  function openForm(type, date, existing) {
    const lastOf = state.sessions.filter(s => s.type === type).sort((a, b) => b.date.localeCompare(a.date))[0];
    form = existing ? clone(existing) : {
      id: uid(), type, date, dur: lastOf ? lastOf.dur : (type === 'abs' ? 9 : 60), rpe: null, notes: '',
      data: type === 'abs' ? { routine: absRoutineFor(date).id, rounds: 3, items: [] } : type === 'mt' ? { focus: [], rounds: null } : type === 'spar' ? { rounds: lastOf && lastOf.data ? lastOf.data.rounds : null, roundLen: lastOf && lastOf.data ? lastOf.data.roundLen : 3, intensity: null } : { style: lastOf && lastOf.data ? lastOf.data.style : 'No-gi', rounds: null }
    };
    form.editing = !!existing;
    openSheet(formHTML);
  }
  function formHTML() {
    const f = form, d = f.data || {};
    const tog = (field, val, multi) => {
      const on = multi ? (d[field] || []).includes(val) : d[field] === val;
      return `<button class="toggle t-${f.type} ${on ? 'on' : ''}" data-act="form-tog" data-field="${field}" data-val="${esc(val)}" data-multi="${multi ? 1 : ''}" aria-pressed="${on}">${esc(val)}</button>`;
    };
    let h = `<div class="sheet-title"><h3>${esc(f.editing ? 'Edit ' : '')}${esc(P.TYPES[f.type].name)}</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div>
      <label class="field"><span>Date</span><input type="date" data-ff="date" value="${f.date}"></label>`;
    if (f.type === 'abs') {
      h += `<label class="field"><span>Routine</span><select data-ffd="routine">${D.abs.days.map(r => `<option value="${r.id}" ${d.routine === r.id ? 'selected' : ''}>${esc(r.name + ' · ' + r.focus)}</option>`).join('')}</select></label>
        <div class="field-row"><label class="field"><span>Rounds</span><input type="number" inputmode="numeric" data-ffd="rounds" value="${d.rounds == null ? '' : d.rounds}"></label><label class="field"><span>Duration (min)</span><input type="number" inputmode="numeric" data-ff="dur" value="${f.dur == null ? '' : f.dur}"></label></div>`;
    } else {
      const roundsLabel = f.type === 'grap' ? 'Rolls / rounds' : 'Rounds';
      h += `<div class="field-row"><label class="field"><span>Duration (min)</span><input type="number" inputmode="numeric" data-ff="dur" value="${f.dur == null ? '' : f.dur}"></label><label class="field"><span>${roundsLabel}</span><input type="number" inputmode="numeric" data-ffd="rounds" value="${d.rounds == null ? '' : d.rounds}"></label></div>`;
      if (f.type === 'spar') h += `<label class="field"><span>Round length (min)</span><input type="number" inputmode="decimal" step="any" data-ffd="roundLen" value="${d.roundLen == null ? '' : d.roundLen}"></label><div class="field"><span class="field-label">Intensity</span><div class="toggles">${INTENSITY.map(v => tog('intensity', v)).join('')}</div></div>`;
      if (f.type === 'mt') h += `<div class="field"><span class="field-label">Focus</span><div class="toggles">${FOCUS.map(v => tog('focus', v, true)).join('')}</div></div>`;
      if (f.type === 'grap') h += `<div class="field"><span class="field-label">Style</span><div class="toggles">${STYLES.map(v => tog('style', v)).join('')}</div></div>`;
      h += `<div class="field"><span class="field-label">Effort (session RPE, 1–10)</span>${rpeRow(f.rpe, 'form-rpe')}</div>`;
    }
    h += `<label class="field"><span>Notes</span><textarea data-ff="notes" placeholder="${f.type === 'spar' ? 'Partners, what worked, any knocks' : 'Anything worth remembering'}">${esc(f.notes || '')}</textarea></label>
      <button class="btn primary block" data-act="form-save">Save</button>`;
    return h;
  }
  function saveForm() {
    const f = form;
    if (!f.date) { toast('Pick a date.'); return; }
    const s = { id: f.id, date: f.date, type: f.type, ts: f.ts || Date.now(), dur: num(f.dur), rpe: f.rpe || null, notes: (f.notes || '').trim(), data: f.data };
    if (s.type === 'abs') {
      const r = D.abs.days.find(x => x.id === s.data.routine) || D.abs.days[0];
      if (!s.data.items || !s.data.items.length || s.data.itemsFor !== r.id) {
        s.data.items = r.exercises.map(ex => { const L = lvl('abs.' + ex.id, ex.steps.length); return { id: ex.id, step: L, label: ex.steps[L] }; });
        s.data.itemsFor = r.id;
      }
    }
    state.sessions = state.sessions.filter(x => x.id !== s.id).concat([s]);
    save(); closeSheet(); form = null;
    toast('Saved ' + sessionTitle(s));
    render();
  }

  // ----- session detail -----
  let confirmDelete = null;
  function openSession(id) {
    confirmDelete = null;
    openSheet(() => {
      const s = state.sessions.find(x => x.id === id);
      if (!s) return '<p>Not found.</p>';
      const d = s.data || {};
      let h = `<div class="sheet-title"><div>${chip(s.type, chipLabel(s))}<h3 style="margin-top:8px">${esc(sessionTitle(s))}</h3><p class="small muted" style="margin:2px 0 0">${esc(fmtLong(s.date))}</p></div><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div>`;
      const meta = sessionMeta(s);
      if (meta) h += `<p class="small">${esc(meta)}${s.rpe && s.dur ? ` · load ${s.rpe * s.dur}` : ''}</p>`;
      if (s.type === 'lift' && Array.isArray(d.exercises)) {
        h += `<div class="card" style="padding:12px">${d.exercises.map(e => { const done = (e.sets || []).filter(x => x.done); return `<div class="row between small" style="padding:5px 0;align-items:flex-start"><span style="font-weight:650">${esc(e.name)}</span><span class="muted" style="text-align:right">${done.length ? esc(P.fmtSets(done)) : 'skipped'}</span></div>`; }).join('')}</div>`;
        if (d.deload) h += `<p class="small muted">Deload session.</p>`;
      }
      if (s.type === 'home' && d.results) {
        h += `<div class="card" style="padding:12px">${D.home.gauntlets.map(g => { const lad = d.pull && g.alt ? g.alt : g; const r = d.results[g.id]; return `<div class="row between small" style="padding:5px 0;align-items:flex-start"><span style="font-weight:650">${esc(lad.name || g.name)}</span><span class="muted" style="text-align:right">${r && r.reps != null ? `${r.reps} × ${esc(lad.ladder[0])}` : '–'}${r && r.low != null ? `<br>down to ${esc(lad.ladder[+r.low])}` : ''}</span></div>`; }).join('')}</div>`;
      }
      if (s.type === 'abs' && Array.isArray(d.items)) {
        const r = D.abs.days.find(x => x.id === d.routine);
        h += `<div class="card" style="padding:12px">${d.items.map(it => { const ex = r && r.exercises.find(x => x.id === it.id); return `<div class="row between small" style="padding:5px 0"><span style="font-weight:650">${esc(ex ? ex.name : it.id)}</span><span class="muted">${esc(it.label)}</span></div>`; }).join('')}</div>`;
      }
      if (s.notes) h += `<p class="small" style="white-space:pre-wrap">${esc(s.notes)}</p>`;
      h += `<div class="btn-row" style="margin-top:12px"><button class="btn" data-act="edit-session" data-id="${s.id}">Edit</button><button class="btn danger" data-act="del-session" data-id="${s.id}">${confirmDelete === s.id ? 'Tap again to delete' : 'Delete'}</button></div>`;
      return h;
    });
  }
  function editSession(id) {
    const s = state.sessions.find(x => x.id === id);
    if (!s) return;
    if (s.type === 'lift' || s.type === 'home') {
      if (state.draft) { toast('Finish or discard the workout in progress first.'); return; }
      const d = clone(s.data || {});
      state.draft = s.type === 'lift'
        ? { kind: 'lift', editId: s.id, ts: s.ts, date: s.date, routine: d.routine, startedAt: null, dur: s.dur, deload: !!d.deload, rpe: s.rpe, notes: s.notes, exercises: d.exercises || [] }
        : { kind: 'home', editId: s.id, ts: s.ts, date: s.date, startedAt: null, dur: s.dur, pull: !!d.pull, results: d.results || {}, rpe: s.rpe, notes: s.notes, timer: { idx: 99, acc: 0, mark: null } };
      save(); closeSheet();
      location.hash = '#/' + (s.type === 'lift' ? 'workout' : 'home');
      return;
    }
    closeSheet();
    openForm(s.type, s.date, s);
  }

  // ----- day editor -----
  function openDayEditor(date) {
    openSheet(() => {
      const o = state.days[date] || {};
      const usual = state.settings.schedule[P.weekday(date)];
      const combat = P.plannedCombat(state, date);
      const week = weekPlan(date);
      const d = week.days.find(x => x.date === date);
      const mode = o.mode || 'auto';
      const gym = P.gymOn(state, date);
      let h = `<div class="sheet-title"><div><h3>${esc(fmtLong(date))}</h3><p class="small muted" style="margin:2px 0 0">Usually: ${esc(usual.length ? P.namesOf(usual) : 'no fight training')}</p></div><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div>`;
      h += `<div class="card info" style="padding:12px"><div class="chips">${dayChips(d)}</div><p class="small muted" style="margin:6px 0 0">${esc(d.reason)}</p></div>`;
      if (!d.past) {
        h += `<div class="field"><span class="field-label">Fight training this day</span><div class="toggles">${P.COMBAT.map(t => `<button class="toggle t-${t} ${combat.includes(t) ? 'on' : ''}" data-act="day-combat" data-date="${date}" data-type="${t}" aria-pressed="${combat.includes(t)}">${esc(P.TYPES[t].name)}</button>`).join('')}</div></div>`;
        h += `<div class="field"><span class="field-label">Lifting and rest</span><div class="seg">${[['auto', 'Let the planner decide'], ['train', 'Train'], ['rest', 'Rest']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="day-mode" data-date="${date}" data-val="${k}">${l}</button>`).join('')}</div><p class="small muted" style="margin:6px 0 0">Train adds a lift (or the home workout without a gym), even on a fight-training day. Rest keeps the day clear.</p></div>`;
        h += `<div class="switch"><span>Gym access this day</span><div class="seg" style="width:150px"><button class="${gym ? 'on' : ''}" data-act="gym" data-date="${date}" data-val="1">Yes</button><button class="${gym ? '' : 'on'}" data-act="gym" data-date="${date}" data-val="0">No</button></div></div>`;
      }
      if (d.logged.length || d.abs) h += `<h2 style="margin-top:14px">Logged</h2>${d.logged.concat(d.abs ? [d.abs] : []).map(logRow).join('')}`;
      h += `<div class="btn-row" style="margin-top:12px">${date <= P.addDays(P.today(), 7) ? `<button class="btn" data-act="add" data-date="${date}">${icon('plus')}Log a session</button>` : ''}${state.days[date] ? `<button class="btn" data-act="day-reset" data-date="${date}">Back to usual</button>` : ''}</div>`;
      return h;
    });
  }

  function openSetup() {
    openSheet(() => `<div class="sheet-title"><h3>Your usual week</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div><p class="small muted">Tap the fight training you normally do on each day. Leave a day empty if you don't usually do any; the planner will use it for lifting or rest.</p>${scheduleGrid()}<button class="btn primary block" style="margin-top:14px" data-act="setup-done">Done</button>`);
  }

  function openLeave() {
    const dr = state.draft;
    openSheet(() => `<div class="sheet-title"><h3>Leave this workout?</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div><p class="small muted">${dr.editId ? 'Your edits haven’t been saved yet.' : 'You can keep it and continue later from the Today screen.'}</p><div class="btn-row"><button class="btn" data-act="leave-keep">Keep for later</button><button class="btn danger" data-act="leave-discard">${dr.editId ? 'Discard edits' : 'Discard workout'}</button></div>`);
  }

  function openAddExercise() {
    openSheet(() => `<div class="sheet-title"><h3>Add an exercise</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div><label class="field"><span>Name</span><input type="text" id="new-ex" placeholder="e.g. Barbell curl" autocomplete="off"></label><label class="switch"><span>Bodyweight only (no weight to log)</span><input type="checkbox" id="new-ex-bw"></label><button class="btn primary block" data-act="ex-add-save">Add</button>`);
    setTimeout(() => { const el = document.getElementById('new-ex'); if (el) el.focus(); }, 50);
  }

  // =====================================================================
  // ACTIONS
  // =====================================================================
  const A = {
    close: () => closeSheet(),
    setup: () => openSetup(),
    'setup-done': () => { state.settings.setupDone = true; save(); closeSheet(); render(); },
    add: el => { closeSheet(); openAdd(el.dataset.date); },
    'add-type': el => { const d = addDate(); closeSheet(); openForm(el.dataset.type, d); },
    'add-lift': el => { const d = addDate(); closeSheet(); startLift(el.dataset.routine, d); },
    'add-home': () => { const d = addDate(); closeSheet(); startHome(d); },
    log: el => openForm(el.dataset.type, el.dataset.date),
    'form-tog': el => {
      const d = form.data, f = el.dataset.field, v = el.dataset.val;
      if (el.dataset.multi) { d[f] = d[f] || []; d[f] = d[f].includes(v) ? d[f].filter(x => x !== v) : d[f].concat([v]); }
      else d[f] = d[f] === v ? null : v;
      refreshSheet();
    },
    'form-rpe': el => { form.rpe = +el.dataset.val; refreshSheet(); },
    'form-save': () => saveForm(),
    session: el => openSession(el.dataset.id),
    'edit-session': el => editSession(el.dataset.id),
    'del-session': el => {
      const id = el.dataset.id;
      if (confirmDelete !== id) { confirmDelete = id; refreshSheet(); return; }
      state.sessions = state.sessions.filter(s => s.id !== id);
      save(); closeSheet(); toast('Deleted'); render();
    },
    day: el => openDayEditor(el.dataset.date),
    'day-combat': el => {
      const date = el.dataset.date, t = el.dataset.type;
      let c = P.plannedCombat(state, date);
      c = c.includes(t) ? c.filter(x => x !== t) : c.concat([t]);
      const usual = state.settings.schedule[P.weekday(date)];
      const same = c.length === usual.length && c.every(x => usual.includes(x));
      setDay(date, { combat: same ? undefined : P.COMBAT.filter(x => c.includes(x)) });
      if (c.length && state.days[date] && state.days[date].mode === 'rest') setDay(date, { mode: undefined });
      refreshSheet(); render();
    },
    'day-mode': el => { setDay(el.dataset.date, { mode: el.dataset.val === 'auto' ? undefined : el.dataset.val }); refreshSheet(); render(); },
    'day-reset': el => { delete state.days[el.dataset.date]; save(); refreshSheet(); render(); },
    gym: el => {
      const v = el.dataset.val === '1';
      setDay(el.dataset.date, { gym: v === (state.settings.gym !== false) ? undefined : v });
      refreshSheet(); render();
    },
    'skip-combat': el => { setDay(el.dataset.date, { combat: [], mode: undefined }); toast('Replanned today'); render(); },
    'rest-instead': el => { setDay(el.dataset.date, { mode: 'rest', combat: [] }); toast('Marked as a rest day'); render(); },
    'train-anyway': el => { setDay(el.dataset.date, { mode: 'train' }); render(); },
    'start-lift': el => startLift(el.dataset.routine, el.dataset.date),
    'start-home': el => startHome(el.dataset.date),
    lvl: el => {
      const k = el.dataset.key, max = +el.dataset.max;
      state.levels[k] = Math.min(max - 1, Math.max(0, (state.levels[k] || 0) + +el.dataset.d));
      save(); render();
    },
    'abs-log': el => {
      const r = D.abs.days.find(x => x.id === el.dataset.routine);
      const items = r.exercises.map(ex => { const L = lvl('abs.' + ex.id, ex.steps.length); return { id: ex.id, step: L, label: ex.steps[L] }; });
      const rounds = +el.dataset.rounds;
      state.sessions.push({ id: uid(), date: el.dataset.date, type: 'abs', ts: Date.now(), dur: rounds * 3, rpe: null, notes: '', data: { routine: r.id, rounds, items, itemsFor: r.id } });
      save(); toast('Abs logged'); render();
    },
    'abs-undo': el => { state.sessions = state.sessions.filter(s => s.id !== el.dataset.id); save(); render(); },
    week: el => { planOffset += +el.dataset.dir; render(); },
    'deload-on': el => { state.deloads[el.dataset.week] = true; save(); render(); },
    filter: el => { logFilter = el.dataset.val; render(); },
    sched: el => {
      const i = +el.dataset.day, t = el.dataset.type, sc = state.settings.schedule;
      sc[i] = sc[i].includes(t) ? sc[i].filter(x => x !== t) : P.COMBAT.filter(x => x === t || sc[i].includes(x));
      save(); refreshSheet(); render();
    },
    step: el => {
      const k = el.dataset.key, lim = k === 'restMin' ? [2, 4] : [1, 4];
      state.settings[k] = Math.min(lim[1], Math.max(lim[0], state.settings[k] + +el.dataset.d));
      save(); render();
    },
    export: () => exportBackup(),
    import: () => document.getElementById('import-file').click(),
    csv: () => exportCSV(),
    reset: () => openSheet(() => `<div class="sheet-title"><h3>Delete all data?</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div><p class="small">This removes every logged session, your plan changes and settings from this phone. It can't be undone unless you have a backup.</p><div class="btn-row"><button class="btn" data-act="export">Export a backup first</button><button class="btn danger" data-act="reset-yes">Delete everything</button></div>`),
    'reset-yes': () => { state = defaults(); save(); closeSheet(); toast('All data deleted'); location.hash = '#/today'; render(); },
    // workout
    leave: () => openLeave(),
    'leave-keep': () => { closeSheet(); stopRest(); stopHomeTimer(); location.hash = '#/today'; },
    'leave-discard': () => { state.draft = null; save(); closeSheet(); stopRest(); keepAwake(false); location.hash = '#/today'; },
    finish: () => { if (state.draft && state.draft.kind === 'home') stopHomeTimer(); finishSheet(); },
    'draft-rpe': el => { state.draft.rpe = +el.dataset.val; save(); const n = document.getElementById('fin-notes'); const d = document.getElementById('fin-dur'); const keep = { n: n && n.value, d: d && d.value }; refreshSheet(); if (keep.n != null) document.getElementById('fin-notes').value = keep.n; if (keep.d != null) document.getElementById('fin-dur').value = keep.d; },
    'save-draft': () => saveDraft(),
    'set-done': el => {
      const e = state.draft.exercises[+el.dataset.i], s = e.sets[+el.dataset.j];
      s.done = !s.done; save();
      if (s.done) { const slot = e.slot ? slotDef(state.draft.routine, e.slot) : null; startRest((slot && slot.rest) || 90, e.name); }
      render();
    },
    'set-add': el => { const e = state.draft.exercises[+el.dataset.i]; const l = e.sets[e.sets.length - 1] || { w: e.target.w, r: e.target.reps[0] }; e.sets.push({ w: l.w, r: l.r, done: false }); save(); render(); },
    'set-del': el => { const e = state.draft.exercises[+el.dataset.i]; if (e.sets.length > 1) e.sets.pop(); save(); render(); },
    'ex-remove': el => { state.draft.exercises.splice(+el.dataset.i, 1); save(); render(); },
    'ex-add': () => openAddExercise(),
    'ex-add-save': () => {
      const name = (document.getElementById('new-ex').value || '').trim();
      if (!name) { toast('Give it a name.'); return; }
      const bw = document.getElementById('new-ex-bw').checked;
      const id = 'custom:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const hist = P.exHistory(state, id, state.draft.date);
      const lastW = hist.length ? Math.max(...hist[0].sets.map(x => +x.w || 0)) : null;
      state.draft.exercises.push({ slot: null, id, name, target: { sets: 3, reps: [8, 12], w: bw ? null : lastW }, why: hist.length ? `Your own addition. Last time: ${P.fmtSets(hist[0].sets)}.` : 'Your own addition.', sets: [0, 1, 2].map(() => ({ w: bw ? null : lastW, r: 10, done: false })), custom: true, noWeight: bw });
      save(); closeSheet(); render();
    },
    'rest-add': () => { if (rest) { rest.end = Math.max(rest.end, Date.now()) + 30000; rest.beeped = false; tickRest(); } },
    'rest-stop': () => stopRest(),
    // home timer
    't-toggle': () => {
      const dr = state.draft, t = dr.timer;
      if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
      if (audio && audio.state === 'suspended') audio.resume();
      if (t.mark) { settleTimer(dr); t.mark = null; keepAwake(false); }
      else { settleTimer(dr); t.mark = Date.now(); keepAwake(true); }
      save(); lastPhaseKey = ''; homeTick();
    },
    't-next': () => { const dr = state.draft; const ts = settleTimer(dr); dr.timer.idx = Math.min(ts.ph.length, ts.idx + 1); dr.timer.acc = 0; if (dr.timer.mark) dr.timer.mark = Date.now(); save(); lastPhaseKey = ''; homeTick(); },
    't-prev': () => { const dr = state.draft; const ts = settleTimer(dr); dr.timer.idx = ts.el > 3 ? ts.idx : Math.max(0, ts.idx - 1); dr.timer.acc = 0; if (dr.timer.mark) dr.timer.mark = Date.now(); save(); lastPhaseKey = ''; homeTick(); },
    't-restart': () => { const dr = state.draft; dr.timer = { idx: 0, acc: 0, mark: null }; save(); lastPhaseKey = ''; homeTick(); }
  };
  function stopHomeTimer() {
    const dr = state.draft;
    if (dr && dr.kind === 'home' && dr.timer && dr.timer.mark) { settleTimer(dr); dr.timer.mark = null; save(); }
    keepAwake(false);
  }

  document.addEventListener('click', e => {
    if (e.target.closest('svg.chart')) { chartPointer(e); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('svg.chart')) chartPointer(e); });
  document.addEventListener('pointerout', chartLeave);

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f && state.draft && state.draft.kind === 'lift') {
      const s = state.draft.exercises[+t.dataset.i].sets[+t.dataset.j];
      s[t.dataset.f] = num(t.value);
      save();
    } else if (t.dataset.hf && state.draft && state.draft.kind === 'home') {
      const r = state.draft.results[t.dataset.g] = state.draft.results[t.dataset.g] || {};
      r[t.dataset.hf] = num(t.value);
      save();
    } else if (t.dataset.ff && form) {
      form[t.dataset.ff] = t.value;
    } else if (t.dataset.ffd && form) {
      form.data[t.dataset.ffd] = t.tagName === 'SELECT' ? t.value : num(t.value);
    } else if (t.dataset.act === 'e1rm') {
      const v = num(t.value);
      if (v && v > 0) { state.settings.e1rm[t.dataset.key] = v; save(); }
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    const act = t.dataset.act;
    if (t.id === 'import-file') return importBackup(t);
    if (t.dataset.hf && state.draft) { const r = state.draft.results[t.dataset.g] = state.draft.results[t.dataset.g] || {}; r[t.dataset.hf] = num(t.value); save(); return; }
    if (t.dataset.ffd && form && t.tagName === 'SELECT') { form.data[t.dataset.ffd] = t.value; return; }
    if (!act) return;
    if (act === 'deload') { if (t.checked) state.deloads[t.dataset.week] = true; else delete state.deloads[t.dataset.week]; save(); render(); }
    if (act === 'sign') { const c = state.checkins[t.dataset.week] = state.checkins[t.dataset.week] || {}; c[t.dataset.sign] = t.checked; save(); render(); }
    if (act === 'set-bool') { state.settings[t.dataset.key] = t.checked; save(); render(); }
    if (act === 'home-pull' && state.draft) { state.draft.pull = t.checked; save(); render(); }
    if (act === 'variant' && state.draft) {
      const i = +t.dataset.i, e0 = state.draft.exercises[i];
      const slot = slotDef(state.draft.routine, e0.slot);
      const opt = slot.options.find(o => o.id === t.value);
      state.choices[slot.slot] = opt.id;
      if (e0.sets.some(s => s.done)) { e0.id = opt.id; e0.name = opt.name; }
      else state.draft.exercises[i] = buildEx(slot, opt, state.draft.date, state.draft.deload, state.draft.editId);
      save(); render();
    }
  });

  // =====================================================================
  // BACKUP
  // =====================================================================
  async function shareOrDownload(text, name, type) {
    const blob = new Blob([text], { type });
    try {
      const file = new File([blob], name, { type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function exportBackup() { shareOrDownload(JSON.stringify(state, null, 1), `exercise-tracker-backup-${P.today()}.json`, 'application/json'); }
  function exportCSV() {
    const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['date', 'type', 'session', 'duration_min', 'rpe', 'details', 'notes']];
    state.sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
      let details = sessionMeta(s);
      if (s.type === 'lift' && s.data && s.data.exercises) details = s.data.exercises.map(e => { const d = (e.sets || []).filter(x => x.done); return d.length ? `${e.name}: ${P.fmtSets(d)}` : null; }).filter(Boolean).join('; ');
      rows.push([s.date, P.TYPES[s.type].name, sessionTitle(s), s.dur, s.rpe, details, s.notes]);
    });
    shareOrDownload(rows.map(r => r.map(q).join(',')).join('\r\n'), `exercise-tracker-${P.today()}.csv`, 'text/csv');
  }
  function importBackup(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj || !Array.isArray(obj.sessions)) throw new Error('not a backup');
        openSheet(() => `<div class="sheet-title"><h3>Replace your data?</h3><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></div><p class="small">The backup has ${obj.sessions.length} session${obj.sessions.length === 1 ? '' : 's'}. Importing replaces everything currently on this phone (${state.sessions.length} session${state.sessions.length === 1 ? '' : 's'}).</p><div class="btn-row"><button class="btn" data-act="close">Cancel</button><button class="btn primary" id="import-yes">Replace</button></div>`);
        document.getElementById('import-yes').onclick = () => { state = merge(obj); save(); closeSheet(); toast('Backup imported'); render(); };
      } catch (e) { toast('That file isn’t an Exercise Tracker backup.'); }
      input.value = '';
    };
    rd.readAsText(f);
  }

  // =====================================================================
  // ROUTER
  // =====================================================================
  let renderedDay = P.today();
  function render() {
    const r = (location.hash.replace(/^#\/?/, '') || 'today').split('/')[0];
    const views = { today: viewToday, plan: viewPlan, log: viewLog, progress: viewProgress, settings: viewSettings, workout: viewWorkout, home: viewHome };
    const fn = views[r] || viewToday;
    document.body.classList.toggle('focus', r === 'workout' || r === 'home');
    view.innerHTML = fn();
    document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === r));
    if (r === 'home') startHomeLoop(); else stopHomeLoop();
    tickRest();
    renderedDay = P.today();
  }
  let lastRoute = '';
  window.addEventListener('hashchange', () => {
    const r = location.hash.split('/')[1] || 'today';
    if (r !== 'plan') planOffset = 0;
    closeSheet();
    render();
    if (r !== lastRoute) window.scrollTo(0, 0);
    lastRoute = r;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (P.today() !== renderedDay && !sheet.open) render();
    if (state.draft && state.draft.kind === 'home' && state.draft.timer && state.draft.timer.mark) keepAwake(true);
  });

  if (!location.hash) history.replaceState(null, '', '#/today');
  lastRoute = location.hash.split('/')[1] || 'today';
  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  window.__ET = { get state() { return state; }, render }; // for debugging from the console
})();
