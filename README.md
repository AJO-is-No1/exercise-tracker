# Exercise Tracker

A personal training log and day-by-day planner for iPhone, installed as a home-screen web app. It logs Muay Thai training, sparring, grappling, weightlifting, home workouts and a daily ab workout, and recommends what to do on days without Muay Thai or grappling.

## How the plan works
- Your **usual week** (Settings) says which days you do Muay Thai, sparring and grappling. Change any single day from the Plan tab.
- Days without fight training get a **weightlifting session** (Lift A/B/C in rotation), or the **home workout** when you mark "no gym" for that day.
- At least **2 rest days** a week (adjustable, minimum 2). The ab workout doesn't stop a day counting as rest.
- At most **3 lifting/home sessions** a week, never two days running, and never on a fight-training day unless you choose "Train" for that day.
- Rest is placed after the week's hardest session (sparring, or the last Muay Thai day) where possible.
- The plan updates as you log. A past day with nothing logged counts as rest.

## Sources
- `js/routines.js` holds everything the app recommends, and says where each part comes from.
- Lift A/B/C, progression (+5 kg squat/deadlift, +2.5 kg bench/OHP; back off ~10% after two stalled sessions), escape valve and deloads: `Integrated_Training_Program.docx` sections 5, 6 and 8. Face pulls were added to Lift B and C to match section 3.3.
- Home workout: `15min_protean_bodyweight_routine.md`.
- Ab workout and accessory double progression: general knowledge, not from the source review.
- First-session weights: 90% of the 5-rep weight implied by the July 2026 estimated 1RMs (editable in Settings).

## Files
- `index.html`, `css/app.css`, `js/app.js`: the app. Plain HTML/CSS/JS, no build step.
- `js/planner.js`: the weekly planner, lifting progression and 1RM estimates (no DOM code).
- `js/routines.js`: routines and programme rules.
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support.
- `tools/serve.ps1`: local test server. `tools/make-icons.ps1`: regenerates the icons.

## Run it locally
```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 8766
```
Then open http://localhost:8766.

## Data
Everything you log is stored only in the phone's local storage for this app. Nothing is uploaded. Use **Settings → Export backup** now and then; **Export CSV** gives a spreadsheet-friendly copy.
