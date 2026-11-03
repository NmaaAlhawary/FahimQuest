# Fahim Code Quest — مغامرة فهيم البرمجية

Offline, bilingual (English / عربي) block-coding game. Kids program Fahim the robot through 12 levels that teach 6 concepts, plus a Free Build mode.

| # | Concept | Levels | What forces the idea |
|---|---------|--------|----------------------|
| 1 | Positions (x, y) | Treasure Map, Star Hunter | only `go to (x, y)` is available |
| 2 | Sequences | First Steps, Zig-Zag Road | order of move/turn blocks |
| 3 | Loops | Long Tunnel, Staircase | block limit (2 and 5) |
| 4 | Variables | Magic Box, Snail Spiral | starter program; fix/grow the `steps` box |
| 5 | Conditions | Puddle Road, Maze Runner | 3 different roads must pass with ONE program |
| 6 | Functions | Hop Dance, Flower Beds | must use `my_move()`; block limit |

Each concept opens with a card: plain explanation, real-life example, real Python, and an **unplugged teacher activity**.
A live "See the real code (Python)" panel shows what the blocks mean.

## Cube Island (3D world) — جزيرة المكعبات
`world.js` adds a 3D block world on top of the levels (three.js r128, vendored in `vendor/` so it still works offline).

- 7 islands: one per concept, plus the Workshop. Each concept island has 2 glowing crystals, one for each of its levels. Walk up and press **E** (or tap **▶ Play**).
- Finish both levels on an island and a bridge pops in to the next one. Locked bridges show as ghost blocks with a 🔒 sign. Fahim can't swim, and walking onto a locked island sends him back.
- Quest card + compass arrow point to the next unfinished challenge. 18 💎 energy cubes are hidden around the islands.
- Build and break blocks (hotbar: ✋ walk, ⛏️ break, 6 block types). Quest blocks (crystals, bridges) are protected. Building is only allowed on land, up to 4 blocks high.
- The Workshop has the Free Build station and a trophy that lights up when all 12 levels are done.
- Controls: WASD/arrows, Space, drag to look, wheel to zoom, 1–6 / Q / H. On touch screens: joystick + jump button.
- Saved in localStorage: `fcq:world:edits`, `world:built`, `world:gems`, `world:pos`.

## Run
No install, no internet. Open `index.html` directly, or:

```
cd ~/Desktop/projects/Fahim-Code-Quest
python3 -m http.server 5204 --bind 127.0.0.1
```
→ http://localhost:5204

## Edit levels
All levels are in `levels.js`. Map legend: `.` empty, `#` wall, `*` star, `~` water, `G` flag, `S` start (faces east). Top row = highest y.
Progress, programs and the Free Build map are saved in the browser (localStorage).
