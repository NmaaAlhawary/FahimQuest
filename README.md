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
