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
`world.js` + `world-tasks.js` add a 3D block world with its own story tasks (three.js r128, vendored in `vendor/` so it works offline). The 12 levels on the home page are separate.

- 7 islands: one per concept, plus the Workshop with the trophy. Each concept island has **one** crystal with **one** story task, played right on the island:
  | Island | Task | Idea forced by |
  |---|---|---|
  | Positions | 🏴‍☠️ carry the treasure chest to the boat | only `go to (x, y)` |
  | Sequences | 🍊 deliver the orange crate to the stall | order of steps |
  | Loops | 🐪 carry water 8 steps to the camels | 4-block limit |
  | Variables | ⛄ fix the `steps` box to reach the snowman | starter program |
  | Conditions | 💎 sort red/blue gem boxes (3 boxes, one program) | 3 trials |
  | Functions | 🏮 place a crystal on 3 lamps with `my_move()` | must use the function + 9-block limit |
- In a task, the camera locks onto the task area, Fahim says the mission in a speech bubble, and the code blocks sit in a bar at the bottom. Solving the task builds the bridge to the next island.
- Also: 18 💎 energy cubes, block building/breaking (quest blocks are protected), a quest card and compass, and touch controls.
- Edit tasks in `world-tasks.js`. Saved in localStorage: `fcq:world:done`, `world:prog:<concept>`, `world:edits`, `world:built`, `world:gems`, `world:pos`.

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
