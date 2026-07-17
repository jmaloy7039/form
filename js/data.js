// Form — exercise library & default templates
// Muscles: glutes, quads, hamstrings, calves, chest, back, shoulders, biceps, triceps, core
// Equipment: barbell, dumbbell, machine, cable, bodyweight, smith, band, kettlebell

const MUSCLES = [
  { id: 'glutes',     name: 'Glutes' },
  { id: 'quads',      name: 'Quads' },
  { id: 'hamstrings', name: 'Hamstrings' },
  { id: 'calves',     name: 'Calves' },
  { id: 'back',       name: 'Back' },
  { id: 'chest',      name: 'Chest' },
  { id: 'shoulders',  name: 'Shoulders' },
  { id: 'biceps',     name: 'Biceps' },
  { id: 'triceps',    name: 'Triceps' },
  { id: 'core',       name: 'Core' },
];

// Order within each muscle = coach recommendation priority.
const EXERCISES = [
  // ---- Glutes ----
  { id: 'hip-thrust',        name: 'Hip Thrust',               eq: 'barbell',    p: ['glutes'], s: ['hamstrings'], why: 'The heaviest direct glute work there is — the backbone of a glute program.' },
  { id: 'bulgarian-split',   name: 'Bulgarian Split Squat',    eq: 'dumbbell',   p: ['glutes'], s: ['quads'],      why: 'Trains each side alone and stretches the glute under load — grows what thrusts miss.' },
  { id: 'cable-kickback',    name: 'Cable Kickback',           eq: 'cable',      p: ['glutes'], s: [],             why: 'Isolation finisher — squeeze at the top, chase the burn, not the weight.' },
  { id: 'glute-bridge',      name: 'Glute Bridge',             eq: 'barbell',    p: ['glutes'], s: ['hamstrings'], why: 'Hip-thrust pattern with a shorter range — great when the bench setup is busy.' },
  { id: 'sumo-deadlift',     name: 'Sumo Deadlift',            eq: 'barbell',    p: ['glutes'], s: ['hamstrings', 'back'], why: 'Wide stance shifts deadlift work into the glutes and inner thighs.' },
  { id: 'hip-abduction',     name: 'Hip Abduction Machine',    eq: 'machine',    p: ['glutes'], s: [],             why: 'Hits the upper/side glute that squats and thrusts leave behind.' },
  { id: 'curtsy-lunge',      name: 'Curtsy Lunge',             eq: 'dumbbell',   p: ['glutes'], s: ['quads'],      why: 'The cross-body angle wakes up the glute med — great shaping move.' },
  { id: 'step-up',           name: 'Step-Up',                  eq: 'dumbbell',   p: ['glutes'], s: ['quads'] },
  { id: 'single-leg-thrust', name: 'Single-Leg Hip Thrust',    eq: 'bodyweight', p: ['glutes'], s: ['hamstrings'] },
  { id: 'frog-pump',         name: 'Frog Pump',                eq: 'bodyweight', p: ['glutes'], s: [] },
  { id: 'cable-pull-through',name: 'Cable Pull-Through',       eq: 'cable',      p: ['glutes'], s: ['hamstrings'] },

  // ---- Quads ----
  { id: 'back-squat',        name: 'Back Squat',               eq: 'barbell',    p: ['quads'], s: ['glutes', 'core'], why: 'The classic — full-leg strength with the most room to progress for years.' },
  { id: 'leg-press',         name: 'Leg Press',                eq: 'machine',    p: ['quads'], s: ['glutes'],      why: 'Heavy quad work without balancing a bar — easy to push safely near failure.' },
  { id: 'leg-extension',     name: 'Leg Extension',            eq: 'machine',    p: ['quads'], s: [],              why: 'Pure quad isolation — the burn-out finisher after pressing.' },
  { id: 'goblet-squat',      name: 'Goblet Squat',             eq: 'dumbbell',   p: ['quads'], s: ['glutes', 'core'] },
  { id: 'front-squat',       name: 'Front Squat',              eq: 'barbell',    p: ['quads'], s: ['core', 'glutes'] },
  { id: 'hack-squat',        name: 'Hack Squat',               eq: 'machine',    p: ['quads'], s: ['glutes'] },
  { id: 'walking-lunge',     name: 'Walking Lunge',            eq: 'dumbbell',   p: ['quads'], s: ['glutes'] },
  { id: 'split-squat',       name: 'Split Squat',              eq: 'dumbbell',   p: ['quads'], s: ['glutes'] },
  { id: 'smith-squat',       name: 'Smith Machine Squat',      eq: 'smith',      p: ['quads'], s: ['glutes'] },
  { id: 'sissy-squat',       name: 'Sissy Squat',              eq: 'bodyweight', p: ['quads'], s: [] },

  // ---- Hamstrings ----
  { id: 'rdl',               name: 'Romanian Deadlift',        eq: 'barbell',    p: ['hamstrings'], s: ['glutes', 'back'], why: 'The best hamstring stretch under load — pairs perfectly with hip thrusts.' },
  { id: 'seated-leg-curl',   name: 'Seated Leg Curl',          eq: 'machine',    p: ['hamstrings'], s: [],          why: 'Seated beats lying for growth — the stretch at the knee does the work.' },
  { id: 'lying-leg-curl',    name: 'Lying Leg Curl',           eq: 'machine',    p: ['hamstrings'], s: [],          why: 'Direct knee-flexion work squats can’t give you.' },
  { id: 'nordic-curl',       name: 'Nordic Curl',              eq: 'bodyweight', p: ['hamstrings'], s: [] },
  { id: 'single-leg-rdl',    name: 'Single-Leg RDL',           eq: 'dumbbell',   p: ['hamstrings'], s: ['glutes', 'core'] },
  { id: 'stiff-leg-deadlift',name: 'Stiff-Leg Deadlift',       eq: 'barbell',    p: ['hamstrings'], s: ['glutes', 'back'] },
  { id: 'good-morning',      name: 'Good Morning',             eq: 'barbell',    p: ['hamstrings'], s: ['glutes', 'back'] },
  { id: 'ghr',               name: 'Glute-Ham Raise',          eq: 'bodyweight', p: ['hamstrings'], s: ['glutes'] },

  // ---- Calves ----
  { id: 'standing-calf',     name: 'Standing Calf Raise',      eq: 'machine',    p: ['calves'], s: [],              why: 'Straight-leg raises hit the big gastroc — full stretch at the bottom matters most.' },
  { id: 'seated-calf',       name: 'Seated Calf Raise',        eq: 'machine',    p: ['calves'], s: [],              why: 'Bent knee shifts work to the soleus — pairs with standing raises for complete calves.' },
  { id: 'leg-press-calf',    name: 'Leg Press Calf Raise',     eq: 'machine',    p: ['calves'], s: [] },
  { id: 'single-leg-calf',   name: 'Single-Leg Calf Raise',    eq: 'bodyweight', p: ['calves'], s: [] },

  // ---- Back ----
  { id: 'lat-pulldown',      name: 'Lat Pulldown',             eq: 'cable',      p: ['back'], s: ['biceps'],        why: 'The width-builder — control the negative and let the lats stretch at the top.' },
  { id: 'seated-row',        name: 'Seated Cable Row',         eq: 'cable',      p: ['back'], s: ['biceps'],        why: 'Mid-back thickness and posture — squeeze the shoulder blades together.' },
  { id: 'deadlift',          name: 'Deadlift',                 eq: 'barbell',    p: ['back'], s: ['glutes', 'hamstrings'], why: 'The whole posterior chain in one lift — nothing builds full-body strength faster.' },
  { id: 'bent-over-row',     name: 'Bent-Over Row',            eq: 'barbell',    p: ['back'], s: ['biceps'] },
  { id: 'dumbbell-row',      name: 'Dumbbell Row',             eq: 'dumbbell',   p: ['back'], s: ['biceps'] },
  { id: 'pull-up',           name: 'Pull-Up',                  eq: 'bodyweight', p: ['back'], s: ['biceps'] },
  { id: 'chin-up',           name: 'Chin-Up',                  eq: 'bodyweight', p: ['back'], s: ['biceps'] },
  { id: 'chest-supported-row',name:'Chest-Supported Row',      eq: 'machine',    p: ['back'], s: ['biceps'] },
  { id: 't-bar-row',         name: 'T-Bar Row',                eq: 'barbell',    p: ['back'], s: ['biceps'] },
  { id: 'machine-row',       name: 'Machine Row',              eq: 'machine',    p: ['back'], s: ['biceps'] },
  { id: 'straight-arm-pd',   name: 'Straight-Arm Pulldown',    eq: 'cable',      p: ['back'], s: [] },
  { id: 'inverted-row',      name: 'Inverted Row',             eq: 'bodyweight', p: ['back'], s: ['biceps'] },

  // ---- Chest ----
  { id: 'bench-press',       name: 'Bench Press',              eq: 'barbell',    p: ['chest'], s: ['triceps', 'shoulders'], why: 'The benchmark press — steady 5 lb jumps here carry your whole upper body.' },
  { id: 'db-bench',          name: 'Dumbbell Bench Press',     eq: 'dumbbell',   p: ['chest'], s: ['triceps', 'shoulders'], why: 'Deeper stretch and each side works alone — the best barbell alternative.' },
  { id: 'incline-db-press',  name: 'Incline Dumbbell Press',   eq: 'dumbbell',   p: ['chest'], s: ['shoulders', 'triceps'], why: 'Fills in the upper chest for a fuller look.' },
  { id: 'incline-bench',     name: 'Incline Bench Press',      eq: 'barbell',    p: ['chest'], s: ['shoulders', 'triceps'] },
  { id: 'machine-chest-press',name:'Machine Chest Press',      eq: 'machine',    p: ['chest'], s: ['triceps'] },
  { id: 'push-up',           name: 'Push-Up',                  eq: 'bodyweight', p: ['chest'], s: ['triceps', 'shoulders'] },
  { id: 'cable-fly',         name: 'Cable Fly',                eq: 'cable',      p: ['chest'], s: [] },
  { id: 'pec-deck',          name: 'Pec Deck',                 eq: 'machine',    p: ['chest'], s: [] },
  { id: 'db-fly',            name: 'Dumbbell Fly',             eq: 'dumbbell',   p: ['chest'], s: [] },
  { id: 'dip',               name: 'Dip',                      eq: 'bodyweight', p: ['chest'], s: ['triceps'] },

  // ---- Shoulders ----
  { id: 'lateral-raise',     name: 'Lateral Raise',            eq: 'dumbbell',   p: ['shoulders'], s: [],           why: 'The side-delt builder — light weight, strict form, this is what makes shoulders pop.' },
  { id: 'overhead-press',    name: 'Overhead Press',           eq: 'barbell',    p: ['shoulders'], s: ['triceps', 'core'], why: 'The strength anchor for shoulders — everything overhead starts here.' },
  { id: 'seated-db-press',   name: 'Seated Dumbbell Press',    eq: 'dumbbell',   p: ['shoulders'], s: ['triceps'],  why: 'Overhead pressing with a friendlier setup and a deeper range.' },
  { id: 'cable-lateral',     name: 'Cable Lateral Raise',      eq: 'cable',      p: ['shoulders'], s: [] },
  { id: 'face-pull',         name: 'Face Pull',                eq: 'cable',      p: ['shoulders'], s: ['back'] },
  { id: 'rear-delt-fly',     name: 'Rear Delt Fly',            eq: 'dumbbell',   p: ['shoulders'], s: ['back'] },
  { id: 'reverse-pec-deck',  name: 'Reverse Pec Deck',         eq: 'machine',    p: ['shoulders'], s: ['back'] },
  { id: 'arnold-press',      name: 'Arnold Press',             eq: 'dumbbell',   p: ['shoulders'], s: ['triceps'] },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', eq: 'machine', p: ['shoulders'], s: ['triceps'] },
  { id: 'front-raise',       name: 'Front Raise',              eq: 'dumbbell',   p: ['shoulders'], s: [] },
  { id: 'upright-row',       name: 'Upright Row',              eq: 'barbell',    p: ['shoulders'], s: ['biceps'] },

  // ---- Biceps ----
  { id: 'db-curl',           name: 'Dumbbell Curl',            eq: 'dumbbell',   p: ['biceps'], s: [],              why: 'The staple — full supination, no swinging, let the biceps do all of it.' },
  { id: 'hammer-curl',       name: 'Hammer Curl',              eq: 'dumbbell',   p: ['biceps'], s: [],              why: 'Neutral grip adds the brachialis for thicker-looking arms.' },
  { id: 'cable-curl',        name: 'Cable Curl',               eq: 'cable',      p: ['biceps'], s: [] },
  { id: 'barbell-curl',      name: 'Barbell Curl',             eq: 'barbell',    p: ['biceps'], s: [] },
  { id: 'ez-bar-curl',       name: 'EZ-Bar Curl',              eq: 'barbell',    p: ['biceps'], s: [] },
  { id: 'incline-db-curl',   name: 'Incline Dumbbell Curl',    eq: 'dumbbell',   p: ['biceps'], s: [] },
  { id: 'preacher-curl',     name: 'Preacher Curl',            eq: 'machine',    p: ['biceps'], s: [] },
  { id: 'concentration-curl',name: 'Concentration Curl',       eq: 'dumbbell',   p: ['biceps'], s: [] },

  // ---- Triceps ----
  { id: 'triceps-pushdown',  name: 'Triceps Pushdown',         eq: 'cable',      p: ['triceps'], s: [],             why: 'The bread-and-butter — elbows pinned, full lockout squeeze.' },
  { id: 'overhead-extension',name: 'Overhead Triceps Extension', eq: 'dumbbell', p: ['triceps'], s: [],             why: 'Overhead position stretches the long head — the part that adds real size.' },
  { id: 'skull-crusher',     name: 'Skull Crusher',            eq: 'barbell',    p: ['triceps'], s: [] },
  { id: 'cable-overhead-ext',name: 'Cable Overhead Extension', eq: 'cable',      p: ['triceps'], s: [] },
  { id: 'close-grip-bench',  name: 'Close-Grip Bench Press',   eq: 'barbell',    p: ['triceps'], s: ['chest'] },
  { id: 'triceps-dip',       name: 'Bench Dip',                eq: 'bodyweight', p: ['triceps'], s: ['chest'] },
  { id: 'db-kickback',       name: 'Triceps Kickback',         eq: 'dumbbell',   p: ['triceps'], s: [] },

  // ---- Core ----
  { id: 'plank',             name: 'Plank',                    eq: 'bodyweight', p: ['core'], s: [],                why: 'Anti-movement is the core’s real job — build time before adding weight.' },
  { id: 'cable-crunch',      name: 'Cable Crunch',             eq: 'cable',      p: ['core'], s: [],                why: 'Loaded ab flexion you can actually progress week to week.' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise',        eq: 'bodyweight', p: ['core'], s: [] },
  { id: 'ab-wheel',          name: 'Ab Wheel Rollout',         eq: 'bodyweight', p: ['core'], s: [] },
  { id: 'dead-bug',          name: 'Dead Bug',                 eq: 'bodyweight', p: ['core'], s: [] },
  { id: 'russian-twist',     name: 'Russian Twist',            eq: 'dumbbell',   p: ['core'], s: [] },
  { id: 'side-plank',        name: 'Side Plank',               eq: 'bodyweight', p: ['core'], s: [] },
  { id: 'pallof-press',      name: 'Pallof Press',             eq: 'cable',      p: ['core'], s: [] },
  { id: 'back-extension',    name: 'Back Extension',           eq: 'bodyweight', p: ['core'], s: ['glutes', 'hamstrings'] },
  { id: 'crunch',            name: 'Crunch',                   eq: 'bodyweight', p: ['core'], s: [] },
];

const DEFAULT_TEMPLATES = [
  { id: 'tpl-leg',  name: 'Leg Day',  exerciseIds: ['hip-thrust', 'back-squat', 'rdl', 'hip-abduction', 'standing-calf'] },
  { id: 'tpl-push', name: 'Push Day', exerciseIds: ['bench-press', 'seated-db-press', 'incline-db-press', 'lateral-raise', 'triceps-pushdown'] },
  { id: 'tpl-pull', name: 'Pull Day', exerciseIds: ['lat-pulldown', 'seated-row', 'face-pull', 'db-curl', 'rear-delt-fly'] },
];

const EQUIPMENT_NAMES = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable',
  bodyweight: 'Bodyweight', smith: 'Smith machine', band: 'Band', kettlebell: 'Kettlebell',
};
