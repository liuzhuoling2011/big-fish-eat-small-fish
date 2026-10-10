# Remake notes — 꼬기꼬기 / 大鱼吃小鱼

## Phase 1 — pixel-faithful (vs `historical_20050731_7.swf`)

Matched / improved:
- **SCORE digits**: SWF `DefineSprite_384` frames 1–10 → bitmap font `assets/ui/digits/score/0–9.png`.
- **TIME digits**: SWF `DefineSprite_396` 7-seg yellow digits + colon → `assets/ui/digits/timer/`.
- **bg-bubbles**: SWF shape `300` bubble field.
- **Seabed strips** + gold frame SVG shape `337`.
- **eat_mc popup**: `DefineSprite_25` digits + shape `14` `!!` + eaten-fish still; timeline fade-in/rise matches 15f @30fps.
- **SFX**: eat = `Eat2` only (SWF `SFXburp`), WebAudio buffers, leading silence trimmed; flash / splash / sploosh / win / lose.

## Phase 2 — HD / hi-DPI

- Assets at **3×** (SVG→PNG via cairosvg where possible).
- Canvas **devicePixelRatio-aware** (cap 3): logical 640×480.

## Phase 3 — mobile feel

- **Eat SFX latency**: Web Audio `AudioBuffer` one-shots (no HTMLAudio restart lag); unlock on first gesture; trimmed Eat2 leading silence; removed 40ms gulp `setTimeout`.
- **Virtual joystick** (touch / coarse pointer / maxTouchPoints): HTML overlay in the letterbox margin (below stage in portrait, left of stage in landscape); never drawn on the playfield canvas; maps to same arrow accel as keyboard.

## Remaining gaps

- Fish / seabed props are upscaled bitmaps, not full per-shape SVG redraws.
- Title Chinese subtitle is remake-only.
- Help panel still original Korean art + Chinese caption.
- `eat_mc` fish uses NPC still (not exact `_currentframe` swim frame).
- Trail-bubble `bonk` mapped to Y clamp.

## Sources

- SWF: `/workspace/4399-1876/downloader-trial/results/historical_20050731_7.swf`
- FFDec SVG / sprites under `/workspace/4399-1876/`
