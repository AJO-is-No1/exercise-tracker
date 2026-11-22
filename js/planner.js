// Pure logic: dates, the weekly planner, lifting progression and 1RM estimates. No DOM access here.
(function () {
  'use strict';

  const TYPES = {
    mt:   { name: 'Muay Thai Training', short: 'MT',   group: 'combat' },
    spar: { name: 'Muay Thai Sparring', short: 'Spar', group: 'combat' },
    grap: { name: 'Grappling',          short: 'Grap', group: 'combat' },
    lift: { name: 'Weightlifting',      short: 'Lift', group: 'train' },
    home: { name: 'Home Workout',       short: 'Home', group: 'train' },
    abs:  { name: 'Daily Abs',          short: 'Abs',  group: 'daily' }
  };
  const COMBAT = ['mt', 'spar', 'grap'];
  const TRAIN = ['lift', 'home'];
  const MAIN = COMBAT.concat(TRAIN);
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const LB = 2.20462;

  // ---------- dates: local calendar days as 'YYYY-MM-DD' ----------
  const pad = n => String(n).padStart(2, '0');
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); } // noon dodges DST edges
  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function weekday(s) { return (parse(s).getDay() + 6) % 7; } // Monday = 0
  function weekStart(s) { return addDays(s, -weekday(s)); }
  function today() { return iso(new Date()); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }

  // ---------- session lookups ----------
  const byNewest = (a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0);
  function sessionsOn(state, date) { return state.sessions.filter(s => s.date === date); }

  function plannedCombat(state, date) {
    const o = state.days[date];
    if (o && Array.isArray(o.combat)) return o.combat.slice();
    return (state.settings.schedule[weekday(date)] || []).slice();
  }
  function gymOn(state, date) {
    const o = state.days[date];
    if (o && typeof o.gym === 'boolean') return o.gym;
    return state.settings.gym !== false;
  }

  // Index (into `list`) of the routine that comes after the most recent logged one.
  function rotationNext(state, type, list, before) {
    let last = null;
    for (const s of state.sessions) {
      if (s.type !== type || !s.data || !list.includes(s.data.routine)) continue;
      if (before && s.date >= before) continue;
      if (!last || byNewest(s, last) < 0) last = s;
    }
    return last ? (list.indexOf(last.data.routine) + 1) % list.length : 0;
  }

  // ---------- weekly planner ----------
  // Score one candidate week. L = 7 day labels (Mon..Sun), prev = up to 3 labels before Monday (null = unknown).
  function scoreWeek(L, prev) {
    const all = prev.concat(L);
    const off = prev.length;
    let s = 0;
    for (let i = 0; i < 7; i++) {
      const d = L[i], y = all[off + i - 1];
      if (d.assigned && d.train) s += 10 + (6 - i) * 0.01;           // train when there's room; slight preference for earlier
      if (y && d.train && y.train) s -= 8;                            // full-body lifting on consecutive days
      if (y && d.train && y.hard) s -= 3;                             // lifting the day after sparring
      if (y && d.rest && y.hardest) s += 3;                           // rest straight after the hardest session
      if (y && d.rest && y.rest) s -= 1;                              // spread rest days out a little
    }
    let run = 0;
    for (const d of all) {
      if (d && !d.rest) { run++; if (run > 3) s -= 2; } else run = 0; // long streaks without rest
    }
    return s;
  }

  function contextLabel(state, date, now) {
    if (date >= now) return null;
    const m = sessionsOn(state, date).filter(s => MAIN.includes(s.type));
    if (!m.length) return { rest: true };
    return { train: m.some(s => TRAIN.includes(s.type)), combat: m.some(s => COMBAT.includes(s.type)), hard: m.some(s => s.type === 'spar') };
  }

  // Plans the Mon..Sun week containing `anyDate`. `rot` = { lift } rotation index to start from (defaults to the log).
  function planWeek(state, data, anyDate, now, rot) {
    now = now || today();
    const start = weekStart(anyDate);
    const S = state.settings;
    const restMin = S.restMin || 2;
    const liftMax = S.liftMax || 3;
    const deload = !!state.deloads[start];
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const all = sessionsOn(state, date);
      const logged = all.filter(s => MAIN.includes(s.type)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const o = state.days[date] || {};
      const d = {
        date, wd: i, isToday: date === now, past: date < now, future: date > now,
        logged, abs: all.find(s => s.type === 'abs') || null, override: o,
        combat: [], train: null, status: '', reason: '', isTrain: false, isCombat: false, hard: false, extraTrain: false,
        gym: gymOn(state, date)
      };
      if (logged.length) {
        d.status = 'logged';
        d.isTrain = logged.some(s => TRAIN.includes(s.type));
        d.isCombat = logged.some(s => COMBAT.includes(s.type));
        d.hard = logged.some(s => s.type === 'spar');
        d.mtCount = logged.filter(s => s.type === 'mt').length;
        if (d.isToday && o.mode === 'train' && !d.isTrain) { d.extraTrain = true; d.isTrain = true; }
      } else if (d.past) {
        d.status = 'rested';
      } else {
        const combat = plannedCombat(state, date);
        if (o.mode === 'rest') {
          d.status = 'rest'; d.forcedRest = true;
        } else if (combat.length) {
          d.status = 'combat'; d.combat = combat; d.isCombat = true; d.hard = combat.includes('spar');
          if (o.mode === 'train') { d.extraTrain = true; d.isTrain = true; }
        } else if (o.mode === 'train') {
          d.status = 'train'; d.isTrain = true; d.forcedTrain = true;
        } else {
          d.status = 'free';
        }
      }
      days.push(d);
    }

    // The week's hardest session: sparring if there is any, otherwise the last Muay Thai day.
    let hardestIdx = -1;
    days.forEach((d, i) => { if (d.hard) hardestIdx = i; });
    if (hardestIdx < 0) days.forEach((d, i) => {
      if (d.combat.includes('mt') || d.logged.some(s => s.type === 'mt')) hardestIdx = i;
    });
    if (hardestIdx >= 0) days[hardestIdx].hardest = true;

    const free = days.filter(d => d.status === 'free');
    const restFixed = days.filter(d => d.status === 'rested' || d.status === 'rest').length;
    const trainFixed = days.filter(d => d.isTrain).length;
    const trainRoom = Math.max(0, liftMax - trainFixed);
    const maxRest = restFixed + free.length;
    const needRest = Math.min(restMin, maxRest);
    const prev = [3, 2, 1].map(k => contextLabel(state, addDays(start, -k), now));

    const baseLabels = days.map(d => ({
      train: d.isTrain, combat: d.isCombat, hard: d.hard, hardest: !!d.hardest,
      rest: d.status === 'rested' || d.status === 'rest', assigned: false
    }));

    let best = 0, bestScore = -Infinity;
    const n = free.length;
    for (let mask = 0; mask < (1 << n); mask++) {
      let t = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) t++;
      if (t > trainRoom) continue;
      if (restFixed + (n - t) < needRest) continue;
      const L = baseLabels.map(x => Object.assign({}, x));
      free.forEach((d, i) => {
        const l = L[d.wd];
        l.assigned = true;
        if (mask & (1 << i)) l.train = true; else l.rest = true;
      });
      const sc = scoreWeek(L, prev);
      if (sc > bestScore) { bestScore = sc; best = mask; }
    }
    free.forEach((d, i) => {
      if (best & (1 << i)) { d.status = 'train'; d.isTrain = true; }
      else d.status = 'rest';
    });

    // Routines for the training days still to come.
    const rotation = data.lifting.rotation;
    let liftIdx = rot && typeof rot.lift === 'number' ? rot.lift : rotationNext(state, 'lift', rotation);
    for (const d of days) {
      if (!d.isTrain || (d.status === 'logged' && !d.extraTrain)) continue;
      if (d.gym) {
        const id = rotation[liftIdx % rotation.length];
        d.train = { type: 'lift', routine: id, session: data.lifting.sessions[id] };
        liftIdx++;
      } else {
        d.train = { type: 'home', routine: 'H', session: data.home };
      }
    }

    // Reasons, in plain words.
    const trainTotal = days.filter(d => d.isTrain).length;
    days.forEach((d, i) => { d.reason = reasonFor(d, days[i - 1] || null, days[i + 1] || null, { restMin, liftMax, trainTotal, deload, state, start }); });

    const restTaken = days.filter(d => d.status === 'rested').length;
    const restPlanned = days.filter(d => d.status === 'rest').length;
    const warnings = [];
    if (maxRest < restMin) {
      warnings.push(`Only ${maxRest} rest day${maxRest === 1 ? '' : 's'} left possible this week with what's planned. Make one session a rest day to keep ${restMin}.`);
    }
    return {
      start, end: addDays(start, 6), days, deload,
      summary: {
        restTaken, restPlanned, restTotal: restTaken + restPlanned, restMin,
        train: trainTotal, liftMax,
        combat: days.filter(d => d.isCombat).length,
        absDone: days.filter(d => d.abs).length,
        absSoFar: days.filter(d => d.date <= now).length
      },
      warnings,
      rotEnd: { lift: liftIdx % rotation.length }
    };
  }

  function namesOf(types) {
    const n = types.map(t => TYPES[t].name);
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0] || '';
  }

  function reasonFor(d, y, t, ctx) {
    const dayName = DAY_NAMES[d.wd];
    switch (d.status) {
      case 'logged': {
        let r = 'Logged: ' + namesOf([...new Set(d.logged.map(s => s.type))]) + '.';
        if (d.extraTrain && d.train) r += ` You also planned ${d.train.session.name} today.`;
        return r;
      }
      case 'rested': return 'Nothing logged, so it counts as a rest day.';
      case 'combat': {
        const usual = !Array.isArray(d.override.combat);
        let r = (usual ? `Your usual ${dayName}: ` : 'You planned ') + namesOf(d.combat) + '.';
        if (d.hardest) r += ' Hardest session of the week.';
        if (ctx.deload) r += ' Deload week: keep Muay Thai technique-only.';
        if (d.extraTrain && d.train) r += ` You've also added ${d.train.session.name}.`;
        return r;
      }
      case 'train': {
        if (!d.train) return 'Training day.';
        if (d.train.type === 'home') return 'No gym access, so it’s the home workout instead of ' + (d.forcedTrain ? 'lifting.' : 'a lift session.');
        let r = d.forcedTrain ? `You chose to train, so it's ${d.train.session.name}.` : `No Muay Thai or grappling, so it's ${d.train.session.name} (${d.train.session.focus}).`;
        if (ctx.deload) r += ' Deload week: about a third less volume.';
        return r;
      }
      case 'rest': {
        if (d.forcedRest) return 'You set this as a rest day.';
        if (y && y.hardest && (y.isCombat)) return `Recovery after ${DAY_NAMES[y.wd]}'s hardest session.`;
        if ((y && y.isTrain) || (t && t.isTrain)) return 'Keeps a day between lifting sessions (full-body lifting needs about 48 hours).';
        if (ctx.trainTotal >= ctx.liftMax) return `Lifting is capped at ${ctx.liftMax} sessions a week, so this one is rest.`;
        return `One of this week's ${ctx.restMin} rest days.`;
      }
    }
    return '';
  }

  // Plan this week and the next few, carrying the A/B/C rotation forward.
  function planWeeks(state, data, fromDate, count, now) {
    now = now || today();
    const out = [];
    let rot = null;
    let start = weekStart(fromDate);
    // If planning a future week, walk forward from this week so the rotation lines up.
    const thisStart = weekStart(now);
    if (start > thisStart) {
      let s = thisStart;
      while (s < start) { const w = planWeek(state, data, s, now, rot); rot = w.rotEnd; s = addDays(s, 7); }
    }
    for (let k = 0; k < count; k++) {
      const w = planWeek(state, data, start, now, start >= thisStart ? rot : null);
      out.push(w);
      rot = w.rotEnd;
      start = addDays(start, 7);
    }
    return out;
  }

  // ---------- lifting ----------
  function roundTo(x, step) { return Math.round(x / step) * step; }
  function epley(w, r) {
    w = +w; r = +r;
    if (!(w > 0) || !(r >= 1) || r > 10) return null;
    return r === 1 ? w : w * (1 + r / 30);
  }
  function repRange(slot) { return Array.isArray(slot.reps) ? slot.reps : [slot.reps, slot.reps]; }
  function fmtKg(w) { return (Math.round(w * 100) / 100).toString(); }
  function fmtSets(sets) {
    if (!sets.length) return '';
    const ws = sets.map(x => +x.w || 0), rs = sets.map(x => +x.r || 0);
    const noW = sets.every(x => x.w === null || x.w === '' || x.w === undefined);
    const sameR = rs.every(r => r === rs[0]);
    if (noW) return sameR ? `${sets.length} × ${rs[0]}` : rs.join(', ') + ' reps';
    if (ws.every(w => w === ws[0])) {
      const at = ws[0] === 0 ? 'bodyweight' : `${fmtKg(ws[0])} kg`;
      return sameR ? `${sets.length} × ${rs[0]} at ${at}` : `${rs.join(', ')} reps at ${at}`;
    }
    return sets.map(x => `${fmtKg(+x.w || 0)}×${+x.r || 0}`).join(', ') + ' kg';
  }

  // Done sets of one exercise variant across lift sessions, newest first.
  function exHistory(state, exId, beforeDate, excludeId) {
    const out = [];
    for (const s of state.sessions) {
      if (s.type !== 'lift' || !s.data || !Array.isArray(s.data.exercises)) continue;
      if (excludeId && s.id === excludeId) continue;
      if (beforeDate && s.date > beforeDate) continue;
      for (const e of s.data.exercises) {
        const sets = (e.sets || []).filter(x => x.done);
        if (e.id === exId && sets.length) out.push({ date: s.date, ts: s.ts || 0, sets, target: e.target || {} });
      }
    }
    return out.sort(byNewest);
  }

  function sessionHit(h, slot) {
    const [lo, hi] = h.target.reps || repRange(slot);
    const planned = h.target.sets || slot.sets;
    const top = Math.max(...h.sets.map(x => +x.w || 0));
    const atTop = h.sets.filter(x => (+x.w || 0) === top);
    return { top, all: atTop.length >= planned && atTop.every(x => (+x.r || 0) >= hi), floor: atTop.every(x => (+x.r || 0) >= lo) };
  }

  // Suggested weight and reps for one exercise option, with the reason.
  function suggest(state, slot, opt, ctx) {
    const [lo, hi] = repRange(slot);
    const inc = opt.inc != null ? opt.inc : (slot.inc != null ? slot.inc : 2.5);
    const step = slot.lift ? 2.5 : Math.min(2.5, inc || 2.5);
    const hist = exHistory(state, opt.id, ctx.date, ctx.excludeId);
    const repTxt = lo === hi ? `${hi}` : `${lo}–${hi}`;

    if (opt.noWeight) {
      if (!hist.length) return { w: null, reps: lo, why: `Aim for ${repTxt} reps per set.` };
      return { w: null, reps: lo, why: `Last time: ${fmtSets(hist[0].sets)}. Aim for ${hi} on every set.` };
    }
    if (!hist.length) {
      const e1 = slot.lift && ctx.e1rm ? +ctx.e1rm[slot.lift] : 0;
      if (e1 > 0) {
        const w = Math.max(20, roundTo(e1 / (1 + hi / 30) * 0.9, 2.5));
        return { w, reps: lo, first: true, why: `First session: about 90% of the ${hi}-rep weight your ${fmtKg(e1)} kg estimated 1RM implies, so the lift is re-earned rather than assumed (section 2).` };
      }
      if (opt.bw) return { w: 0, reps: lo, first: true, why: `Start at bodyweight (0 kg added). Add weight once every set reaches ${hi} reps.` + (opt.hint ? ' ' + opt.hint : '') };
      return { w: null, reps: lo, first: true, why: 'First time: pick a weight you could lift for 2–3 more reps than the target.' + (opt.hint ? ' ' + opt.hint : '') };
    }
    const last = hist[0];
    const h = sessionHit(last, slot);
    const lastTxt = fmtSets(last.sets);
    if (last.target.deload) return { w: h.top, reps: lo, why: `Back from the deload: repeat ${fmtKg(h.top)} kg.` };
    if (h.all) return { w: h.top + inc, reps: lo, why: `Last time ${lastTxt}: every set reached ${hi}. Add ${fmtKg(inc)} kg.` };
    let stalls = 0;
    for (const x of hist) {
      const hx = sessionHit(x, slot);
      if (hx.top !== h.top || hx.all || x.target.deload) break;
      if (lo === hi || !hx.floor) stalls++; else break;
    }
    if (stalls >= 2 && h.top > 0) {
      const w = roundTo(h.top * 0.9, step);
      return { w, reps: lo, why: `Stalled at ${fmtKg(h.top)} kg two sessions running. Back off about 10% to ${fmtKg(w)} kg and re-ramp (section 5).` };
    }
    if (lo < hi && h.floor) return { w: h.top, reps: lo, why: `Last time ${lastTxt}. Same weight; build every set to ${hi} reps.` };
    return { w: h.top, reps: lo, why: `Last time ${lastTxt}: short of the target. Repeat ${fmtKg(h.top)} kg.` };
  }

  // Per-lift history for the progress screen: one point per session.
  function liftSeries(state, liftId) {
    const pts = [];
    for (const s of state.sessions) {
      if (s.type !== 'lift' || !s.data || !Array.isArray(s.data.exercises)) continue;
      for (const e of s.data.exercises) {
        if (e.id !== liftId) continue;
        const sets = (e.sets || []).filter(x => x.done && +x.w > 0 && +x.r > 0);
        if (!sets.length) continue;
        const five = sets.filter(x => +x.r >= 5).map(x => +x.w);
        const e1 = Math.max(...sets.map(x => epley(x.w, x.r) || 0));
        pts.push({ date: s.date, ts: s.ts || 0, work: Math.max(...sets.map(x => +x.w)), five: five.length ? Math.max(...five) : null, e1rm: e1 || null, sets });
      }
    }
    return pts.sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);
  }

  window.ETP = {
    TYPES, COMBAT, TRAIN, MAIN, DAY_NAMES, DAY_SHORT, LB,
    iso, parse, addDays, weekday, weekStart, today, daysBetween,
    sessionsOn, plannedCombat, gymOn, rotationNext, planWeek, planWeeks, scoreWeek,
    roundTo, epley, repRange, fmtKg, fmtSets, exHistory, suggest, liftSeries, namesOf
  };
})();
