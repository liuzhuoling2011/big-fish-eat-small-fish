# 大鱼吃小鱼（꼬기꼬기 HTML remake）

4399 Flash #1876 / KeBi Kids **꼬기꼬기** 的现代 HTML5 复刻。

- 试玩：https://liuzhuoling2011.github.io/big-fish-eat-small-fish/
- 打开或刷新即进入对局，不再经过「开始游戏」。资源仍为 WebP + 分阶段加载。
- 浏览器若拦截自动播放，对局照常开始；首次按键、点击或触摸后再出声。
- 触屏左下角虚拟摇杆；键鼠：方向键 / WASD。

## 本地打开

用任意静态服务器打开目录根（不要直接 `file://`，以免音频受限）：

```bash
python3 -m http.server 8080
```

## 资源

`assets/` 下为压缩后的 WebP / MP3。原始 SWF 提取与调试截图在开发机 `qa/`（不部署）。
