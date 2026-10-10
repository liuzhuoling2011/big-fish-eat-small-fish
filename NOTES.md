# Remake notes — 꼬기꼬기 / 大鱼吃小鱼

## Phase 1 — pixel-faithful (vs `historical_20050731_7.swf`)

Matched / improved:
- **SCORE digits**: SWF `DefineSprite_384` frames 1–10 → bitmap font `assets/ui/digits/score/0–9.png` (no system font overlay).
- **TIME digits**: SWF `DefineSprite_396` 7-seg yellow digits + colon → `assets/ui/digits/timer/`.
- **bg-bubbles**: SWF shape `300` bubble field extracted (blue fill cleared) and drawn behind chrome.
- **Seabed strips**: lightened dark silhouettes + soft top alpha to remove hard seam; props kept.
- **Gold frame**: FFDec SVG shape `337` with inner playfield punched transparent; screw corners preserved; border pad uses 22/422 ratio.
- **SFX**: `bonk` on Y-bound clamp; `_sploosh` on final death before `gameLost`; `splash` on start; eat/gulp/flash unchanged.
- **HUD logo / plaque / clock**: blank LCD bands on plaque/clock so live bitmap digits show; logo from `DefineSprite_353`.

## Phase 2 — HD / hi-DPI

- Assets rebuilt at **3×** where possible: SVG→PNG via cairosvg (`export.zoom` alone did not enlarge sprite PNGs), else LANCZOS/NEAREST upscale of FFDec bitmaps.
- Digit fonts: score = NEAREST 3× of SWF bitmaps (crisp pixels); timer = SVG raster 3×.
- Canvas is **devicePixelRatio-aware** (`applyDpr`, cap 3): logical stage stays **640×480**, backbuffer is `640*dpr × 480*dpr`, CSS size unchanged; stage still letterboxed with CSS scale.
- Draw calls use **logical on-screen sizes** so HD textures stay sharp when downscaled by the browser compositor.

## Remaining gaps

- Fish / seabed props are upscaled bitmaps, not full SVG redraws of every shape (outlines slightly softer than true vector at extreme zoom).
- Title “대鱼吃小鱼” Chinese subtitle is remake-only (not in SWF).
- Help panel still original Korean art + Chinese caption line.
- Trail-bubble `bonk` in SWF fires on bubble wrap; remake maps bonk to Y clamp (clearer feedback).
- Eat popup still canvas text (SWF `eat_mc` digit clips not wired).

## Sources

- SWF: `/workspace/4399-1876/downloader-trial/results/historical_20050731_7.swf`
- FFDec SVG: `/workspace/4399-1876/ffdec-svg`, sprites `/workspace/4399-1876/ffdec-sprite-svg`
- Ruffle refs: `/workspace/ruffle-shots/`
