# 大鱼吃小鱼 — 꼬기꼬기（HTML5 重制）

按 4399 flash/1876 原版 Flash（KeBi Kids **꼬기꼬기**）画面与 HUD 用 Canvas 重制。

玩法数值已从原版 SWF（CWS Flash 6 / AVM1）反汇编还原，详见仓库外分析笔记；核心公式：

- 玩家初始 `f_size = 15`，吃掉更小的鱼：`f_size += fishsize/75`，得分 `fishsize*6`
- 敌鱼大小 `random(39+int(min(f_size,100)/3))+5`，速度 `(random(6)-3)*(1.1+min(f_size,150)/300)`
- 惯性 `DRAG=0.93`，方向键加速度 `swimspeed=0.25`（Shift 加速 0.5）
- `f_size > 250` 通关；3 条命

## 打开方式

- GitHub Pages：https://liuzhuoling2011.github.io/big-fish-eat-small-fish/
- 本地：打开 `index.html`，或 `python3 -m http.server`

## 操作

方向键 / WASD 游动（原版手感）；触屏/鼠标跟随（手机）；Shift 加速。
