// Everything the app recommends. Each block names its source.
// Lifting and the home workout come from your files; the ab workout is general knowledge, designed for this app.
window.ET_DATA = {
  lifting: {
    source: 'Integrated_Training_Program.docx, section 5 (14 July 2026)',
    rotation: ['A', 'B', 'C'],
    rule: 'Add about 5 kg on squat and deadlift and 2.5 kg on bench and overhead press after each successful session. If a lift stalls for two sessions running, back off about 10% and re-ramp.',
    sessions: {
      A: {
        name: 'Lift A', focus: 'Squat + Overhead Press',
        exercises: [
          { slot: 'squat', sets: 3, reps: 5, inc: 5, lift: 'squat', rest: 180, options: [{ id: 'squat', name: 'Squat' }] },
          { slot: 'ohp', sets: 3, reps: 5, inc: 2.5, lift: 'ohp', rest: 180, options: [{ id: 'ohp', name: 'Overhead Press' }] },
          { slot: 'a-pull', sets: 3, reps: [5, 8], inc: 2.5, rest: 150, note: 'Pulling volume (section 3.3).',
            options: [{ id: 'wchin', name: 'Weighted Chin-ups', bw: true }, { id: 'wpull', name: 'Weighted Pull-ups', bw: true }] },
          { slot: 'facepull', sets: 2, reps: 15, inc: 2.5, rest: 60, note: 'Shoulder health (section 3.3).',
            options: [{ id: 'facepull', name: 'Face Pulls' }, { id: 'pullapart', name: 'Band Pull-Aparts', noWeight: true }] },
          { slot: 'hkr', sets: 3, reps: [10, 15], rest: 60, valveDrop: true, options: [{ id: 'hkr', name: 'Hanging Knee Raise', noWeight: true }] }
        ]
      },
      B: {
        name: 'Lift B', focus: 'Squat + Bench Press',
        exercises: [
          { slot: 'squat', sets: 3, reps: 5, inc: 5, lift: 'squat', rest: 180, options: [{ id: 'squat', name: 'Squat' }] },
          { slot: 'bench', sets: 3, reps: 5, inc: 2.5, lift: 'bench', rest: 180, options: [{ id: 'bench', name: 'Bench Press' }] },
          { slot: 'row', sets: 3, reps: 8, inc: 2.5, rest: 120, note: 'Pulling volume (section 3.3).',
            options: [{ id: 'pendlay', name: 'Pendlay Row', hint: 'Last pulling numbers in Workout Planner: pronated cable row 47 kg × 8 (Bro-Split).' },
                      { id: 'bbrow', name: 'Barbell Row', hint: 'Last pulling numbers in Workout Planner: pronated cable row 47 kg × 8 (Bro-Split).' }] },
          { slot: 'b-legs', sets: 2, reps: 10, rest: 90, note: 'Extra leg volume (section 2).',
            options: [{ id: 'bss', name: 'Bulgarian Split Squat', inc: 2, hint: 'Log the total dumbbell weight; reps are per leg.' },
                      { id: 'legcurl', name: 'Leg Curl', inc: 2.5 }] },
          { slot: 'lateral', sets: 2, reps: 12, inc: 1, rest: 60, valveDrop: true, note: 'Shoulder development (section 2).',
            options: [{ id: 'lateral', name: 'Lateral Raises', hint: 'Workbook: machine lateral raise 22.5 kg × 10 (Bro-Split). Dumbbell weights will be lower.' }] },
          { slot: 'facepull', sets: 2, reps: 15, inc: 2.5, rest: 60, added: true, note: 'Added to match section 3.3 (face pulls every session). The written Lift B list leaves it out.',
            options: [{ id: 'facepull', name: 'Face Pulls' }, { id: 'pullapart', name: 'Band Pull-Aparts', noWeight: true }] }
        ]
      },
      C: {
        name: 'Lift C', focus: 'Squat + Deadlift',
        exercises: [
          { slot: 'squat', sets: 3, reps: 5, inc: 5, lift: 'squat', rest: 180, options: [{ id: 'squat', name: 'Squat' }] },
          { slot: 'deadlift', sets: 1, reps: 5, inc: 5, lift: 'deadlift', rest: 240, note: 'Single top set: deadlift has a high fatigue cost (section 3.1).',
            options: [{ id: 'deadlift', name: 'Deadlift' }] },
          { slot: 'c-push', sets: 3, reps: 8, inc: 2.5, rest: 120, valveDrop: true,
            options: [{ id: 'wdips', name: 'Weighted Dips', bw: true, hint: 'Workbook: dips 12 reps at bodyweight (Strength Builder).' },
                      { id: 'benchvar', name: 'Bench Press variant (close-grip or incline)' }] },
          { slot: 'c-pull', sets: 3, reps: [5, 8], inc: 2.5, rest: 150, note: 'Pulling volume (section 3.3).',
            options: [{ id: 'chin', name: 'Chin-ups', bw: true, hint: 'Workbook: chin-ups 7 reps (Strength Builder).' },
                      { id: 'pullup', name: 'Pull-ups', bw: true, hint: 'Workbook: pull-ups 7 reps (Strength Builder).' }] },
          { slot: 'facepull', sets: 2, reps: 15, inc: 2.5, rest: 60, added: true, note: 'Added to match section 3.3 (face pulls every session). The written Lift C list leaves it out.',
            options: [{ id: 'facepull', name: 'Face Pulls' }, { id: 'pullapart', name: 'Band Pull-Aparts', noWeight: true }] },
          { slot: 'medball', sets: 3, reps: 5, rest: 60, optional: true, note: 'Optional power-conversion work, 5 each side (section 3.5).',
            options: [{ id: 'medball', name: 'Rotational Med Ball Throw', noWeight: true }] }
        ]
      }
    },
    lifts: {
      squat:    { name: 'Squat',          milestone: 104, club: 140, clubLb: 315 },
      bench:    { name: 'Bench Press',    milestone: 79,  club: 100, clubLb: 225 },
      ohp:      { name: 'Overhead Press', milestone: 52,  club: 60,  clubLb: 135 },
      deadlift: { name: 'Deadlift',       milestone: 124, club: 180, clubLb: 405 }
    }
  },

  home: {
    source: '15min_protean_bodyweight_routine.md',
    name: '15-min Protean gauntlet',
    how: 'Start each ladder on the hardest variation. Drop down a step only when you hit failure, with no planned rest, until you can’t do the easiest version any more. Scale by moving along the ladders, not by adding sets.',
    warmup: { dur: 120, items: ['Knee circles: 10 each direction', 'Arm windmills, opposite direction: 10 each way', 'High kicks: 5 straight up each leg, 5 sideways each leg', 'Deep squat holds: 5 reps', 'Bird dog: 5 each side'] },
    work: 90,
    transition: 20,
    gauntlets: [
      { id: 'legs', name: 'Legs', ladder: ['Jump Squats', 'Air Squats', 'Wall-Assisted Squats'] },
      { id: 'push', name: 'Push', ladder: ['Explosive/Clapping Push-ups', 'Push-ups', 'Knee Push-ups', 'Incline Push-ups (hands on a chair or sofa arm)'] },
      { id: 'post', name: 'Posterior chain', ladder: ['Reverse Plank with Leg Raises', 'Single-Leg Glute Bridges', 'Bodyweight Good Mornings'],
        alt: { name: 'Pull (bar or sturdy table)', ladder: ['Towel Pull-ups', 'Bodyweight Rows', 'Incline Rows'] } },
      { id: 'core', name: 'Core / rotation', ladder: ['X-Ups', 'Bicycle Sit-ups', 'Elbow-to-Knee Crunches'] },
      { id: 'finish', name: 'Explosive finisher', ladder: ['Burpees', 'Bunny Hops', 'Backward Jogging on the spot'] }
    ],
    cooldown: { dur: 150, items: ['Deep squat hold: 20–30 s', 'Downward dog: 20–30 s', 'Cobra stretch: 20–30 s', 'Crab reach: 20 s each side', 'Half bridge: 20–30 s (skip if any back history)', 'Optional: 30 s soft, wide peripheral gaze with slow breathing'] }
  },

  abs: {
    source: 'General knowledge, not from the 15-source review. Designed for this app.',
    rounds: { rest: 3, training: 2 },
    how: 'Circuit: one set of each exercise, 20–30 s between exercises, about 60 s between rounds. Roughly 8–10 minutes. Do it after training rather than before heavy squats or deadlifts, so your trunk isn’t tired when you need to brace.',
    progress: 'When every set at your current step feels controlled two sessions running, move up a step (▲). Move down (▼) if form slips.',
    days: [
      { id: 'A', name: 'Abs A', focus: 'Anti-extension and flexion', exercises: [
        { id: 'hollow', name: 'Hollow body hold', steps: ['Tuck hollow hold, 20 s', 'Tuck hollow hold, 30 s', 'One-leg hollow hold, 30 s', 'Full hollow hold, 20 s', 'Full hollow hold, 30 s', 'Full hollow hold, 45 s'] },
        { id: 'revcrunch', name: 'Reverse crunch', steps: ['8 reps', '10 reps', '12 reps', '15 reps', '10 reps, 3 s lowering', '15 reps, 3 s lowering'] },
        { id: 'deadbug', name: 'Dead bug', steps: ['6 per side', '8 per side', '10 per side', '8 per side, 2 s hold', '10 per side, 2 s hold'] }
      ] },
      { id: 'B', name: 'Abs B', focus: 'Anti-rotation and obliques', exercises: [
        { id: 'sideplank', name: 'Side plank', steps: ['Knees, 20 s per side', 'Knees, 30 s per side', 'Full, 20 s per side', 'Full, 30 s per side', 'Full, 45 s per side', 'Full with top-leg raise, 30 s per side'] },
        { id: 'shtaps', name: 'Plank shoulder taps', steps: ['8 per side, feet wide', '10 per side, feet wide', '12 per side', '15 per side', '12 per side, feet together'] },
        { id: 'bicycle', name: 'Slow bicycle crunch', steps: ['10 per side', '12 per side', '15 per side', '20 per side'] }
      ] },
      { id: 'C', name: 'Abs C', focus: 'Hanging and strength', exercises: [
        { id: 'legraise', name: 'Leg raise', steps: ['Lying bent-knee raise × 10', 'Lying straight-leg raise × 10', 'Hanging knee raise × 8', 'Hanging knee raise × 12', 'Hanging leg raise × 6', 'Hanging leg raise × 10'], note: 'No bar today? Use a lying version.' },
        { id: 'rkc', name: 'RKC plank (squeeze glutes, pull elbows to toes)', steps: ['15 s', '20 s', '30 s', '40 s', 'Long-lever, 20 s', 'Long-lever, 30 s'] },
        { id: 'vup', name: 'V-up', steps: ['Tuck-up × 8', 'Tuck-up × 12', 'V-up × 6', 'V-up × 10', 'V-up × 15'] }
      ] }
    ]
  },

  recovery: {
    source: 'Integrated_Training_Program.docx, sections 6 and 8',
    signs: [
      { id: 'bar', label: 'Bar speed on squat, bench or press feels slower than the weight should require' },
      { id: 'sleep', label: 'Resting heart rate up on waking, or sleep quality dropping' },
      { id: 'ill', label: 'Getting ill more than usual, or minor niggles not settling between sessions' },
      { id: 'tech', label: 'Muay Thai technique breaking down from fatigue rather than skill' }
    ],
    valve: 'Two or more signs this week: turn one Muay Thai session (not the hardest) into rest, and/or drop one accessory per lifting session. Keep the pulling work.',
    deload: 'Every 4–6 weeks, or straight away if the escape valve triggers twice in one week: cut lifting volume by about a third for a week and keep Muay Thai technique-only.',
    restDay: 'Optional: gentle yoga or mobility. Cold exposure is fine today.',
    liftDay: 'No cold exposure straight after lifting. Sauna is fine; rehydrate first.'
  }
};
