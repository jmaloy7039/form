/* Form — a sparkly, seriously fast lifting log */
'use strict';

// ---------------------------------------------------------------- utilities
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pad2 = (n) => String(n).padStart(2, '0');
const todayKey = (d) => {
  d = d || new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
// Monday-based week key
const weekKey = (d) => {
  d = new Date(d);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return todayKey(d);
};
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const fmtClock = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const uid = () => 'x' + Math.random().toString(36).slice(2, 9);

// ---------------------------------------------------------------- state
const STORE_KEY = 'form.v1';

const defaultState = () => ({
  version: 2,
  settings: { unit: 'lb', restSec: 90, sound: true },
  custom: [],
  templates: DEFAULT_TEMPLATES.map(t => ({ ...t, exerciseIds: [...t.exerciseIds] })),
  plans: [],           // [{id, date:'YYYY-MM-DD', name, exerciseIds}] — unlimited upcoming workouts
  renames: {},         // {exerciseId: customDisplayName} for built-in library exercises
  workouts: [],        // {id, date, name, durationSec, entries:[{exId, sets:[{w,r,rpe}], note}]}
  active: null,        // {name, startedAt, cur, planId, exs:[{exId, sets, note, target}]}
  sugDismissed: null,
});

// migrate older saves / backups in place (v1 had a single `plan`)
function normalizeState(s) {
  const out = Object.assign(defaultState(), s);
  if (s && s.plan && typeof s.plan === 'object') {
    out.plans = (Array.isArray(s.plans) ? s.plans : []).concat([{ id: uid(), ...s.plan }]);
  }
  if (!Array.isArray(out.plans)) out.plans = [];
  if (!out.renames || typeof out.renames !== 'object') out.renames = {};
  delete out.plan;
  out.version = 2;
  return out;
}

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.warn('Form: could not read saved data', e);
    return defaultState();
  }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }

// UI-only state (not persisted)
const ui = {
  tab: 'today', page: null,          // page: settings|plan|templates|customex
  coachMus: 'glutes', chartEx: null,
  stageW: null, stageR: null, rpeSel: null, stageKey: '',
  restEnd: null, restTotal: 0, restDone: false,
  planDraft: null, planFrom: null,
  pickSearch: '', pickMus: null, pickCtx: null, // pickCtx: 'plan'|'active'
};

// ---------------------------------------------------------------- exercise helpers
// renames apply here so every list, chip, chart, and history entry shows her name for the lift
const allExercises = () => EXERCISES.concat(S.custom)
  .map(e => S.renames[e.id] ? { ...e, name: S.renames[e.id] } : e);
const exById = (id) => allExercises().find(e => e.id === id) ||
  { id, name: '(deleted exercise)', eq: '', p: [], s: [] };
const baseNameOf = (id) => { const b = EXERCISES.find(e => e.id === id); return b ? b.name : null; };
const musName = (id) => (MUSCLES.find(m => m.id === id) || { name: id }).name;

function lastSessionFor(exId) {
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const entry = S.workouts[i].entries.find(en => en.exId === exId && en.sets.length);
    if (entry) return { workout: S.workouts[i], entry };
  }
  return null;
}
function maxWeightFor(exId, beforeWorkoutId) {
  let max = null;
  for (const w of S.workouts) {
    if (beforeWorkoutId && w.id === beforeWorkoutId) break;
    for (const en of w.entries) {
      if (en.exId !== exId) continue;
      for (const st of en.sets) if (st.r >= 1 && (max === null || st.w > max)) max = st.w;
    }
  }
  return max;
}
function sessionsFor(exId) {
  const out = [];
  for (const w of S.workouts) {
    const en = w.entries.find(e => e.exId === exId && e.sets.length);
    if (en) {
      const top = Math.max(...en.sets.filter(s => s.r >= 1).map(s => s.w), 0);
      out.push({ date: w.date, top });
    }
  }
  return out;
}
// sets per muscle (primary) in the last `days`
function setsByMuscle(days) {
  const cutoff = daysAgo(days).getTime();
  const counts = {};
  for (const w of S.workouts) {
    if (new Date(w.date).getTime() < cutoff) continue;
    for (const en of w.entries) {
      const ex = exById(en.exId);
      for (const m of ex.p) counts[m] = (counts[m] || 0) + en.sets.length;
    }
  }
  return counts;
}
function streakWeeks() {
  const weeks = new Set(S.workouts.map(w => weekKey(w.date)));
  let count = 0;
  let cursor = new Date();
  if (!weeks.has(weekKey(cursor))) cursor.setDate(cursor.getDate() - 7); // this week not started yet — don't break streak
  while (weeks.has(weekKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 7); }
  return count;
}
const workoutsThisWeek = () => S.workouts.filter(w => weekKey(w.date) === weekKey(new Date())).length;
const workoutToday = () => S.workouts.find(w => todayKey(new Date(w.date)) === todayKey());

// ---------------------------------------------------------------- plans (multi-day queue)
const plansSorted = () => [...S.plans].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
// the plan that's "up next": earliest one dated today or earlier
const nextUpPlan = () => plansSorted().find(p => p.date <= todayKey()) || null;
const planById = (id) => S.plans.find(p => p.id === id) || null;
function todayPlanOrNew() {
  let p = S.plans.find(x => x.date === todayKey());
  if (!p) { p = { id: uid(), date: todayKey(), name: 'My Workout', exerciseIds: [] }; S.plans.push(p); }
  return p;
}
function dateLabel(dstr) {
  const t = todayKey();
  if (dstr === t) return 'Today';
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (dstr === todayKey(tomorrow)) return 'Tomorrow';
  const d = new Date(dstr + 'T12:00:00');
  const lbl = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return dstr < t ? `was ${lbl}` : lbl;
}

// ---------------------------------------------------------------- units
// All weights are STORED in lb; the unit setting only changes display & step size.
const LB_PER_KG = 2.20462262;
const isKg = () => S.settings.unit === 'kg';
const unitLabel = () => S.settings.unit;
const weightStep = () => (isKg() ? 2.5 : 5);              // in display units
const stepInternal = () => (isKg() ? 2.5 * LB_PER_KG : 5); // in stored lb
const dispW = (lb) => (isKg() ? Math.round(lb / LB_PER_KG * 2) / 2 : Math.round(lb * 2) / 2);
const fmtW = (w) => (w % 1 === 0 ? String(w) : w.toFixed(1));
const showW = (lb) => fmtW(dispW(lb));

// ---------------------------------------------------------------- coaching rules
function suggestionForToday() {
  if (S.sugDismissed === todayKey() || workoutToday()) return null;
  const week = setsByMuscle(7);
  const month = setsByMuscle(28);
  const trained = Object.keys(month);
  if (!trained.length) return null;
  const ranked = trained.map(m => ({ m, sets: week[m] || 0 })).sort((a, b) => a.sets - b.sets);
  const low = ranked.find(r => r.sets < 6);
  if (!low) return null;
  const tp = S.plans.find(p => p.date === todayKey());
  const planIds = new Set((tp && tp.exerciseIds) || []);
  const ex = allExercises().find(e => e.p.includes(low.m) && !planIds.has(e.id));
  if (!ex) return null;
  return { muscle: low.m, ex, sets: low.sets };
}

function coachRecs(mus) {
  const withHistory = [];
  const fresh = [];
  for (const ex of allExercises()) {
    if (!ex.p.includes(mus)) continue;
    (lastSessionFor(ex.id) ? withHistory : fresh).push(ex);
  }
  return withHistory.concat(fresh).slice(0, 5);
}

function coachInsights() {
  const out = [];
  // 1. undertrained muscle
  const week = setsByMuscle(7);
  const month = setsByMuscle(28);
  const trained = Object.keys(month);
  if (trained.length >= 2) {
    const ranked = trained.map(m => ({ m, sets: week[m] || 0 })).sort((a, b) => a.sets - b.sets);
    const low = ranked[0];
    if (low && low.sets < 6) {
      const ex = allExercises().find(e => e.p.includes(low.m));
      out.push({
        text: `💡 ${musName(low.m)} got <b>${low.sets} ${low.sets === 1 ? 'set' : 'sets'}</b> this week — most plans hit 8+. ${ex ? `Add ${esc(ex.name)} to a workout?` : ''}`,
        action: ex ? { label: '+ Add it', act: 'insight-add', ex: ex.id } : null,
      });
    }
  }
  // 2. plateau: same top weight 3+ sessions in a row
  const seen = new Set();
  for (let i = S.workouts.length - 1; i >= 0 && out.length < 3; i--) {
    for (const en of S.workouts[i].entries) {
      if (seen.has(en.exId)) continue;
      seen.add(en.exId);
      const sess = sessionsFor(en.exId);
      if (sess.length >= 3) {
        const last3 = sess.slice(-3);
        if (last3.every(s => s.top === last3[0].top) && last3[0].top > 0) {
          out.push({ text: `📊 <b>${esc(exById(en.exId).name)}</b> has sat at ${showW(last3[0].top)} ${unitLabel()} for ${sess.length >= 4 ? '4+' : '3'} sessions — try one extra rep per set, then bump the weight.` });
        }
      }
    }
  }
  // 3. overload nudge: last 2 sessions all-easy
  const seen2 = new Set();
  for (let i = S.workouts.length - 1; i >= 0 && out.length < 3; i--) {
    for (const en of S.workouts[i].entries) {
      if (seen2.has(en.exId)) continue;
      seen2.add(en.exId);
      const sess = [];
      for (const w of S.workouts) {
        const e2 = w.entries.find(x => x.exId === en.exId && x.sets.length);
        if (e2) sess.push(e2);
      }
      const last2 = sess.slice(-2);
      if (last2.length === 2 && last2.every(e2 => e2.sets.length && e2.sets.every(s => s.rpe === 1))) {
        out.push({ text: `🪶 <b>${esc(exById(en.exId).name)}</b> felt easy two sessions running — you've earned a +${weightStep()} ${unitLabel()} jump next time.` });
      }
    }
  }
  return out.slice(0, 3);
}

// PRs achieved in a finished workout
function detectPRs(active) {
  const prs = [];
  for (const en of active.exs) {
    const tops = en.sets.filter(s => s.r >= 1).map(s => s.w);
    if (!tops.length) continue;
    const top = Math.max(...tops);
    const prev = maxWeightFor(en.exId, null); // workouts saved so far exclude this one
    if (prev !== null && top > prev) prs.push({ exId: en.exId, top, prev });
    else if (prev === null && top > 0) prs.push({ exId: en.exId, top, prev: null });
  }
  return prs;
}
function latestPREvent() {
  const best = {};
  let latest = null;
  for (const w of S.workouts) {
    for (const en of w.entries) {
      const tops = en.sets.filter(s => s.r >= 1).map(s => s.w);
      if (!tops.length) continue;
      const top = Math.max(...tops);
      const reps = en.sets.find(s => s.w === top).r;
      if (best[en.exId] !== undefined && top > best[en.exId]) {
        latest = { exId: en.exId, top, reps, date: w.date, gain: top - best[en.exId] };
      }
      if (best[en.exId] === undefined || top > best[en.exId]) best[en.exId] = top;
    }
  }
  return latest;
}

// ---------------------------------------------------------------- render root
function render() {
  const view = $('#view');
  const pages = { settings: renderSettings, plan: renderPlanEdit, templates: renderTemplates, customex: renderCustomEx };
  if (ui.page && pages[ui.page]) {
    view.innerHTML = pages[ui.page]();
    $('#tabbar').classList.add('hidden');
  } else {
    const tabs = { today: renderToday, lift: renderLift, progress: renderProgress, coach: renderCoach };
    view.innerHTML = tabs[ui.tab]();
    $('#tabbar').classList.remove('hidden');
    $$('#tabbar .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === ui.tab));
  }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- Today
function renderToday() {
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const streak = streakWeeks();
  const wk = workoutsThisWeek();
  let html = `
    <div class="screen-title">
      <div><h1>Today</h1><div class="date">${esc(dateStr)}</div></div>
      <button class="iconbtn" data-action="open-settings" aria-label="Settings">⚙️</button>
    </div>
    <div class="streakrow">
      ${streak ? `<b>🔥 ${streak}-week streak</b>` : ''}
      <b>💪 ${wk} ${wk === 1 ? 'workout' : 'workouts'} this week</b>
    </div>`;

  const done = workoutToday();
  const nextUp = nextUpPlan();
  if (S.active) {
    html += `<div class="card">
      <div class="rowline"><span style="font-family:var(--disp); font-size:18px; font-weight:600">Workout in progress 🏋️</span></div>
      <div class="planpreview">${esc(S.active.name)} · ${S.active.exs.reduce((n, e) => n + e.sets.length, 0)} sets logged</div>
      <button class="btn-primary" style="margin-top:12px" data-action="tab" data-tab="lift">Resume ✦</button>
    </div>`;
  } else if (done) {
    html += `<div class="donebanner"><h3>Done today: ${esc(done.name)} ✓</h3><p>${done.entries.reduce((n, e) => n + e.sets.length, 0)} sets · nice work 💗</p></div>`;
  }

  if (!S.active) {
    if (nextUp && nextUp.exerciseIds.length) {
      const muscles = [...new Set(nextUp.exerciseIds.flatMap(id => exById(id).p))];
      const old = nextUp.date < todayKey();
      html += `<div class="card">
        <div class="rowline"><span style="font-family:var(--disp); font-size:18px; font-weight:600">${old ? 'Up next' : 'Today'}: ${esc(nextUp.name)} 💗</span>
        <span class="minutes">~${nextUp.exerciseIds.length * 9} MIN</span></div>
        ${old ? `<div class="minutes" style="margin-top:3px">PLANNED ${esc(dateLabel(nextUp.date).toUpperCase())}</div>` : ''}
        <div class="chips" style="margin-top:8px">${muscles.slice(0, 4).map((m, i) => `<span class="chip${i > 1 ? ' sec' : ''}">${esc(musName(m).toUpperCase())}</span>`).join('')}</div>
        <div class="planpreview">${nextUp.exerciseIds.map(id => esc(exById(id).name)).join(' · ')}</div>
        <button class="btn-primary" style="margin-top:12px" data-action="start-plan">Start Workout ✦</button>
        <button class="btn-ghost" style="margin-top:8px" data-action="edit-plan" data-id="${nextUp.id}">Edit plan</button>
      </div>`;
    } else if (!done) {
      html += `<div class="card">
        <div style="font-family:var(--disp); font-size:18px; font-weight:600">No plan yet</div>
        <div class="planpreview">Build today's workout ahead of time, or quick-start below.</div>
        <button class="btn-ghost" style="margin-top:12px" data-action="edit-plan">Build today's workout</button>
      </div>`;
    }

    const sug = suggestionForToday();
    if (sug) {
      html += `<div class="sugg">
        <p>✨ ${esc(musName(sug.muscle))} ${musName(sug.muscle).endsWith('s') ? (sug.sets ? 'are light' : 'have no sets') : (sug.sets ? 'is light' : 'has no sets')} this week — add <b>${esc(sug.ex.name)}</b> today?</p>
        <div class="btns">
          <button class="btn-lilac" data-action="sug-add" data-ex="${sug.ex.id}">+ Add it</button>
          <button class="btn-lilac outline" data-action="sug-skip">No thanks</button>
        </div>
      </div>`;
    }
  }

  // Upcoming plans — always visible (even mid-workout) so she can plan ahead any time
  const upcoming = plansSorted().filter(p => !(!S.active && nextUp && p.id === nextUp.id));
  if (upcoming.length) {
    html += `<div class="seclab">UPCOMING</div>
      <div class="sgroup">
        ${upcoming.map(p => `
          <div class="srow">
            <button class="srow-btn" data-action="edit-plan" data-id="${p.id}" style="flex:1; padding:0">
              <span>${esc(p.name)} <span style="color:var(--pink-text)">· ${esc(dateLabel(p.date))}</span>
              <span class="hint">${p.exerciseIds.length ? p.exerciseIds.map(id => esc(exById(id).name)).join(' · ') : 'empty — tap to build'}</span></span>
            </button>
            <button style="font-size:15px; color:var(--purple-text); padding:4px 2px" data-action="del-plan" data-id="${p.id}" aria-label="Delete ${esc(p.name)}">✕</button>
          </div>`).join('')}
      </div>`;
  }
  html += `<button class="btn-ghost" data-action="new-plan">+ Plan a workout</button>`;

  if (!S.active) {
    html += `<div class="seclab">QUICK START</div>
      <div class="qstart">
        ${S.templates.map(t => `<button data-action="start-template" data-id="${t.id}">${esc(t.name)}</button>`).join('')}
        <button class="dash" data-action="start-empty">+ Empty workout</button>
      </div>`;
  }
  return html;
}

// ---------------------------------------------------------------- Lift
function renderLift() {
  if (!S.active) {
    return `
      <div class="screen-title"><div><h1>Lift</h1></div></div>
      <div class="empty-note">No workout running.<br>Start one from Today 🌞 — or dive right in:</div>
      ${(() => { const p = nextUpPlan(); return p && p.exerciseIds.length
        ? `<button class="btn-primary" data-action="start-plan">Start ${esc(p.name)} ✦</button>`
        : `<button class="btn-primary" data-action="start-empty">Start an empty workout ✦</button>`; })()}
      <div class="qstart" style="justify-content:center">
        ${S.templates.map(t => `<button data-action="start-template" data-id="${t.id}">${esc(t.name)}</button>`).join('')}
      </div>`;
  }
  const a = S.active;
  if (!a.exs.length) {
    return `
      ${liftHeader(a)}
      <div class="empty-note">Freestyle mode — add your first exercise 💗</div>
      <button class="btn-primary" data-action="add-exercise">+ Add exercise</button>`;
  }
  const en = a.exs[a.cur];
  const ex = exById(en.exId);
  stageDefaults(en);
  const setNo = en.sets.length + 1;
  const chips = [];
  en.sets.forEach(s => { chips.push(`<i>✓ ${showW(s.w)}×${s.r}</i>`); });
  chips.push(`<i class="cur">Set ${setNo}</i>`);
  for (let i = setNo; i < en.target; i++) chips.push(`<i class="todo">Set ${i + 1}</i>`);

  const restActive = ui.restEnd && !ui.restDone;
  return `
    ${liftHeader(a)}
    <div class="exdots">${a.exs.map((e, i) => `<i class="${i === a.cur ? 'cur' : (e.sets.length >= e.target ? 'done' : '')}"></i>`).join('')}</div>
    <div class="card">
      <div class="rowline">
        <span class="exname-row">
          <span class="name">${esc(ex.name)}</span>
          <button class="notebtn ${en.note ? 'has' : ''}" data-action="open-notes" aria-label="Exercise notes">📝</button>
        </span>
        <span style="display:flex; gap:6px">
          <button class="swapbtn" data-action="open-swap">↻ Swap</button>
          <button class="swapbtn" data-action="remove-ex" aria-label="Remove exercise" style="padding:6px 10px">✕</button>
        </span>
      </div>
      <div class="chips" style="margin-top:7px">
        ${ex.p.map(m => `<span class="chip">${esc(musName(m).toUpperCase())}</span>`).join('')}
        ${ex.s.map(m => `<span class="chip sec">${esc(musName(m).toUpperCase())}</span>`).join('')}
      </div>
      <div class="setchips">${chips.join('')}</div>
    </div>
    <div class="steppers">
      <div class="step"><div class="lab">WEIGHT</div>
        <div class="row">
          <button class="roundbtn" data-action="stage" data-f="w" data-d="-1">−</button>
          <span class="val" id="stage-w">${showW(ui.stageW)}<small>${unitLabel()}</small></span>
          <button class="roundbtn" data-action="stage" data-f="w" data-d="1">+</button>
        </div>
      </div>
      <div class="step"><div class="lab">REPS</div>
        <div class="row">
          <button class="roundbtn" data-action="stage" data-f="r" data-d="-1">−</button>
          <span class="val" id="stage-r">${ui.stageR}</span>
          <button class="roundbtn" data-action="stage" data-f="r" data-d="1">+</button>
        </div>
      </div>
    </div>
    <div class="rpe">
      <span class="q">HOW'D IT FEEL?</span>
      <span class="opts">
        <button class="${ui.rpeSel === 1 ? 'sel' : ''}" data-action="rpe" data-v="1" aria-label="Too easy">🪶</button>
        <button class="${ui.rpeSel === 2 ? 'sel' : ''}" data-action="rpe" data-v="2" aria-label="Solid">💪</button>
        <button class="${ui.rpeSel === 3 ? 'sel' : ''}" data-action="rpe" data-v="3" aria-label="Grind">🥵</button>
      </span>
    </div>
    <button class="btn-primary" data-action="log-set">Log Set ${setNo} ✦</button>
    <button class="restbar ${ui.restDone ? 'ding' : ''}" data-action="rest-tap" ${restActive || ui.restDone ? '' : 'style="opacity:.55"'}>
      <span class="fill" id="rest-fill" style="transform:scaleX(${restActive ? 1 : 0})"></span>
      <span>${ui.restDone ? 'Rest done — go! ✦' : 'Rest timer'}</span>
      <b id="rest-time">${restActive ? fmtClock((ui.restEnd - Date.now()) / 1000) : fmtClock(S.settings.restSec)}${restActive ? '' : ' ▶'}</b>
    </button>
    <div class="liftfoot">
      <button class="btn-ghost" data-action="prev-ex" ${a.cur === 0 ? 'disabled style="opacity:.4"' : ''}>‹ Prev</button>
      <button class="btn-ghost" data-action="next-ex" ${a.cur >= a.exs.length - 1 ? 'disabled style="opacity:.4"' : ''}>Next ›</button>
    </div>
    <button class="btn-ghost" data-action="add-exercise">+ Add exercise</button>`;
}
function liftHeader(a) {
  return `<div class="lifthead">
    <span class="wname">${esc(a.name)} 💗</span>
    <span class="side">
      <span class="elapsed" id="elapsed">${fmtClock((Date.now() - a.startedAt) / 1000)}</span>
      <button class="finishbtn" data-action="finish">Finish ✓</button>
    </span>
  </div>`;
}
// stage (pending set) defaults from last session / previous set
function stageDefaults(en) {
  const key = `${en.exId}#${en.sets.length}`;
  if (ui.stageKey === key && ui.stageW != null) return;
  ui.stageKey = key;
  const idx = en.sets.length;
  if (en.sets.length) {
    const last = en.sets[en.sets.length - 1];
    ui.stageW = last.w; ui.stageR = last.r;
  } else {
    const prev = lastSessionFor(en.exId);
    if (prev) {
      const s = prev.entry.sets[Math.min(idx, prev.entry.sets.length - 1)];
      ui.stageW = s.w; ui.stageR = s.r;
    } else { ui.stageW = 0; ui.stageR = 10; }
  }
  ui.rpeSel = null;
}

// ---------------------------------------------------------------- Progress
function renderProgress() {
  if (!S.workouts.length) {
    return `<div class="screen-title"><div><h1>Progress</h1></div></div>
      <div class="empty-note">Log your first workout and this fills up with PRs, charts, and muscle balance 💗</div>`;
  }
  const pr = latestPREvent();
  const exWithHistory = [...new Set(S.workouts.flatMap(w => w.entries.filter(e => e.sets.length).map(e => e.exId)))];
  if (!ui.chartEx || !exWithHistory.includes(ui.chartEx)) {
    ui.chartEx = exWithHistory
      .map(id => ({ id, n: sessionsFor(id).length }))
      .sort((a, b) => b.n - a.n)[0].id;
  }
  const week = setsByMuscle(7);
  const monthMus = Object.keys(setsByMuscle(28));
  const rows = monthMus.map(m => ({ m, sets: week[m] || 0 })).sort((a, b) => b.sets - a.sets);
  const maxSets = Math.max(...rows.map(r => r.sets), 1);

  // PR wall
  const wall = exWithHistory.map(id => {
    let top = null, when = null;
    for (const w of S.workouts) {
      const en = w.entries.find(e => e.exId === id);
      if (!en) continue;
      for (const st of en.sets) if (st.r >= 1 && (top === null || st.w >= top)) { top = st.w; when = w.date; }
    }
    return { id, top, when };
  }).filter(r => r.top !== null && r.top > 0)
    .sort((a, b) => new Date(b.when) - new Date(a.when));

  return `
    <div class="screen-title"><div><h1>Progress</h1></div></div>
    ${pr ? `<div class="prbanner"><h3>✦ ${pr.gain ? 'New PR!' : 'New best!'} ${esc(exById(pr.exId).name)} — ${showW(pr.top)} ${unitLabel()} × ${pr.reps}</h3>
      <p>${esc(new Date(pr.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }))}${pr.gain ? ` · +${showW(pr.gain)} ${unitLabel()} over your old best` : ''}</p></div>` : ''}
    <div class="card">
      <div class="chart-head">
        <select data-action-change="chart-ex" aria-label="Choose exercise">
          ${exWithHistory.map(id => `<option value="${id}" ${id === ui.chartEx ? 'selected' : ''}>${esc(exById(id).name)}</option>`).join('')}
        </select>
        <span class="range">TOP SET</span>
      </div>
      ${chartSVG(ui.chartEx)}
    </div>
    <div class="card">
      <div style="font-family:var(--disp); font-size:15px; font-weight:600">Sets this week, by muscle</div>
      <div class="bars">
        ${rows.map(r => {
          const low = r.sets < 6 && r.sets < maxSets;
          return `<div class="bar ${low ? 'low' : ''}"><span>${esc(musName(r.m))}</span>
            <div class="track"><i style="width:${Math.round(100 * r.sets / maxSets)}%"></i></div>
            <em>${r.sets}</em>${low ? '<span class="lowtag">LOW</span>' : ''}</div>`;
        }).join('')}
      </div>
    </div>
    <div class="card">
      <div style="font-family:var(--disp); font-size:15px; font-weight:600">PR wall 🏆</div>
      <div class="prwall">
        ${wall.slice(0, 10).map(r => `<div class="prrow"><b>${esc(exById(r.id).name)}</b>
          <span><span class="val">${showW(r.top)} ${unitLabel()}</span><span class="when">${esc(fmtDate(r.when))}</span></span></div>`).join('')}
      </div>
    </div>`;
}
function chartSVG(exId) {
  const sess = sessionsFor(exId);
  if (sess.length < 2) return `<div class="empty-note" style="padding:12px">Two or more sessions of this lift and a trend line appears ✨</div>`;
  const pts = sess.slice(-12);
  const W = 300, H = 110, padX = 8, padTop = 18, padBot = 14;
  const min = Math.min(...pts.map(p => p.top)), max = Math.max(...pts.map(p => p.top));
  const span = (max - min) || 1;
  const x = (i) => padX + i * (W - 2 * padX) / (pts.length - 1);
  const y = (v) => padTop + (H - padTop - padBot) * (1 - (v - min) / span);
  const poly = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.top).toFixed(1)}`).join(' ');
  const lastX = x(pts.length - 1), lastY = y(pts[pts.length - 1].top);
  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%; display:block; margin-top:6px" role="img" aria-label="Top set weight trend">
      ${[0.25, 0.55, 0.85].map(f => `<line x1="0" y1="${(H * f).toFixed(0)}" x2="${W}" y2="${(H * f).toFixed(0)}" stroke="#F9E2EF" stroke-width="1"/>`).join('')}
      <polygon points="${poly} ${lastX.toFixed(1)},${H - 2} ${x(0).toFixed(1)},${H - 2}" fill="rgba(255,46,147,.10)"/>
      <polyline points="${poly}" fill="none" stroke="#FF2E93" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastX}" cy="${lastY}" r="6" fill="rgba(255,46,147,.25)"/>
      <circle cx="${lastX}" cy="${lastY}" r="3.2" fill="#FF2E93"/>
      <text x="${Math.min(lastX, W - 44)}" y="${Math.max(lastY - 9, 10)}" font-size="10" font-weight="800" fill="#C81D6F">${showW(pts[pts.length - 1].top)} ${unitLabel()}</text>
    </svg>
    <div class="axis"><span>${fmtDate(pts[0].date).toUpperCase()}</span><span>${fmtDate(pts[pts.length - 1].date).toUpperCase()}</span></div>`;
}

// ---------------------------------------------------------------- Coach
function renderCoach() {
  const recs = coachRecs(ui.coachMus);
  const insights = coachInsights();
  return `
    <div class="screen-title"><div><h1>Coach</h1></div></div>
    <div class="seclab">WHAT DO YOU WANT TO GROW?</div>
    <div class="musgrid">
      ${MUSCLES.map(m => `<button class="${ui.coachMus === m.id ? 'sel' : ''}" data-action="coach-mus" data-m="${m.id}">${esc(m.name)}</button>`).join('')}
    </div>
    <div class="card">
      <div style="font-family:var(--disp); font-size:16px; font-weight:600; margin-bottom:2px">Best moves for ${esc(musName(ui.coachMus).toLowerCase())}</div>
      ${recs.map((ex, i) => `<div class="exrec"><span class="n">${i + 1}</span>
        <div style="flex:1"><div class="xn">${esc(ex.name)}</div>
        <div class="xw">${esc(ex.why || defaultWhy(ex))}${lastSessionFor(ex.id) ? ' You already train this — keep building.' : ''}</div></div>
        <button class="addone" data-action="coach-add" data-ex="${ex.id}" aria-label="Add ${esc(ex.name)} to today's plan">+</button>
      </div>`).join('')}
    </div>
    ${insights.map(ins => `<div class="insight">${ins.text}
      ${ins.action ? `<div class="btns"><button class="btn-lilac" data-action="${ins.action.act}" data-ex="${ins.action.ex}">${esc(ins.action.label)}</button></div>` : ''}
    </div>`).join('')}
    ${!S.workouts.length ? '<div class="empty-note">Coaching gets personal once there\'s a workout or two in the books 💗</div>' : ''}`;
}
function defaultWhy(ex) {
  return `Solid ${musName(ex.p[0]).toLowerCase()} work on the ${(EQUIPMENT_NAMES[ex.eq] || ex.eq).toLowerCase()}.`;
}

// ---------------------------------------------------------------- Settings & pages
function renderSettings() {
  const st = S.settings;
  return `
    <div class="backrow"><button class="backbtn" data-action="close-page">‹ Today</button><h1>Settings</h1></div>
    <div class="seclab">PREFERENCES</div>
    <div class="sgroup">
      <div class="srow"><span>Units</span>
        <span class="seg">
          <button class="${!isKg() ? 'on' : ''}" data-action="unit" data-u="lb">lb</button>
          <button class="${isKg() ? 'on' : ''}" data-action="unit" data-u="kg">kg</button>
        </span></div>
      <div class="srow"><span>Rest timer default</span>
        <span class="tstep">
          <button class="roundbtn" data-action="rest-default" data-d="-15">−</button>
          <em>${fmtClock(st.restSec)}</em>
          <button class="roundbtn" data-action="rest-default" data-d="15">+</button>
        </span></div>
      <div class="srow"><span>Timer sound &amp; buzz<span class="hint">Chime + vibrate when rest ends</span></span>
        <button class="toggle ${st.sound ? 'on' : ''}" data-action="toggle-sound" aria-label="Timer sound"></button></div>
    </div>
    <div class="seclab">MY LIBRARY</div>
    <div class="sgroup">
      <button class="srow srow-btn" data-action="open-customex"><span>Custom exercises</span><span><span class="cnt">${S.custom.length}</span><span class="chev">›</span></span></button>
      <button class="srow srow-btn" data-action="open-templates"><span>Workout templates</span><span><span class="cnt">${S.templates.length}</span><span class="chev">›</span></span></button>
    </div>
    <div class="seclab">MY DATA</div>
    <div class="sgroup">
      <button class="srow srow-btn" data-action="export"><span>Export backup<span class="hint">Saves a file with your whole history</span></span><span class="chev">›</span></button>
      <button class="srow srow-btn" data-action="import"><span>Restore from backup</span><span class="chev">›</span></button>
      <button class="srow srow-btn" data-action="reset-all"><span style="color:var(--purple-text)">Start fresh<span class="hint">Erase all data on this device</span></span><span class="chev">›</span></button>
    </div>
    <input type="file" id="import-file" accept=".json,application/json" style="display:none">
    <div class="version">Form 1.2.1 · made with 💗 by your brother</div>`;
}

function renderTemplates() {
  return `
    <div class="backrow"><button class="backbtn" data-action="open-settings">‹ Settings</button><h1>Templates</h1></div>
    <div class="sgroup">
      ${S.templates.map(t => `
        <div class="srow"><span>${esc(t.name)}<span class="hint">${t.exerciseIds.map(id => esc(exById(id).name)).join(' · ')}</span></span>
        <button style="font-size:15px; color:var(--purple-text)" data-action="del-template" data-id="${t.id}" aria-label="Delete ${esc(t.name)}">✕</button></div>`).join('')
      || '<div class="empty-note">No templates yet.</div>'}
    </div>
    <div class="empty-note" style="padding-top:6px">New templates: build a plan on Today, then "Save as template" ✨</div>`;
}

function renderCustomEx() {
  return `
    <div class="backrow"><button class="backbtn" data-action="open-settings">‹ Settings</button><h1>Custom exercises</h1></div>
    <div class="sgroup">
      ${S.custom.map(ex => `
        <div class="srow"><span>${esc(ex.name)}<span class="hint">${esc(musName(ex.p[0]))} · ${esc(EQUIPMENT_NAMES[ex.eq] || ex.eq)}</span></span>
        <button style="font-size:15px; color:var(--purple-text)" data-action="del-custom" data-id="${ex.id}" aria-label="Delete ${esc(ex.name)}">✕</button></div>`).join('')
      || '<div class="empty-note">Nothing custom yet — add one from any exercise picker with “+ New exercise”.</div>'}
    </div>`;
}

// ---------------------------------------------------------------- plan editor
function renderPlanEdit() {
  const d = ui.planDraft;
  return `
    <div class="backrow"><button class="backbtn" data-action="plan-cancel">‹ Cancel</button><h1>${d.id ? 'Edit plan' : 'Plan a workout'}</h1></div>
    <div class="field"><label>WORKOUT NAME</label>
      <input type="text" id="plan-name" value="${esc(d.name)}" maxlength="24"></div>
    <div class="field"><label>WHEN</label>
      <input type="date" id="plan-date" value="${esc(d.date)}"></div>
    <div class="card">
      ${d.exerciseIds.length ? d.exerciseIds.map((id, i) => `
        <div class="planrow">
          <div class="nm">${esc(exById(id).name)}<small>${exById(id).p.map(m => esc(musName(m))).join(', ')}</small></div>
          <button class="mv" data-action="plan-move" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled style="opacity:.35"' : ''}>↑</button>
          <button class="mv" data-action="plan-move" data-i="${i}" data-d="1" ${i === d.exerciseIds.length - 1 ? 'disabled style="opacity:.35"' : ''}>↓</button>
          <button class="rm" data-action="plan-remove" data-i="${i}">✕</button>
        </div>`).join('') : '<div class="empty-note">No exercises yet — add some below 💗</div>'}
    </div>
    <button class="btn-ghost" data-action="add-exercise">+ Add exercise</button>
    <button class="btn-primary" data-action="plan-save">Save plan ✦</button>
    <button class="btn-ghost" data-action="plan-save-template" ${d.exerciseIds.length ? '' : 'disabled style="opacity:.4"'}>Save as template</button>
    ${S.templates.length ? `
      <div class="seclab">OR START FROM A TEMPLATE</div>
      <div class="qstart">
        ${S.templates.map(t => `<button data-action="draft-template" data-id="${t.id}">${esc(t.name)}</button>`).join('')}
      </div>` : ''}
    ${S.workouts.length ? `
      <div class="seclab">OR COPY A RECENT WORKOUT</div>
      <div class="sgroup">
        ${[...S.workouts].slice(-4).reverse().map(w => `
          <button class="srow srow-btn" data-action="draft-copy" data-id="${w.id}">
            <span>${esc(w.name)} <span style="color:var(--pink-text)">· ${esc(fmtDate(w.date))}</span>
            <span class="hint">${w.entries.map(e => esc(exById(e.exId).name)).join(' · ') || 'no exercises'}</span></span>
            <span class="chev">›</span>
          </button>`).join('')}
      </div>` : ''}`;
}

// ---------------------------------------------------------------- sheets
function openSheet(html) {
  $('#sheet-root').innerHTML = `<div class="scrim" data-action="sheet-close"><div class="sheet" data-stop>${html}</div></div>`;
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }

function openPicker(ctx) {
  ui.pickCtx = ctx; ui.pickSearch = ''; ui.pickMus = null;
  openSheet(pickerHTML());
  const inp = $('#pick-search'); if (inp) inp.focus();
}
function pickerHTML() {
  const q = ui.pickSearch.trim().toLowerCase();
  const inUse = new Set(
    ui.pickCtx === 'active' && S.active ? S.active.exs.map(e => e.exId)
    : ui.planDraft ? ui.planDraft.exerciseIds : []);
  let list = allExercises().filter(ex =>
    !inUse.has(ex.id)
    && (!ui.pickMus || ex.p.includes(ui.pickMus))
    && (!q || ex.name.toLowerCase().includes(q)));
  return `
    <div class="grabber"></div>
    <h2>Add exercise</h2>
    <input class="search" id="pick-search" placeholder="Search…" value="${esc(ui.pickSearch)}" data-action-input="pick-search">
    <div class="musfilter">
      <button class="${!ui.pickMus ? 'sel' : ''}" data-action="pick-mus" data-m="">All</button>
      ${MUSCLES.map(m => `<button class="${ui.pickMus === m.id ? 'sel' : ''}" data-action="pick-mus" data-m="${m.id}">${esc(m.name)}</button>`).join('')}
    </div>
    <div class="pickerlist">
      ${list.slice(0, 40).map(ex => `<div class="pickrow">
        <button class="pickmain" data-action="pick-ex" data-ex="${ex.id}">
          <span class="nm">${esc(ex.name)}<small>${ex.p.map(m => esc(musName(m))).join(', ')} · ${esc(EQUIPMENT_NAMES[ex.eq] || ex.eq)}</small></span>
          <span class="plus">+</span>
        </button>
        <button class="editnm" data-action="rename-ex" data-ex="${ex.id}" aria-label="Rename ${esc(ex.name)}">✎</button>
      </div>`).join('')
      || '<div class="empty-note">No matches — create it below ✨</div>'}
    </div>
    <button class="btn-ghost" data-action="new-ex-form">+ New exercise</button>`;
}
function refreshPicker() {
  const sheet = $('.sheet'); if (!sheet) return;
  const pos = $('.pickerlist', sheet).scrollTop;
  sheet.innerHTML = pickerHTML();
  const inp = $('#pick-search', sheet);
  inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  $('.pickerlist', sheet).scrollTop = pos;
}

function openRename(exId) {
  ui.renameTarget = exId;
  const cur = exById(exId).name;
  const base = baseNameOf(exId);
  openSheet(`
    <div class="grabber"></div>
    <h2>Rename exercise</h2>
    ${base && base !== cur ? `<p class="sub">Library name: ${esc(base)}</p>` : ''}
    <div class="field"><label>HER NAME FOR IT</label>
      <input type="text" id="rename-name" maxlength="40" value="${esc(cur)}"></div>
    <button class="btn-primary" data-action="rename-save">Save ✦</button>
    ${base && base !== cur ? `<button class="btn-ghost" data-action="rename-reset">Reset to "${esc(base)}"</button>` : ''}`);
  const inp = $('#rename-name'); inp.focus(); inp.select();
}

function applyRename(exId, name) {
  const custom = S.custom.find(e => e.id === exId);
  if (custom) custom.name = name;
  else if (name === baseNameOf(exId)) delete S.renames[exId];
  else S.renames[exId] = name;
  save();
}

function openNewExForm() {
  openSheet(`
    <div class="grabber"></div>
    <h2>New exercise</h2>
    <div class="field"><label>NAME</label><input type="text" id="nex-name" maxlength="40" placeholder="e.g. Banded Side Walk"></div>
    <div class="field"><label>MAIN MUSCLE</label>
      <div class="musgrid" id="nex-mus">
        ${MUSCLES.map((m, i) => `<button class="${i === 0 ? 'sel' : ''}" data-action="nex-mus" data-m="${m.id}">${esc(m.name)}</button>`).join('')}
      </div></div>
    <div class="field"><label>EQUIPMENT</label>
      <div class="musgrid" id="nex-eq">
        ${Object.entries(EQUIPMENT_NAMES).map(([id, n], i) => `<button class="${i === 0 ? 'sel' : ''}" data-action="nex-eq" data-m="${id}">${esc(n)}</button>`).join('')}
      </div></div>
    <button class="btn-primary" data-action="nex-save">Create ✦</button>`);
  $('#nex-name').focus();
}

function openSwap() {
  const a = S.active; const en = a.exs[a.cur];
  const cur = exById(en.exId);
  const inWorkout = new Set(a.exs.map(e => e.exId));
  const alts = allExercises()
    .filter(ex => !inWorkout.has(ex.id) && ex.p.some(m => cur.p.includes(m)))
    .sort((x, y) => (lastSessionFor(y.id) ? 1 : 0) - (lastSessionFor(x.id) ? 1 : 0))
    .slice(0, 3);
  openSheet(`
    <div class="grabber"></div>
    <h2>Machine's taken? 💗</h2>
    <p class="sub">Same muscles as ${esc(cur.name)} — your plan updates in place.</p>
    <div class="pickerlist">
      ${alts.map(ex => `<button class="pickrow" data-action="swap-to" data-ex="${ex.id}">
        <span class="nm">${esc(ex.name)}<small>${ex.p.map(m => esc(musName(m))).join(', ')} · ${esc(EQUIPMENT_NAMES[ex.eq] || ex.eq)}${lastSessionFor(ex.id) ? ' · you\'ve done this' : ''}</small></span>
        <span class="plus">↻</span></button>`).join('')
      || '<div class="empty-note">No alternatives found.</div>'}
    </div>
    <button class="btn-ghost" data-action="sheet-close">Never mind</button>`);
}

function openNotes() {
  const en = S.active.exs[S.active.cur];
  openSheet(`
    <div class="grabber"></div>
    <h2>Notes — ${esc(exById(en.exId).name)}</h2>
    <textarea class="notes" id="note-text" placeholder="e.g. wider grip felt better…">${esc(en.note || '')}</textarea>
    <button class="btn-primary" data-action="note-save">Save note ✦</button>`);
  $('#note-text').focus();
}

function openFinish() {
  const a = S.active;
  const sets = a.exs.reduce((n, e) => n + e.sets.length, 0);
  if (!sets) {
    openSheet(`
      <div class="grabber"></div>
      <h2>Nothing logged yet</h2>
      <p class="sub">Finish and discard this workout, or keep lifting?</p>
      <button class="btn-primary" data-action="discard-workout">Discard workout</button>
      <button class="btn-ghost" data-action="sheet-close">Keep lifting 💪</button>`);
    return;
  }
  const dur = (Date.now() - a.startedAt) / 1000;
  const volLb = a.exs.reduce((n, e) => n + e.sets.reduce((m, s) => m + s.w * s.r, 0), 0);
  const vol = isKg() ? volLb / LB_PER_KG : volLb;
  const prs = detectPRs(a);
  openSheet(`
    <div class="grabber"></div>
    <h2>Nice work! 💗</h2>
    <div class="summary-stats">
      <div class="stat"><b>${fmtClock(dur)}</b><span>TIME</span></div>
      <div class="stat"><b>${sets}</b><span>SETS</span></div>
      <div class="stat"><b>${vol >= 10000 ? (vol / 1000).toFixed(1) + 'k' : Math.round(vol)}</b><span>${unitLabel().toUpperCase()} MOVED</span></div>
    </div>
    ${prs.length ? `<div class="prlist-cele"><h4>✦ ${prs.length === 1 ? 'New record!' : prs.length + ' new records!'}</h4>
      ${prs.map(p => `<p>${esc(exById(p.exId).name)} — <b>${showW(p.top)} ${unitLabel()}</b>${p.prev !== null ? ` (was ${showW(p.prev)})` : ' · first time logged'}</p>`).join('')}</div>` : ''}
    <button class="btn-primary" data-action="save-workout">Save workout ✦</button>
    <button class="btn-ghost" data-action="sheet-close">Keep lifting 💪</button>`);
  if (prs.length) confetti();
}

// ---------------------------------------------------------------- actions
function startWorkout(name, exerciseIds, planId) {
  S.active = {
    name: name || 'Workout',
    startedAt: Date.now(),
    cur: 0,
    planId: planId || null,
    exs: exerciseIds.map(id => ({ exId: id, sets: [], note: '', target: targetSetsFor(id) })),
  };
  ui.stageKey = ''; ui.restEnd = null; ui.restDone = false;
  save();
  ui.tab = 'lift'; ui.page = null;
  render();
}
function targetSetsFor(exId) {
  const prev = lastSessionFor(exId);
  return prev ? Math.max(prev.entry.sets.length, 1) : 3;
}

function logSet() {
  const a = S.active; const en = a.exs[a.cur];
  en.sets.push({ w: ui.stageW, r: ui.stageR, rpe: ui.rpeSel });
  ui.stageKey = ''; // re-stage for next set
  startRest();
  save();
  render();
}
function startRest() {
  ui.restTotal = S.settings.restSec;
  ui.restEnd = Date.now() + ui.restTotal * 1000;
  ui.restDone = false;
}
function finishRest() {
  ui.restDone = true; ui.restEnd = null;
  if (S.settings.sound) { chime(); if (navigator.vibrate) navigator.vibrate([180, 90, 180]); }
  if (ui.tab === 'lift' && !ui.page) render();
}

function saveWorkout() {
  const a = S.active;
  const entries = a.exs.filter(e => e.sets.length).map(e => ({ exId: e.exId, sets: e.sets, note: e.note }));
  S.workouts.push({
    id: uid(),
    date: new Date().toISOString(),
    name: a.name,
    durationSec: Math.round((Date.now() - a.startedAt) / 1000),
    entries,
  });
  if (a.planId) S.plans = S.plans.filter(p => p.id !== a.planId);
  S.active = null;
  ui.restEnd = null; ui.restDone = false;
  save();
  closeSheet();
  ui.tab = 'today';
  render();
  toast('Saved — see you next time 💗');
}

function removeCurrentExercise() {
  const a = S.active;
  a.exs.splice(a.cur, 1);
  a.cur = Math.min(a.cur, Math.max(0, a.exs.length - 1));
  ui.stageKey = '';
  save(); render();
  toast('Exercise removed');
}

function addExerciseTo(ctx, exId) {
  if (ctx === 'active' && S.active) {
    S.active.exs.push({ exId, sets: [], note: '', target: targetSetsFor(exId) });
    S.active.cur = S.active.exs.length - 1;
    ui.stageKey = '';
    save();
  } else if (ui.planDraft) {
    ui.planDraft.exerciseIds.push(exId);
  }
}

function ensurePlanDraft(planId) {
  const p = planId ? planById(planId) : null;
  ui.planDraft = {
    id: p ? p.id : null,
    date: p ? p.date : todayKey(),
    name: p ? p.name : 'My Workout',
    exerciseIds: p ? [...p.exerciseIds] : [],
  };
}

function addToTodayPlan(exId) {
  if (S.active) { addExerciseTo('active', exId); toast('Added to your workout ✦'); render(); return; }
  const p = todayPlanOrNew();
  if (!p.exerciseIds.includes(exId)) p.exerciseIds.push(exId);
  save();
  toast('Added to today\'s plan ✦');
  render();
}

// ---------------------------------------------------------------- export / import
function exportBackup() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `form-backup-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Backup exported ✦');
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.workouts)) throw new Error('bad format');
      openSheet(`
        <div class="grabber"></div>
        <h2>Restore this backup?</h2>
        <p class="sub">${data.workouts.length} workouts · replaces everything currently in the app.</p>
        <button class="btn-primary" data-action="import-confirm">Yes, restore ✦</button>
        <button class="btn-ghost" data-action="sheet-close">Cancel</button>`);
      ui._pendingImport = data;
    } catch (e) {
      toast('That file doesn\'t look like a Form backup');
    }
  };
  reader.readAsText(file);
}

// ---------------------------------------------------------------- fx
function toast(msg) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function confetti() {
  const root = $('#confetti-root');
  const bits = ['✦', '✧', '💗', '✨', '⭐'];
  for (let i = 0; i < 34; i++) {
    const c = document.createElement('span');
    c.className = 'confetto';
    c.textContent = bits[i % bits.length];
    c.style.left = (Math.random() * 100) + 'vw';
    c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    c.style.animationDelay = (Math.random() * 0.6) + 's';
    c.style.fontSize = (13 + Math.random() * 14) + 'px';
    root.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}
let audioCtx = null;
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1174.7];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.001, audioCtx.currentTime + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + i * 0.16 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.16 + 0.5);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + i * 0.16); o.stop(audioCtx.currentTime + i * 0.16 + 0.55);
    });
  } catch (e) { /* audio unavailable */ }
}

// ---------------------------------------------------------------- tick
setInterval(() => {
  if (S.active && ui.tab === 'lift' && !ui.page) {
    const el = $('#elapsed');
    if (el) el.textContent = fmtClock((Date.now() - S.active.startedAt) / 1000);
  }
  if (ui.restEnd) {
    const left = (ui.restEnd - Date.now()) / 1000;
    if (left <= 0) { finishRest(); return; }
    const t = $('#rest-time'), f = $('#rest-fill');
    if (t) t.textContent = fmtClock(left);
    if (f) f.style.transform = `scaleX(${Math.max(0, left / ui.restTotal)})`;
  }
}, 400);

// ---------------------------------------------------------------- event handling
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action]');
  if (!btn) return;
  const act = btn.dataset.action;
  const a = S.active;

  switch (act) {
    // navigation
    case 'tab': ui.tab = btn.dataset.tab; ui.page = null; render(); break;
    case 'open-settings': ui.page = 'settings'; render(); break;
    case 'close-page': ui.page = null; ui.tab = 'today'; render(); break;
    case 'open-templates': ui.page = 'templates'; render(); break;
    case 'open-customex': ui.page = 'customex'; render(); break;

    // today
    case 'start-plan': {
      const p = nextUpPlan();
      if (p) startWorkout(p.name, p.exerciseIds.filter(id => allExercises().some(e => e.id === id)), p.id);
      break;
    }
    case 'start-template': {
      const t = S.templates.find(x => x.id === btn.dataset.id);
      if (t) startWorkout(t.name, t.exerciseIds.filter(id => allExercises().some(e => e.id === id)));
      break;
    }
    case 'start-empty': startWorkout('Freestyle', []); openPicker('active'); break;
    case 'edit-plan': ensurePlanDraft(btn.dataset.id || null); ui.page = 'plan'; render(); break;
    case 'new-plan': ensurePlanDraft(null); ui.page = 'plan'; render(); break;
    case 'del-plan':
      S.plans = S.plans.filter(p => p.id !== btn.dataset.id);
      save(); render();
      break;
    case 'sug-add': addToTodayPlan(btn.dataset.ex); break;
    case 'sug-skip': S.sugDismissed = todayKey(); save(); render(); break;

    // plan editor
    case 'plan-cancel': ui.planDraft = null; ui.page = null; render(); break;
    case 'plan-move': {
      const i = +btn.dataset.i, d = +btn.dataset.d, ids = ui.planDraft.exerciseIds;
      const j = i + d;
      if (j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; render(); }
      break;
    }
    case 'plan-remove': ui.planDraft.exerciseIds.splice(+btn.dataset.i, 1); render(); break;
    case 'draft-template': {
      const t = S.templates.find(x => x.id === btn.dataset.id);
      if (!t) break;
      ui.planDraft.exerciseIds = t.exerciseIds.filter(id => allExercises().some(e => e.id === id));
      if (!ui.planDraft.id && (ui.planDraft.name === 'My Workout' || !ui.planDraft.name.trim())) ui.planDraft.name = t.name;
      render(); toast(`Loaded "${t.name}" ✦`);
      break;
    }
    case 'draft-copy': {
      const w = S.workouts.find(x => x.id === btn.dataset.id);
      if (!w) break;
      ui.planDraft.exerciseIds = [...new Set(w.entries.map(e => e.exId))]
        .filter(id => allExercises().some(e => e.id === id));
      if (!ui.planDraft.id && (ui.planDraft.name === 'My Workout' || !ui.planDraft.name.trim())) ui.planDraft.name = w.name;
      render(); toast(`Copied "${w.name}" from ${fmtDate(w.date)} ✦`);
      break;
    }
    case 'plan-save': {
      const name = (ui.planDraft.name || '').trim() || 'My Workout';
      const date = ui.planDraft.date || todayKey();
      const saved = { id: ui.planDraft.id || uid(), date, name, exerciseIds: [...ui.planDraft.exerciseIds] };
      const idx = S.plans.findIndex(p => p.id === saved.id);
      if (idx >= 0) S.plans[idx] = saved; else S.plans.push(saved);
      ui.planDraft = null; ui.page = null;
      save(); render(); toast(`Plan saved for ${dateLabel(date).toLowerCase()} ✦`);
      break;
    }
    case 'plan-save-template': {
      const name = (ui.planDraft.name || '').trim() || 'My Workout';
      S.templates.push({ id: uid(), name, exerciseIds: [...ui.planDraft.exerciseIds] });
      save(); toast(`Saved "${name}" as a template ✦`);
      break;
    }

    // lift
    case 'stage': {
      const d = +btn.dataset.d;
      if (btn.dataset.f === 'w') {
        ui.stageW = Math.max(0, ui.stageW + d * stepInternal());
        $('#stage-w').innerHTML = `${showW(ui.stageW)}<small>${unitLabel()}</small>`;
      } else {
        ui.stageR = Math.max(1, ui.stageR + d);
        $('#stage-r').textContent = ui.stageR;
      }
      break;
    }
    case 'rpe': ui.rpeSel = (ui.rpeSel === +btn.dataset.v) ? null : +btn.dataset.v; render(); break;
    case 'log-set': logSet(); break;
    case 'rest-tap':
      if (ui.restEnd) { ui.restEnd = null; ui.restDone = false; render(); }        // skip
      else if (ui.restDone) { ui.restDone = false; render(); }                     // dismiss
      else { startRest(); render(); }                                             // manual start
      break;
    case 'prev-ex': if (a && a.cur > 0) { a.cur--; ui.stageKey = ''; save(); render(); } break;
    case 'next-ex': if (a && a.cur < a.exs.length - 1) { a.cur++; ui.stageKey = ''; save(); render(); } break;
    case 'add-exercise': openPicker(ui.page === 'plan' ? 'plan' : 'active'); break;
    case 'open-swap': openSwap(); break;
    case 'swap-to': {
      const en = a.exs[a.cur];
      if (!en.sets.length) {
        a.exs[a.cur] = { exId: btn.dataset.ex, sets: [], note: '', target: targetSetsFor(btn.dataset.ex) };
      } else {
        a.exs.splice(a.cur + 1, 0, { exId: btn.dataset.ex, sets: [], note: '', target: targetSetsFor(btn.dataset.ex) });
        a.cur++;
      }
      ui.stageKey = '';
      save(); closeSheet(); render();
      break;
    }
    case 'remove-ex': {
      const en = a.exs[a.cur];
      if (en.sets.length) {
        openSheet(`
          <div class="grabber"></div>
          <h2>Remove ${esc(exById(en.exId).name)}?</h2>
          <p class="sub">Its ${en.sets.length} logged ${en.sets.length === 1 ? 'set' : 'sets'} from this workout will be discarded.</p>
          <button class="btn-primary" data-action="remove-ex-confirm">Remove it</button>
          <button class="btn-ghost" data-action="sheet-close">Keep it</button>`);
      } else {
        removeCurrentExercise();
      }
      break;
    }
    case 'remove-ex-confirm': closeSheet(); removeCurrentExercise(); break;
    case 'open-notes': openNotes(); break;
    case 'note-save':
      a.exs[a.cur].note = $('#note-text').value.trim();
      save(); closeSheet(); render();
      break;
    case 'finish': openFinish(); break;
    case 'save-workout': saveWorkout(); break;
    case 'discard-workout':
      S.active = null; ui.restEnd = null; ui.restDone = false;
      save(); closeSheet(); ui.tab = 'today'; render();
      break;

    // picker
    case 'sheet-close': if (ev.target === btn || !ev.target.closest('[data-stop]')) closeSheet(); break;
    case 'pick-mus': ui.pickMus = btn.dataset.m || null; refreshPicker(); break;
    case 'pick-ex': {
      addExerciseTo(ui.pickCtx, btn.dataset.ex);
      closeSheet(); render();
      break;
    }
    case 'new-ex-form': openNewExForm(); break;
    case 'rename-ex': openRename(btn.dataset.ex); break;
    case 'rename-save': {
      const name = $('#rename-name').value.trim();
      if (!name) { toast('Give it a name first 💗'); break; }
      applyRename(ui.renameTarget, name);
      toast(`Renamed to "${name}" ✦`);
      if (ui.pickCtx) openSheet(pickerHTML()); else closeSheet();
      render();
      break;
    }
    case 'rename-reset': {
      applyRename(ui.renameTarget, baseNameOf(ui.renameTarget));
      toast('Name reset ✦');
      if (ui.pickCtx) openSheet(pickerHTML()); else closeSheet();
      render();
      break;
    }
    case 'nex-mus': $$('#nex-mus button').forEach(b => b.classList.toggle('sel', b === btn)); break;
    case 'nex-eq': $$('#nex-eq button').forEach(b => b.classList.toggle('sel', b === btn)); break;
    case 'nex-save': {
      const name = $('#nex-name').value.trim();
      if (!name) { toast('Give it a name first 💗'); break; }
      const mus = ($('#nex-mus button.sel') || {}).dataset.m || 'glutes';
      const eq = ($('#nex-eq button.sel') || {}).dataset.m || 'machine';
      const ex = { id: uid(), name, eq, p: [mus], s: [], custom: true };
      S.custom.push(ex);
      addExerciseTo(ui.pickCtx, ex.id);
      save(); closeSheet(); render();
      toast(`${name} created ✦`);
      break;
    }

    // coach
    case 'coach-mus': ui.coachMus = btn.dataset.m; render(); break;
    case 'coach-add': case 'insight-add': addToTodayPlan(btn.dataset.ex); break;

    // progress — (chart select handled on change)

    // settings
    case 'unit': {
      const u = btn.dataset.u;
      if (u === S.settings.unit) break;
      S.settings.unit = u;
      save(); render();
      toast(`Now showing ${u} ✦`);
      break;
    }
    case 'rest-default':
      S.settings.restSec = Math.min(300, Math.max(30, S.settings.restSec + (+btn.dataset.d)));
      save(); render();
      break;
    case 'toggle-sound': S.settings.sound = !S.settings.sound; save(); render(); break;
    case 'del-template': {
      S.templates = S.templates.filter(t => t.id !== btn.dataset.id);
      save(); render();
      break;
    }
    case 'del-custom': {
      const id = btn.dataset.id;
      const used = S.workouts.some(w => w.entries.some(e => e.exId === id))
        || (S.active && S.active.exs.some(e => e.exId === id))
        || S.templates.some(t => t.exerciseIds.includes(id))
        || S.plans.some(p => p.exerciseIds.includes(id));
      if (used) { toast('In use by history or a plan — can\'t delete'); break; }
      S.custom = S.custom.filter(e => e.id !== id);
      save(); render();
      break;
    }
    case 'reset-all':
      openSheet(`
        <div class="grabber"></div>
        <h2>Start completely fresh?</h2>
        <p class="sub">This erases every workout, plan, template, and setting stored on this device. If any of it is worth keeping, export a backup first.</p>
        <button class="btn-primary" data-action="reset-all-confirm">Erase everything</button>
        <button class="btn-ghost" data-action="sheet-close">Cancel</button>`);
      break;
    case 'reset-all-confirm':
      localStorage.removeItem(STORE_KEY);
      location.reload();
      break;
    case 'export': exportBackup(); break;
    case 'import': $('#import-file').click(); break;
    case 'import-confirm':
      S = normalizeState(ui._pendingImport);
      ui._pendingImport = null;
      save(); closeSheet(); ui.page = null; ui.tab = 'today'; render();
      toast('Backup restored 💗');
      break;
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset.actionInput === 'pick-search') { ui.pickSearch = t.value; refreshPicker(); }
  if (ui.planDraft && t.id === 'plan-name') ui.planDraft.name = t.value;
  if (ui.planDraft && t.id === 'plan-date' && t.value) ui.planDraft.date = t.value;
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset.actionChange === 'chart-ex') { ui.chartEx = t.value; render(); }
  if (t.id === 'import-file' && t.files && t.files[0]) { importBackup(t.files[0]); t.value = ''; }
});
// keep scrim tap-to-close working while ignoring taps inside the sheet
document.addEventListener('pointerdown', (ev) => {
  if (ev.target.classList && ev.target.classList.contains('scrim')) closeSheet();
}, true);

// ---------------------------------------------------------------- boot
if (S.active) ui.tab = 'lift';
render();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  // updateViaCache:'none' — never let the HTTP cache delay update checks
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    reg.update();
    // iOS keeps installed PWAs resident: re-check whenever the app comes back to the foreground
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
  // when a new version takes over, reload once so she's on it immediately
  let hadController = !!navigator.serviceWorker.controller;
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; } // first claim after a fresh install — no reload
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    location.reload();
  });
}
