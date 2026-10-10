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

## Phase 4 — polish (2026-10-10)

- SCORE/TIME: crisp vector 7-seg digits; recessed plaque well (no baked black digit slabs).
- Win screen: proportional gold-frame inner pad; flush 점수+LCD strip; yellow calculator digits; alive vector player fish (no X-eye).
- Lives: vector fish icons (also `assets/ui/life-fish.svg`).
- Fish: prefer canvas vector redraw (`assets/fish/svg/*.svg` references) so large sizes stay sharp.
- Pause/resume control fused left of TIME clock (click / P / Esc).
- Horizontal wrap = full SWF width mapped to gold-frame inner water (`FRAME_PAD_*` / `PLAY`).

## Phase 5 — layout + faithful SVG fish (2026-10-10)

- Gold-frame pads = `gold-frame.webp` hole (73/1100, 73/790); PLAY/clip/water aligned.
- Seabed: dropped `strip-play.webp` nested black mini-frame; vector props flush to PLAY bottom.
- TIME: cover baked blurry label; crisp canvas "TIME"; LCD well fills clock window fractions.
- Game over / win: content clipped to inner panel; score strip + button inset with correct pads.
- Fish: vtracer SVG of original SWF sprites → `assets/fish/svg/` + `svg-raster/*.webp`; draw path prefers these over generic cartoons.
