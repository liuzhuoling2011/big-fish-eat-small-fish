# SWF logic findings — 4399 flash/1876 (꼬기꼬기 / KeBi Kids)

Source binary: `downloader-trial/results/historical_20050731_7.swf`  
(CWS Flash 6, zlib-compressed; decompressed to `swf_decomp.bin`)  
Sibling `live_20160223_game.swf` is effectively the same game payload.

Analysis method: Python CWS decompress → SWF tag walk → AVM1 disassembly of all
DoAction / DoInitAction / DefineSprite nested DoAction blocks (`avm1/action_*.txt`).
Primary game scripts: `action_059` (root `init` / timer / HUD), `action_060` &
`action_061` (sprite 355 enterFrame: move / spawn / collide), `action_073` (`life.reduce`).

REA `open_binary` was **not** used (MCP schema failure on this SWF).

---

## Stage / timeline

| Property | Value | Evidence |
|----------|-------|----------|
| Signature | CWS v6 | header bytes |
| Stage | **550×400** px (twips 0,0–11000,8000) | SWF RECT |
| Frame rate | **30 fps** | header |
| Main timeline frames | 17 | header |
| Frame labels | `2004_go`, `title`, `help`, `main`, `gameOver` | FrameLabel tags |
| Background | `#ffffff` | SetBackgroundColor |
| Exports (SFX / clips) | `bonk`, `_eat.wav`, `_koi.wav`, `_splash.wav`, `_sploosh.wav`, `gulp0`–`gulp3`, `gamewin`, `gameLost`, `Eat2`, `flash`, `eat_mc`, … | ExportAssets |

Note: gameplay still uses X values up to **640** for off-side respawn and wrap band
**80…450**, Y band **70…360** — i.e. logic space is slightly wider than the declared
stage RECT (common in Flash). Remake maps these into the gold-frame playfield.

---

## Init (`init()` in action_059)

```actionscript
cTime = 0;
score = 0;
xmove = 0;
ymove = 7;          // initial downward drift
swimspeed = 3;      // overwritten every enterFrame to 0.25 (see Movement)
f_swimming = 0;
f_size = 15;        // player scale (_xscale/_yscale)
qual = 1;
isReady = 1;
fishy._xscale = f_size;
fishy._yscale = f_size;
fishsize = [];
fishspeed = [];

for (i = 1; i <= 10; i++) {
  fish = this["fish" + i];
  rSize = (f_size < 100) ? f_size : 100;
  fishsize[i] = random(39 + int(rSize / 3)) + 5;
  fish._xscale = fishsize[i];
  fish._yscale = fishsize[i];

  rSpd = (f_size < 150) ? f_size : 150;
  fishspeed[i] = (random(6) - 3) * (1.1 + rSpd / 300);
  if (fishspeed[i] == 0) fishspeed[i] = 2;

  if (fishspeed[i] > 0) {
    fish._x = -90;
    fish._xscale = fishsize[i];          // face right
  } else {
    fish._x = 640;
    fish._xscale = -fishsize[i];         // face left
  }
  fish._y = 95 + random(240);
  fish.gotoAndStop(int(fishsize[i] / 8) + 1);  // appearance frame 1..10
}

Mouse.hide();
SFXsplash.start(0, 1);
cTime = 0;
myTimer = setInterval(refreshTimer, 1000);
```

Bytecode refs: `action_059.txt` offsets `0192`–`04C5`.

---

## Enemy size & speed (respawn uses the same formulas)

When a fish leaves the field (`_x > 650` or `_x < -100`), it is re-rolled:

```actionscript
rSize = min(f_size, 100);
fishsize[i] = random(39 + int(rSize / 3)) + 5;

rSpd = min(f_size, 150);
fishspeed[i] = (random(6) - 3) * (1.1 + rSpd / 300);
if (fishspeed[i] == 0) fishspeed[i] = 2;
// then same left/right place as init; y = 95 + random(240)
// gotoAndStop(int(fishsize/8)+1)
```

### Numeric ranges

| Player `f_size` | `rSize` | Enemy `fishsize` | Frame `int(sz/8)+1` | `rSpd` | Speed factor `(1.1+rSpd/300)` | `fishspeed` steps |
|-----------------|--------|------------------|---------------------|--------|-------------------------------|-------------------|
| 15 (start) | 15 | **5…48** | 1…7 | 15 | 1.15 | (−3…+2)×1.15, 0→2 |
| 100+ | 100 | **5…76** | 1…10 | ≤150 | ≤1.60 | (−3…+2)×factor, 0→2 |
| 150+ | 100 | 5…76 | 1…10 | 150 | 1.60 | same |

There are always **10** concurrent NPC fish (`fish1`…`fish10`).

---

## Movement (action_060 / action_061, ~30 fps)

```actionscript
DRAG = 0.93;
ymove *= DRAG;
xmove *= DRAG;

// Every frame swimspeed is forced to 0.25, unless Shift(16)+item_turbo → 0.5
// (twisted Key.isDown(16) control flow still lands on 0.25 when Shift up)
swimspeed = 0.25; // normal
// swimspeed = 0.5; // turbo

if (Key.isDown(37)) { fishy._xscale = -f_size; xmove -= swimspeed; f_swimming = 1; } // Left
if (Key.isDown(39)) { fishy._xscale =  f_size; xmove += swimspeed; f_swimming = 1; } // Right
if (Key.isDown(38)) { ymove -= swimspeed; f_swimming = 1; } // Up
if (Key.isDown(40)) { ymove += swimspeed; f_swimming = 1; } // Down

fishy._x += xmove;
if (fishy._x > 450) fishy._x = 80;   // horizontal wrap
if (fishy._x < 80)  fishy._x = 450;
if (fishy._y + ymove < 360 && fishy._y + ymove > 70)
  fishy._y += ymove;
else
  ymove = 0;

// NPCs
for (i = 1; i <= 10; i++)
  this["fish"+i]._x += fishspeed[i];
```

Steady-state |xmove| ≈ `swimspeed / (1-0.93)` ≈ **3.57 px/frame** ≈ **107 px/s** at 30 fps
(normal); ≈ **214 px/s** with turbo 0.5.

Init `ymove = 7` gives a brief downward coast at start.

Bubbles (3): trail from mouth; rise by `2 + i/4` per frame; recycle when `_y < -10`.

---

## Eat / die / win (action_061)

Collision: up to **6** hit points `p1…p6` on each NPC, `localToGlobal`, then
`fishy.hitTest(x, y, true)`.

```actionscript
if (isHit) {
  if (f_size > fishsize[i]) {
    // EAT
    SFXburp.start();
    fishy.gotoAndPlay(7);          // chomp anim
    mc._x = 700;                   // park offscreen (respawn next loop)
    f_size += fishsize[i] / 75;
    fishy._xscale = f_size;
    fishy._yscale = f_size;
    bonusScore = fishsize[i] * 6;
    score += bonusScore;
    refreshInfo();
    if (f_size > 250) {
      _root.isClear = 1;
      gotoAndStop("gameOver");     // win path (gameWin SFX on over frame)
    }
    // attachMovie eat_mc popup showing bonus digits
  } else {
    // HURT — only when f_size <= fishsize (strictly not greater)
    life.reduce();
  }
}
```

**Equal size does not eat** (`>` required). No “bounce” branch in bytecode.

### `life.reduce()` (action_073)

```actionscript
// on load: num = 1; flash_sound = new Sound(this); attachSound("flash");
function reduce() {
  this["icon" + num].play();
  if (num == 4) {
    stopAllSounds();
    _parent.gotoAndStop("gameOver");
    flash_sound.start();
    _parent.fishy.gotoAndPlay("hit");
  }
  num = num + 1;
}
```

UI shows **3** life icons; `num` starts at 1; game over when `reduce` runs with `num == 4`
(fourth hit). Remake exposes this as **3 lives** (game over when lives reach 0 after three
hits), matching on-screen icons / Ruffle HUD shots.

---

## Score & timer HUD

- **Score**: integer; digit MovieClips on `score_mc`; `bonusScore = fishsize * 6` per eat.
  Cap display path uses `scoreTemp % 100000` if `> 999999`.
- **Timer**: `setInterval(refreshTimer, 1000)` → `cTime++` once per second.
  Displayed as `h : mm : ss` with `h = int(cTime/3600)`, etc. (alarm-clock art).
- Game-over frame (`action_074`): `Mouse.show()`, `clearInterval(myTimer)`, play
  `gameWin` or `gameLost` from `_root.isClear`, show final score on `gg_mc`.

---

## Controls (original)

| Input | Role |
|-------|------|
| Arrow Left/Right/Up/Down (37/39/38/40) | Accelerate (`±swimspeed` into `xmove`/`ymove`) |
| Shift (16) + `item_turbo==1` | `swimspeed = 0.5` instead of `0.25` |
| Mouse | Hidden during play (`Mouse.hide`); not used for steering in these scripts |

Remake additionally keeps **WASD**, **pointer/touch follow**, and **Shift turbo** so phones
and the existing UI still work, while arrow physics match the SWF drag model.

---

## Win / lose

| Condition | Result |
|-----------|--------|
| `f_size > 250` | `_root.isClear = 1` → gameOver frame → `gameWin` |
| `life.num == 4` on reduce | gameOver frame → `gameLost` |

Growth from 15 → 250 requires eating a large total of `fishsize` units
(`Δ = fishsize/75` each eat). Roughly on the order of hundreds of eats depending on prey size.

---

## Constants cheat-sheet (for remake)

```
FPS                 30
STAGE               550 x 400
f_size_start        15
f_size_win          250
NPC_COUNT           10
fishsize            random(39 + int(min(f_size,100)/3)) + 5
fishspeed           (random(6)-3) * (1.1 + min(f_size,150)/300) ; 0 → 2
fish_frame          int(fishsize/8) + 1
spawn_x             -90 (right-going) or 640 (left-going)
spawn_y             95 + random(240)
offscreen_respawn   x > 650 or x < -100
WRAP_X              80 ↔ 450
CLAMP_Y             70 … 360
DRAG                0.93 / frame
swimspeed_normal    0.25 / frame
swimspeed_turbo     0.5 / frame
grow                f_size += fishsize / 75
score_gain          fishsize * 6
eat_rule            f_size > fishsize
timer_tick_ms       1000
lives_icons         3 (game over on 4th hit in SWF num scheme)
```

---

## Files produced

- `swf_decomp.bin` — full decompressed SWF
- `avm1/action_XXX.txt` — raw AVM1 disassembly (89 blocks)
- `avm1/decompiled_059/060/061/074.as.txt` — stack decompiler drafts (imperfect CallMethod;
  formulas above verified against raw Push/op sequences)
