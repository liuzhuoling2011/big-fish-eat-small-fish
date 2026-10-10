# 大鱼吃小鱼（꼬기꼬기 HTML 复刻）

基于 4399 Flash `1876` / KeBi Kids **꼬기꼬기** 的 HTML5 Canvas 重制版。

- 玩法与数值对齐原版 SWF（惯性、长大、得分、10 条鱼、通关 `f_size > 250`）
- 鱼贴图与音效从原版 SWF 用 JPEXS FFDec / DefineSound 提取
- 支持键盘方向键 / WASD、触屏跟随；Shift 加速

## 在线玩

https://liuzhuoling2011.github.io/big-fish-eat-small-fish/

## 本地

用任意静态服务器打开 `index.html`（需能加载 `assets/`）。

## 资源

- `assets/fish/` — 玩家与 8 种 NPC 原版矢量栅格帧
- `assets/sfx/` — `Eat2` / `gulp0–3` / `bonk` / `flash` / `gamewin` / `gameLost` / `_splash` / `_koi` 等
