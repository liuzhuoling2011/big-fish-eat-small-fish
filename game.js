(() => {
  "use strict";

  const W = 640, H = 480;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");

  // Gold frame — thicker candy border; lives in left outer margin
  const FX = 58, FY = 48, FW = 550, FH = 410;
  const BORDER = 16; // candy gold thickness
  const PLAY = {
    x: FX + BORDER,
    y: FY + BORDER + 4,
    w: FW - BORDER * 2,
    h: FH - BORDER * 2 - 8,
  };

  const keys = Object.create(null);
  let pointer = null;
  let pointerDown = false;
  let kbdActive = false; // arrow/WASD held → ignore pointer follow

  let mode = "title"; // title | help | play | over | win
  let score = 0;
  let lives = 3;
  let level = 1;
  let timeSec = 0;
  let playTime = 0;
  let invuln = 0;
  let growFlash = 0;
  let popups = [];
  let bubbles = [];
  let fish = [];
  let player = null;
  let btnHover = null;
  let deathFish = null;
  let shake = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function fitStage() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  window.addEventListener("resize", fitStage);
  fitStage();

  // ─── Original SWF assets (FFDec / DefineSound extract) ───
  const ASSET = {
    ready: false,
    npc: [],   // [type1..8] each = Image[] swim frames
    npcStill: [], // Image[8]
    player: { swim: [], chomp: [], hit: [], idle: null, chompStill: null, hurt: null },
    sfx: {},
    ui: {},
    seabed: {},
  };

  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  function loadAudio(src) {
    const a = new Audio(src);
    a.preload = "auto";
    return a;
  }

  async function loadAssets() {
    const npcStill = [];
    const npc = [];
    for (let t = 1; t <= 8; t++) {
      npcStill.push(await loadImage(`assets/fish/npc/${t}.png`));
      const frames = [];
      for (let f = 1; f <= 4; f++) {
        frames.push(await loadImage(`assets/fish/npc/type${t}/${f}.png`));
      }
      npc.push(frames.filter(Boolean));
    }
    ASSET.npcStill = npcStill;
    ASSET.npc = npc;

    const swim = [], chomp = [], hit = [];
    for (let i = 1; i <= 6; i++) swim.push(await loadImage(`assets/fish/player/swim/${String(i).padStart(2,"0")}.png`));
    for (let i = 1; i <= 7; i++) {
      chomp.push(await loadImage(`assets/fish/player/chomp/${String(i).padStart(2,"0")}.png`));
      hit.push(await loadImage(`assets/fish/player/hit/${String(i).padStart(2,"0")}.png`));
    }
    ASSET.player.swim = swim.filter(Boolean);
    ASSET.player.chomp = chomp.filter(Boolean);
    ASSET.player.hit = hit.filter(Boolean);
    ASSET.player.idle = await loadImage("assets/fish/player/idle.png");
    ASSET.player.chompStill = await loadImage("assets/fish/player/chomp.png");
    ASSET.player.hurt = await loadImage("assets/fish/player/hurt.png");

    const names = {
      eat: "assets/sfx/Eat2.mp3",
      eatAlt: "assets/sfx/_eat.mp3",
      gulp0: "assets/sfx/gulp0.mp3",
      gulp1: "assets/sfx/gulp1.mp3",
      gulp2: "assets/sfx/gulp2.mp3",
      gulp3: "assets/sfx/gulp3.mp3",
      bonk: "assets/sfx/bonk.mp3",
      splash: "assets/sfx/_splash.wav",
      sploosh: "assets/sfx/_sploosh.mp3",
      flash: "assets/sfx/flash.mp3",
      win: "assets/sfx/gamewin.mp3",
      lose: "assets/sfx/gameLost.mp3",
      bgm: "assets/sfx/_koi.mp3",
    };
    for (const [k, src] of Object.entries(names)) {
      ASSET.sfx[k] = loadAudio(src);
    }
    if (ASSET.sfx.bgm) {
      ASSET.sfx.bgm.loop = true;
      ASSET.sfx.bgm.volume = 0.35;
    }

    // Original SWF chrome (FFDec shapes/sprites/buttons + frame crops)
    const uiFiles = {
      logo: "assets/ui/logo.png",
      logoHud: "assets/ui/logo-hud.png",
      btnStart: "assets/ui/btn-start.png",
      btnStartOver: "assets/ui/btn-start-over.png",
      btnStartDown: "assets/ui/btn-start-down.png",
      btnHelp: "assets/ui/btn-help.png",
      btnHelpOver: "assets/ui/btn-help-over.png",
      btnHelpDown: "assets/ui/btn-help-down.png",
      btnNext: "assets/ui/btn-next.png",
      clock: "assets/ui/clock.png",
      scorePlaque: "assets/ui/score-plaque.png",
      lifeFish: "assets/ui/life-fish.png",
      livesStack: "assets/ui/lives-stack.png",
      goldFrame: "assets/ui/gold-frame.png",
      helpPanel: "assets/ui/help-panel.png",
      gameOver: "assets/ui/game-over.png",
      congratulation: "assets/ui/congratulation.png",
      gameoverScore: "assets/ui/gameover-score.png",
      bgBubbles: "assets/ui/bg-bubbles.png",
      bgWater: "assets/ui/bg-water.png",
    };
    for (const [k, srcPath] of Object.entries(uiFiles)) {
      ASSET.ui[k] = await loadImage(srcPath);
    }
    const seabedFiles = {
      stripTitle: "assets/seabed/strip-title.png",
      stripPlay: "assets/seabed/strip-play.png",
      crab: "assets/seabed/crab.png",
      clam: "assets/seabed/clam.png",
      anemone: "assets/seabed/anemone.png",
      starfish: "assets/seabed/starfish.png",
      coral: "assets/seabed/coral-spotted.png",
      seaweedA: "assets/seabed/seaweed-a.png",
      seaweedB: "assets/seabed/seaweed-b.png",
      seaweedC: "assets/seabed/seaweed-c.png",
      seaweedD: "assets/seabed/seaweed-d.png",
    };
    for (const [k, srcPath] of Object.entries(seabedFiles)) {
      ASSET.seabed[k] = await loadImage(srcPath);
    }

    ASSET.ready = ASSET.npcStill.some(Boolean) && ASSET.player.idle;
  }

  function playSfx(name, { volume = 1, restart = true } = {}) {
    const a = ASSET.sfx[name];
    if (!a) return;
    try {
      if (restart) {
        a.pause();
        a.currentTime = 0;
      }
      a.volume = volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function playEatSfx(fishsize) {
    // SWF: SFXburp.attachSound("eat2"); also has gulp0..3
    playSfx("eat", { volume: 0.9 });
    const g = fishsize < 20 ? "gulp0" : fishsize < 35 ? "gulp1" : fishsize < 55 ? "gulp2" : "gulp3";
    // slight delay so burp/eat stacks like classic
    setTimeout(() => playSfx(g, { volume: 0.7 }), 40);
  }

  function ensureBgm(on) {
    const a = ASSET.sfx.bgm;
    if (!a) return;
    if (on) {
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      a.pause();
    }
  }

  loadAssets();


  function initBubbles() {
    bubbles = [];
    for (let i = 0; i < 32; i++) {
      bubbles.push({
        x: rand(0, W),
        y: rand(0, H),
        r: rand(6, 48),
        vy: rand(-14, -4),
        a: rand(0.14, 0.38),
      });
    }
  }
  initBubbles();

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function drawAsset(img, x, y, w, h) {
    if (!img) return false;
    if (w == null) w = img.width;
    if (h == null) h = img.height;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }

  function drawAssetCentered(img, cx, cy, scale) {
    if (!img) return false;
    scale = scale || 1;
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return true;
  }

  // ─── Outer ambient ───────────────────────────────────────
  function drawOuterBg() {
    ctx.fillStyle = "#015BE6";
    ctx.fillRect(0, 0, W, H);
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${b.a})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${b.a * 0.65})`;
      ctx.fill();
      // thin dark rim on larger bubbles (original style)
      if (b.r > 18) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,40,120,${b.a * 0.35})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // ─── Candy gold frame (original SWF shape, fallback vector) ──
  function drawGoldFrame() {
    const gf = ASSET.ui.goldFrame;
    if (gf) {
      // Water playfield under frame
      ctx.save();
      // Approximate inner rect matching SWF frame bevel (~22px border on 422x303 → scale to FW x FH)
      const padX = FW * (28 / 422), padY = FH * (28 / 303);
      roundRect(FX + padX, FY + padY, FW - padX * 2, FH - padY * 2, 8);
      const wg = ctx.createLinearGradient(0, FY, 0, FY + FH);
      wg.addColorStop(0, "#5CC3FF");
      wg.addColorStop(0.45, "#40AAFF");
      wg.addColorStop(1, "#2A88DD");
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.restore();
      drawAsset(gf, FX, FY, FW, FH);
      return;
    }
    ctx.save();
    const rOut = 22, rIn = 10;
    roundRect(FX - 2, FY - 2, FW + 4, FH + 4, rOut + 2);
    ctx.fillStyle = "#3D2200";
    ctx.fill();
    roundRect(FX, FY, FW, FH, rOut);
    const body = ctx.createLinearGradient(FX, FY, FX, FY + FH);
    body.addColorStop(0, "#FFE456");
    body.addColorStop(0.35, "#FFD01F");
    body.addColorStop(0.7, "#F5B800");
    body.addColorStop(1, "#E0A000");
    ctx.fillStyle = body;
    ctx.fill();
    roundRect(FX + BORDER, FY + BORDER, FW - BORDER * 2, FH - BORDER * 2, rIn);
    const wg = ctx.createLinearGradient(0, FY, 0, FY + FH);
    wg.addColorStop(0, "#5CC3FF");
    wg.addColorStop(0.45, "#40AAFF");
    wg.addColorStop(1, "#2A88DD");
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.restore();
  }

  // ─── Seabed + props (original SWF sprites / strip) ────────
  function drawSeabed(clip) {
    ctx.save();
    if (clip) {
      roundRect(FX + BORDER, FY + BORDER, FW - BORDER * 2, FH - BORDER * 2, 10);
      ctx.clip();
    }
    const left = FX + BORDER;
    const right = FX + FW - BORDER;
    const baseY = FY + FH - BORDER - 2;
    const strip = ASSET.seabed.stripPlay || ASSET.seabed.stripTitle;
    if (strip) {
      const sh = Math.min(strip.height * ((right - left) / strip.width), FH * 0.28);
      drawAsset(strip, left, baseY - sh + 6, right - left, sh);
      ctx.restore();
      return;
    }
    // Fallback vector seabed
    ctx.beginPath();
    ctx.moveTo(left, baseY + 6);
    ctx.lineTo(left, baseY - 28);
    const pts = [
      [30, -22], [60, -36], [100, -20], [140, -42], [190, -18],
      [240, -34], [290, -16], [340, -38], [390, -20], [440, -30],
      [490, -18], [right - left, -24],
    ];
    for (const [x, dy] of pts) ctx.lineTo(left + x, baseY + dy);
    ctx.lineTo(right, baseY + 6);
    ctx.closePath();
    ctx.fillStyle = "#6B7388";
    ctx.fill();
    drawKelp(left + 28, baseY - 6, 1.55);
    drawKelp(left + 58, baseY - 2, 1.25);
    drawCrab(left + 120, baseY - 4, 1.35);
    drawClam(left + 195, baseY - 2, 1.3);
    drawAnemone(left + 270, baseY - 2, 1.35);
    drawSpottedShell(left + 345, baseY, 1.3);
    drawSmileStar(left + 415, baseY - 2, 1.25);
    drawKelp(right - 55, baseY - 4, 1.4);
    drawKelp(right - 28, baseY - 8, 1.6);
    ctx.restore();
  }

  function drawKelp(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0D3D0D";
    ctx.lineJoin = "round";
    // tall bubbly stalk — stacked rounded lobes with center crease
    const segs = [
      [0, 0, 13, 18], [-5, -20, 14, 20], [4, -42, 13, 19],
      [-3, -64, 12, 18], [3, -84, 11, 16], [-2, -102, 9, 14],
    ];
    for (const [ox, oy, rw, rh] of segs) {
      ctx.fillStyle = "#3ECB45";
      ctx.beginPath();
      ctx.ellipse(ox, oy, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // darker crease
      ctx.strokeStyle = "#1A7A22";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy - rh * 0.6);
      ctx.lineTo(ox - 1, oy + rh * 0.5);
      ctx.stroke();
      ctx.strokeStyle = "#0D3D0D";
      ctx.lineWidth = 3;
      // highlight
      ctx.fillStyle = "rgba(180,255,160,0.35)";
      ctx.beginPath();
      ctx.ellipse(ox - rw * 0.35, oy - rh * 0.15, rw * 0.28, rh * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrab(x, y, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    // body
    ctx.fillStyle = "#E53935";
    ctx.beginPath();
    ctx.ellipse(0, 2, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // claws raised
    ctx.beginPath();
    ctx.ellipse(-24, -10, 10, 8, -0.6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(24, -10, 10, 8, 0.6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // claw tips
    ctx.beginPath();
    ctx.arc(-28, -16, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(28, -16, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // googly eyes looking UP
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-7, -12, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(7, -12, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(-6, -15, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -14, 3.2, 0, Math.PI * 2); ctx.fill();
    // smile
    ctx.beginPath();
    ctx.arc(0, 4, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // legs
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#C62828";
    for (let i = 0; i < 3; i++) {
      const ox = -12 + i * 4;
      ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(ox - 18, 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, 10); ctx.lineTo(-ox + 18, 22); ctx.stroke();
    }
    ctx.restore();
  }

  function drawClam(x, y, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    // wavy shell body
    ctx.fillStyle = "#6B9AC4";
    ctx.beginPath();
    ctx.moveTo(-26, 6);
    ctx.quadraticCurveTo(-30, -8, -18, -16);
    ctx.quadraticCurveTo(-8, -22, 0, -14);
    ctx.quadraticCurveTo(8, -22, 18, -16);
    ctx.quadraticCurveTo(30, -8, 26, 6);
    ctx.quadraticCurveTo(0, 14, -26, 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // dark opening
    ctx.fillStyle = "#0A0A18";
    ctx.beginPath();
    ctx.ellipse(0, -2, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes peering out
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-6, -4, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, -4, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(-5, -4, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -3, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawAnemone(x, y, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    // bumpy round body
    ctx.fillStyle = "#FF8A1A";
    ctx.beginPath();
    ctx.ellipse(0, 2, 20, 22, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // lumps
    ctx.fillStyle = "#FF7020";
    for (const [ox, oy, r] of [[-10, 0, 6], [10, 4, 5], [0, 10, 5]]) {
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
    }
    // yellow tentacles on top
    ctx.fillStyle = "#FFD54F";
    for (const [ox, oy] of [[-10, -20], [-2, -26], [8, -22], [14, -16]]) {
      ctx.beginPath();
      ctx.ellipse(ox, oy, 5, 9, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpottedShell(x, y, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#F8F8F8";
    ctx.beginPath();
    ctx.moveTo(-22, 8);
    ctx.quadraticCurveTo(-26, -10, -10, -20);
    ctx.quadraticCurveTo(0, -28, 12, -18);
    ctx.quadraticCurveTo(28, -10, 22, 8);
    ctx.quadraticCurveTo(0, 16, -22, 8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // large irregular black spots
    ctx.fillStyle = "#1A1A1A";
    for (const [sx, sy, sr] of [
      [-8, -6, 5], [6, -10, 4.5], [0, 4, 3.5], [12, 0, 4], [-14, 2, 3.5], [8, 6, 3],
    ]) {
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSmileStar(x, y, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#FF9800";
    // puffy arms
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      ctx.save();
      ctx.translate(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,220,120,0.5)";
    ctx.beginPath();
    ctx.ellipse(-3, -3, 6, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // face — slit eyes + open smile
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-6, -3); ctx.lineTo(-2, -3);
    ctx.moveTo(2, -3); ctx.lineTo(6, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 3, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function puffyStarPath(cx, cy, points, outer, inner) {
    ctx.beginPath();
    const step = Math.PI / points;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * step;
      // soften tips with slight inset
      const soft = i % 2 === 0 ? r * 0.92 : r;
      const x = cx + Math.cos(a) * soft;
      const y = cy + Math.sin(a) * soft;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Extra-puffy starfish: fat elliptical arms + round core
  function drawPuffyStarfish(cx, cy, color, R) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    function body(ox, oy, fillStyle, strokeStyle, lw) {
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lw;
      // 5 long bulbous arms sticking out clearly
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        ctx.save();
        ctx.translate(ox + Math.cos(a) * R * 0.52, oy + Math.sin(a) * R * 0.52);
        ctx.rotate(a);
        ctx.beginPath();
        // tip-rounded sausage
        ctx.moveTo(-R * 0.22, 0);
        ctx.quadraticCurveTo(-R * 0.2, -R * 0.55, 0, -R * 0.62);
        ctx.quadraticCurveTo(R * 0.2, -R * 0.55, R * 0.22, 0);
        ctx.quadraticCurveTo(0, R * 0.12, -R * 0.22, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // round core
      ctx.beginPath();
      ctx.arc(ox, oy, R * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Drop shadow
    body(5, 6, "rgba(0,0,0,0.3)", "rgba(0,0,0,0)", 0);

    // Main
    const g = ctx.createRadialGradient(-R * 0.2, -R * 0.25, R * 0.05, 0, 0, R);
    g.addColorStop(0, lighten(color, 55));
    g.addColorStop(0.45, lighten(color, 12));
    g.addColorStop(1, color);
    body(0, 0, g, "#000", 3.5);

    // Arm highlights (top-left of each arm)
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      const hx = Math.cos(a) * R * 0.62 - 2;
      const hy = Math.sin(a) * R * 0.62 - 3;
      ctx.beginPath();
      ctx.ellipse(hx, hy, R * 0.1, R * 0.18, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(-R * 0.1, -R * 0.12, R * 0.18, R * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();
    ctx.restore();
  }

  function drawStarButton(cx, cy, color, label, hover, which) {
    const isHelp = which === "help" || label === "说明" || label === "도움말";
    const img = hover
      ? (isHelp ? (ASSET.ui.btnHelpOver || ASSET.ui.btnHelp) : (ASSET.ui.btnStartOver || ASSET.ui.btnStart))
      : (isHelp ? ASSET.ui.btnHelp : ASSET.ui.btnStart);
    if (img) {
      const s = hover ? 1.08 : 1;
      drawAssetCentered(img, cx, cy, s * 1.15);
      return;
    }
    const s = hover ? 1.07 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    drawPuffyStarfish(0, 0, color, 58);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "bold 17px Microsoft YaHei, PingFang SC, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  // ─── Logo: heavy block slabs + thick black offset shadow ──
  const LOGO_FONT = '"NanumGothic ExtraBold", NanumGothic, "Noto Sans CJK KR", "Gothic A1", "Microsoft YaHei", sans-serif';

  function drawLogoBlock(text, x, y, size, align) {
    ctx.save();
    ctx.font = `900 ${size}px ${LOGO_FONT}`;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const ox = Math.max(7, Math.round(size * 0.16));
    const oy = Math.max(7, Math.round(size * 0.16));

    // Heavy solid black OFFSET SLAB
    ctx.fillStyle = "#000000";
    for (let dx = 0; dx <= 4; dx++) {
      for (let dy = 0; dy <= 4; dy++) {
        ctx.fillText(text, x + ox + dx, y + oy + dy);
      }
    }

    // White outline via stroke only (keep orange face clean)
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = Math.max(7, size * 0.2);
    ctx.strokeText(text, x, y);

    // Red→orange fill
    const metrics = ctx.measureText(text);
    const tw = metrics.width;
    let gx0 = x;
    if (align === "center") gx0 = x - tw / 2;
    else if (align === "right") gx0 = x - tw;
    const lg = ctx.createLinearGradient(0, y - size * 0.4, 0, y + size * 0.4);
    lg.addColorStop(0, "#FF1A00");
    lg.addColorStop(0.35, "#FF5200");
    lg.addColorStop(0.7, "#FF8A00");
    lg.addColorStop(1, "#FFB84A");
    ctx.fillStyle = lg;
    ctx.fillText(text, x, y);

    // White glint pills
    ctx.fillStyle = "#FFFFFF";
    const glints = Math.min(7, Math.max(3, Math.floor(tw / (size * 0.55))));
    for (let i = 0; i < glints; i++) {
      const gx = gx0 + tw * (0.1 + i * 0.14);
      const gy = y - size * 0.26;
      roundRect(gx, gy, Math.max(4, size * 0.09), Math.max(5, size * 0.15), 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLogo(x, y, scale) {
    drawLogoBlock("꼬기꼬기", x, y, Math.round(32 * (scale || 1)), "left");
  }

  function drawTitleLogo(cx, cy) {
    if (ASSET.ui.logo) {
      drawAssetCentered(ASSET.ui.logo, cx, cy - 4, 1.55);
      ctx.save();
      ctx.font = "bold 18px Microsoft YaHei, PingFang SC, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0A2A5A";
      ctx.strokeText("大鱼吃小鱼", cx, cy + 88);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("大鱼吃小鱼", cx, cy + 88);
      ctx.restore();
      return;
    }
    drawLogoBlock("꼬기꼬기", cx, cy, 62, "center");
    ctx.save();
    ctx.font = "bold 18px Microsoft YaHei, PingFang SC, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0A2A5A";
    ctx.strokeText("大鱼吃小鱼", cx, cy + 50);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("大鱼吃小鱼", cx, cy + 50);
    ctx.restore();
  }

  // ─── SCORE plaque ────────────────────────────────────────
  function drawScorePlaque() {
    const img = ASSET.ui.scorePlaque;
    const pw = img ? Math.max(150, img.width * 1.35) : 150;
    const ph = img ? Math.max(42, img.height * 1.35) : 42;
    const px = FX + FW / 2 - pw / 2;
    const py = FY - ph * 0.55;
    if (img) {
      drawAsset(img, px, py, pw, ph);
      // Overlay live score on LCD band (leave SCORE label intact)
      const lcdY = py + ph * 0.48;
      const lcdH = ph * 0.46;
      roundRect(px + pw * 0.1, lcdY, pw * 0.8, lcdH, 3);
      ctx.fillStyle = "#1A1008";
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${Math.max(13, ph * 0.36)}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(score).padStart(6, "0"), px + pw / 2, lcdY + lcdH / 2 + 1);
      return;
    }
    roundRect(px - 2, py - 2, pw + 4, ph + 4, 8);
    ctx.fillStyle = "#3D2200";
    ctx.fill();
    roundRect(px, py, pw, ph, 7);
    ctx.fillStyle = "#FFD01F";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCORE", px + pw / 2, py + 11);
    roundRect(px + 10, py + 18, pw - 20, 18, 3);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.fillStyle = "#FFEE58";
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillText(String(score).padStart(6, "0"), px + pw / 2, py + 28);
  }

  // ─── TIME alarm clock (original SWF sprite) ──────────────
  function drawTimeClock() {
    const img = ASSET.ui.clock;
    const cx = FX + FW - 4;
    const cy = FY + 8;
    const total = Math.max(0, timeSec);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const cs = Math.floor((total % 1) * 100);
    const tstr = `${m}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;

    if (img) {
      const sc = 1.15;
      const w = img.width * sc, h = img.height * sc;
      const x = cx - w * 0.55, y = cy - h * 0.35;
      drawAsset(img, x, y, w, h);
      // Overlay live time on LCD
      const lcdW = w * 0.55, lcdH = h * 0.16;
      const lcdX = x + w * 0.225, lcdY = y + h * 0.42;
      roundRect(lcdX, lcdY, lcdW, lcdH, 2);
      ctx.fillStyle = "#111";
      ctx.fill();
      ctx.fillStyle = "#FF8C00";
      ctx.font = `bold ${Math.max(9, lcdH * 0.85)}px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tstr, lcdX + lcdW / 2, lcdY + lcdH / 2 + 0.5);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy + 14, 32, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD01F";
    ctx.fill();
    ctx.strokeStyle = "#3D2200";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TIME", cx, cy + 2);
    roundRect(cx - 20, cy + 8, 40, 14, 2);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.fillStyle = "#FF8C00";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText(tstr, cx, cy + 16);
    ctx.restore();
  }

  function drawLives() {
    const icon = ASSET.ui.lifeFish;
    if (icon) {
      for (let i = 0; i < lives; i++) {
        const s = 2.2;
        drawAsset(icon, 12, 88 + i * 48, icon.width * s, icon.height * s);
      }
      return;
    }
    for (let i = 0; i < lives; i++) {
      drawFishSprite(28, 100 + i * 52, 16, 1, "player", false, 0, { player: true });
    }
  }

  // ─── Fish art (original SWF sprites via FFDec PNG) ────
  // Frame 1..8 → art types; SWF can request 9..10 → clamp to 8
  function artTypeForFrame(frame) {
    return clamp(frame | 0, 1, 8);
  }

  function drawFishImage(img, x, y, size, facing, dead, wobble, alpha) {
    if (!img) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing < 0 ? -1 : 1, 1);
    if (dead) ctx.rotate(Math.PI / 2);
    if (wobble) ctx.rotate(Math.sin(wobble) * 0.06);
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    // size ≈ Flash radius-ish; full sprite width ~2.2× that (body+tail)
    const dw = Math.max(8, size * 2.2);
    const dh = dw * (img.height / img.width);
    ctx.drawImage(img, -dw * 0.55, -dh * 0.5, dw, dh);
    ctx.restore();
    return true;
  }

  function pickNpcFrame(artType, wobble) {
    const frames = ASSET.npc[artType - 1];
    if (frames && frames.length) {
      const i = Math.floor(Math.abs(wobble) * 2.2) % frames.length;
      return frames[i];
    }
    return ASSET.npcStill[artType - 1] || null;
  }

  function pickPlayerFrame(dead, chompT, hurtT, wobble) {
    if (dead) return ASSET.player.hurt || ASSET.player.idle;
    if (hurtT > 0 && ASSET.player.hit.length) {
      const i = Math.min(ASSET.player.hit.length - 1, Math.floor((1.2 - Math.min(1.2, hurtT)) / 1.2 * ASSET.player.hit.length));
      return ASSET.player.hit[Math.max(0, i)];
    }
    if (chompT > 0 && ASSET.player.chomp.length) {
      const i = Math.min(ASSET.player.chomp.length - 1, Math.floor((0.35 - Math.min(0.35, chompT)) / 0.35 * ASSET.player.chomp.length));
      return ASSET.player.chomp[Math.max(0, i)];
    }
    if (ASSET.player.swim.length) {
      const i = Math.floor(Math.abs(wobble) * 3) % ASSET.player.swim.length;
      return ASSET.player.swim[i];
    }
    return ASSET.player.idle;
  }

  // Fallback vector art if PNGs not ready
  function fishPalette(kind) {
    switch (kind) {
      case "player": return { body: "#FF8A00", belly: "#FFE8C8", fin: "#E65100", eye: "big", face: "happy" };
      case "pink":   return { body: "#FF80AB", belly: "#FCE4EC", fin: "#EC407A", eye: "small", face: "sleepy" };
      case "yellow": return { body: "#FFD54F", belly: "#FFF3E0", fin: "#FFB300", eye: "half", face: "smug" };
      case "blue":   return { body: "#42A5F5", belly: "#BBDEFB", fin: "#1565C0", eye: "angry", face: "grumpy" };
      case "green":  return { body: "#66BB6A", belly: "#C8E6C9", fin: "#2E7D32", eye: "angry", face: "teeth" };
      case "purple": return { body: "#AB47BC", belly: "#E1BEE7", fin: "#6A1B9A", eye: "angry", face: "teeth" };
      case "tiny":   return { body: "#AED581", belly: "#F1F8E9", fin: "#7CB342", eye: "dot", face: "simple" };
      default:       return { body: "#90CAF9", belly: "#E3F2FD", fin: "#1976D2", eye: "small", face: "simple" };
    }
  }

  const KIND_TO_ART = { tiny: 1, pink: 2, yellow: 6, blue: 4, green: 5, purple: 8, player: 0 };

  function drawFishSprite(x, y, size, facing, kind, dead, wobble, opts) {
    opts = opts || {};
    const alpha = opts.alpha;
    let img = null;
    if (kind === "player" || opts.player) {
      img = pickPlayerFrame(!!dead, opts.chompT || 0, opts.hurtT || 0, wobble || 0);
    } else {
      let art = opts.artType || KIND_TO_ART[kind] || 1;
      art = clamp(art, 1, 8);
      img = pickNpcFrame(art, wobble || 0);
    }
    if (drawFishImage(img, x, y, size, facing, dead, wobble, alpha)) return;

    // vector fallback (pre-asset)
    const p = fishPalette(kind === "player" ? "player" : (kind || "tiny"));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    if (dead) ctx.rotate(Math.PI / 2);
    if (wobble) ctx.rotate(Math.sin(wobble) * 0.08);
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    const s = size;
    ctx.lineWidth = Math.max(2.2, s * 0.12);
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.fillStyle = p.fin;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.lineTo(-s * 1.35, -s * 0.5);
    ctx.quadraticCurveTo(-s * 1.05, 0, -s * 1.35, s * 0.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    const bw = kind === "player" ? s * 1.05 : s;
    const bh = kind === "player" ? s * 0.68 : s * 0.6;
    ctx.fillStyle = p.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.belly;
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.2, s * 0.55, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── Entities (SWF-faithful logic; see SWF_LOGIC.md) ──
  // Original stage 550×400 @ 30fps. Positions live in SWF space; drawn into PLAY.
  const SWF = {
    W: 550,
    H: 400,
    FPS: 30,
    DRAG: 0.93,
    SWIM: 0.25,
    SWIM_TURBO: 0.5,
    F_SIZE0: 15,
    F_WIN: 250,
    NPC: 10,
    WRAP_L: 80,
    WRAP_R: 450,
    Y_MIN: 70,
    Y_MAX: 360,
    SPAWN_Y0: 95,
    SPAWN_YH: 240,
  };

  // Flash fish frame (1..10) → art type (8 SWF looks; 9–10 clamp)
  const FRAME_KIND = [
    "tiny", "pink", "red", "blue", "green",
    "yellow", "navy", "purple", "purple", "purple",
  ];

  function toScreenX(x) { return PLAY.x + (x / SWF.W) * PLAY.w; }
  function toScreenY(y) { return PLAY.y + (y / SWF.H) * PLAY.h; }
  function toSwfX(px) { return ((px - PLAY.x) / PLAY.w) * SWF.W; }
  function toSwfY(py) { return ((py - PLAY.y) / PLAY.h) * SWF.H; }
  /** Map Flash _xscale units to on-screen radius-ish size */
  function scaleToPx(fSize) {
    return Math.max(4, (fSize / SWF.W) * PLAY.w);
  }

  function rollFishSize(fSize) {
    const rSize = Math.min(fSize, 100);
    // Flash random(n) → [0, n); fishsize = random(39+int(rSize/3)) + 5
    const span = 39 + ((rSize / 3) | 0);
    return ((Math.random() * span) | 0) + 5;
  }

  function rollFishSpeed(fSize) {
    const rSpd = Math.min(fSize, 150);
    let spd = (((Math.random() * 6) | 0) - 3) * (1.1 + rSpd / 300);
    if (spd === 0) spd = 2;
    return spd;
  }

  function frameForSize(fishsize) {
    return ((fishsize / 8) | 0) + 1; // 1..10
  }

  function kindForFrame(frame) {
    return FRAME_KIND[clamp(frame, 1, 10) - 1];
  }

  function placeFishSlot(slot, fSize) {
    const fishsize = rollFishSize(fSize);
    let fishspeed = rollFishSpeed(fSize);
    const frame = frameForSize(fishsize);
    const fromLeft = fishspeed > 0;
    if (!fromLeft && fishspeed === 0) fishspeed = 2;
    slot.fishsize = fishsize;
    slot.fishspeed = fishspeed;
    slot.frame = frame;
    slot.artType = artTypeForFrame(frame);
    slot.kind = kindForFrame(frame);
    slot.x = fromLeft ? -90 : 640;
    slot.y = SWF.SPAWN_Y0 + ((Math.random() * SWF.SPAWN_YH) | 0);
    slot.facing = fromLeft ? 1 : -1;
    slot.size = scaleToPx(fishsize);
    slot.wobble = rand(0, Math.PI * 2);
    slot.alive = true;
  }

  function makeNpcSlots(fSize) {
    const slots = [];
    for (let i = 1; i <= SWF.NPC; i++) {
      const slot = { id: i };
      placeFishSlot(slot, fSize);
      slots.push(slot);
    }
    return slots;
  }

  function makePlayer() {
    return {
      x: 200,
      y: 180,
      xmove: 0,
      ymove: 7, // SWF init downward drift
      f_size: SWF.F_SIZE0,
      size: scaleToPx(SWF.F_SIZE0),
      facing: 1,
      kind: "player",
      wobble: 0,
    };
  }

  let won = false;

  function startGame() {
    mode = "play";
    score = 0;
    lives = 3;
    level = 1;
    timeSec = 0;
    playTime = 0;
    invuln = 0;
    growFlash = 0;
    popups = [];
    player = makePlayer();
    player.chompT = 0;
    player.hurtT = 0;
    fish = makeNpcSlots(player.f_size);
    deathFish = null;
    shake = 0;
    won = false;
    playSfx("splash", { volume: 0.8 });
    ensureBgm(true);
  }

  // ─── Input ───────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      kbdActive = true;
    }
    if (mode === "title" && (e.code === "Enter" || e.code === "Space")) { unlockAudio(); startGame(); }
    if (mode === "help" && (e.code === "Enter" || e.code === "Space" || e.code === "Escape")) mode = "title";
    if ((mode === "over" || mode === "win") && (e.code === "Enter" || e.code === "Space")) startGame();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
    const any =
      keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown ||
      keys.KeyA || keys.KeyD || keys.KeyW || keys.KeyS;
    if (!any) kbdActive = false;
  });

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    const sx = W / r.width, sy = H / r.height;
    const cx = (e.clientX !== undefined ? e.clientX : e.touches[0].clientX);
    const cy = (e.clientY !== undefined ? e.clientY : e.touches[0].clientY);
    return { x: (cx - r.left) * sx, y: (cy - r.top) * sy };
  }

  function hitStarBtn(p, cx, cy) {
    return Math.hypot(p.x - cx, p.y - cy) < 60;
  }

  canvas.addEventListener("mousemove", (e) => {
    const p = canvasPos(e);
    pointer = p;
    if (mode === "title") {
      if (hitStarBtn(p, W * 0.35, H * 0.52)) btnHover = "start";
      else if (hitStarBtn(p, W * 0.65, H * 0.52)) btnHover = "help";
      else btnHover = null;
      canvas.style.cursor = btnHover ? "pointer" : "default";
    } else if (mode === "help") {
      btnHover = (p.x > W - 90 && p.y > H - 90) ? "next" : null;
      canvas.style.cursor = btnHover ? "pointer" : "default";
    } else if (mode === "over" || mode === "win") {
      btnHover = (p.x > W / 2 - 70 && p.x < W / 2 + 70 && p.y > H * 0.62 && p.y < H * 0.62 + 44) ? "retry" : null;
      canvas.style.cursor = btnHover ? "pointer" : "default";
    } else {
      canvas.style.cursor = "default";
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    pointerDown = true;
    pointer = canvasPos(e);
    handleClick(pointer);
  });
  canvas.addEventListener("mouseup", () => { pointerDown = false; });
  canvas.addEventListener("mouseleave", () => { pointer = null; pointerDown = false; });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    pointerDown = true;
    pointer = canvasPos(e);
    handleClick(pointer);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    pointer = canvasPos(e);
  }, { passive: false });
  canvas.addEventListener("touchend", () => { pointerDown = false; pointer = null; });

  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // Warm decode by playing muted snippets
    for (const a of Object.values(ASSET.sfx)) {
      if (!a) continue;
      try {
        const wasVol = a.volume;
        a.muted = true;
        const p = a.play();
        if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; a.volume = wasVol; }).catch(() => { a.muted = false; });
        else { a.pause(); a.currentTime = 0; a.muted = false; }
      } catch (_) {}
    }
  }

  function handleClick(p) {
    unlockAudio();
    if (mode === "title") {
      if (hitStarBtn(p, W * 0.35, H * 0.52)) startGame();
      else if (hitStarBtn(p, W * 0.65, H * 0.52)) mode = "help";
    } else if (mode === "help") {
      mode = "title";
    } else if (mode === "over" || mode === "win") {
      if (p.x > W / 2 - 70 && p.x < W / 2 + 70 && p.y > H * 0.62 && p.y < H * 0.62 + 44) startGame();
    }
  }

  // ─── Update (SWF enterFrame model @ 30fps, integrated with dt) ──
  function update(dt) {
    for (const b of bubbles) {
      b.y += b.vy * dt;
      if (b.y < -b.r) { b.y = H + b.r; b.x = rand(0, W); }
    }

    if (mode !== "play" || !player) {
      if ((mode === "over" || mode === "win") && deathFish) {
        deathFish.y += Math.sin(performance.now() / 400) * 0.15;
      }
      return;
    }

    playTime += dt;
    timeSec = playTime;
    invuln = Math.max(0, invuln - dt);
    growFlash = Math.max(0, growFlash - dt);
    shake = Math.max(0, shake - dt);
    if (player) {
      player.chompT = Math.max(0, (player.chompT || 0) - dt);
      player.hurtT = Math.max(0, (player.hurtT || 0) - dt);
    }

    // How many Flash frames elapsed this tick
    let frames = dt * SWF.FPS;
    if (frames > 3) frames = 3; // avoid spiral on tab-switch

    const left = keys.ArrowLeft || keys.KeyA;
    const right = keys.ArrowRight || keys.KeyD;
    const up = keys.ArrowUp || keys.KeyW;
    const down = keys.ArrowDown || keys.KeyS;
    const turbo = keys.ShiftLeft || keys.ShiftRight;
    const usingKbd = left || right || up || down || kbdActive;

    // Optional pointer/touch steer (not in SWF; kept for phone) — inject as virtual arrows
    let pLeft = false, pRight = false, pUp = false, pDown = false;
    if (!usingKbd && pointer) {
      const want = (pointerDown) || (
        pointer.x > PLAY.x && pointer.x < PLAY.x + PLAY.w &&
        pointer.y > PLAY.y && pointer.y < PLAY.y + PLAY.h
      );
      if (want) {
        const tx = toSwfX(pointer.x), ty = toSwfY(pointer.y);
        const dx = tx - player.x, dy = ty - player.y;
        const dead = pointerDown ? 6 : 14;
        if (Math.hypot(dx, dy) > dead) {
          if (Math.abs(dx) >= Math.abs(dy) * 0.35) {
            if (dx < 0) pLeft = true; else pRight = true;
          }
          if (Math.abs(dy) >= Math.abs(dx) * 0.35) {
            if (dy < 0) pUp = true; else pDown = true;
          }
        }
      }
    }

    const goL = left || pLeft;
    const goR = right || pRight;
    const goU = up || pUp;
    const goD = down || pDown;

    // Step in Flash-frame units (fractional OK)
    const swim = turbo ? SWF.SWIM_TURBO : SWF.SWIM;
    const dragPow = Math.pow(SWF.DRAG, frames);

    player.xmove *= dragPow;
    player.ymove *= dragPow;

    if (goL) {
      player.facing = -1;
      player.xmove -= swim * frames;
    }
    if (goR) {
      player.facing = 1;
      player.xmove += swim * frames;
    }
    if (goU) player.ymove -= swim * frames;
    if (goD) player.ymove += swim * frames;

    player.x += player.xmove * frames;
    // Horizontal wrap (SWF 80 ↔ 450)
    if (player.x > SWF.WRAP_R) player.x = SWF.WRAP_L;
    if (player.x < SWF.WRAP_L) player.x = SWF.WRAP_R;

    const nextY = player.y + player.ymove * frames;
    if (nextY < SWF.Y_MAX && nextY > SWF.Y_MIN) player.y = nextY;
    else player.ymove = 0;

    player.size = scaleToPx(player.f_size) + (growFlash > 0 ? 2 : 0);
    player.wobble += dt * 8;

    // NPC move + respawn (10 fixed slots)
    for (const f of fish) {
      f.x += f.fishspeed * frames;
      f.wobble += dt * 5;
      f.facing = f.fishspeed >= 0 ? 1 : -1;
      f.size = scaleToPx(f.fishsize);
      if (f.x > 650 || f.x < -100) {
        placeFishSlot(f, player.f_size);
      }
    }

    // Collisions — SWF: eat iff f_size > fishsize; else life.reduce
    const pSx = toScreenX(player.x);
    const pSy = toScreenY(player.y);
    const pR = player.size * 0.85;

    for (const f of fish) {
      const fSx = toScreenX(f.x);
      const fSy = toScreenY(f.y);
      const fR = f.size * 0.85;
      const d = Math.hypot(pSx - fSx, pSy - fSy);
      if (d >= pR + fR) continue;

      if (player.f_size > f.fishsize) {
        const bonus = (f.fishsize * 6) | 0;
        score += bonus;
        popups.push({
          x: fSx, y: fSy,
          text: "+" + bonus,
          life: 0.9, vy: -40,
        });
        player.f_size += f.fishsize / 75;
        player.size = scaleToPx(player.f_size);
        growFlash = 0.35;
        player.chompT = 0.35;
        playEatSfx(f.fishsize);
        // Park offscreen like mc._x = 700; next loop respawns
        f.x = 700;
        f.fishspeed = 2;

        if (player.f_size > SWF.F_WIN) {
          won = true;
          deathFish = {
            x: toScreenX(player.x),
            y: toScreenY(player.y),
            size: player.size,
          };
          mode = "win";
          ensureBgm(false);
          playSfx("win", { volume: 0.85 });
          break;
        }
      } else if (invuln <= 0) {
        // Hurt (SWF has no invuln; brief remake grace so one overlap ≠ multi-hit)
        lives -= 1;
        invuln = 1.2;
        player.hurtT = 1.2;
        shake = 0.4;
        playSfx("flash", { volume: 0.75 });
        f.x = 700;
        if (lives <= 0) {
          deathFish = {
            x: toScreenX(player.x),
            y: toScreenY(player.y),
            size: player.size,
          };
          mode = "over";
          ensureBgm(false);
          playSfx("lose", { volume: 0.85 });
          break;
        }
        // Soft reset position (SWF only plays hit anim / life icon)
        player.x = 200;
        player.y = 180;
        player.xmove = 0;
        player.ymove = 0;
      }
    }

    // Rough level label from size (HUD only; SWF has no level var)
    level = 1 + Math.min(9, ((player.f_size - SWF.F_SIZE0) / 25) | 0);

    for (const p of popups) {
      p.life -= dt;
      p.y += p.vy * dt;
    }
    popups = popups.filter((p) => p.life > 0);
  }

  // ─── Screens ─────────────────────────────────────────────
  function drawTitleSeabed() {
    const strip = ASSET.seabed.stripTitle || ASSET.seabed.stripPlay;
    if (strip) {
      const sh = Math.min(H * 0.28, strip.height * (W / strip.width));
      drawAsset(strip, 0, H - sh, W, sh);
      return;
    }
    const baseY = H - 4;
    ctx.fillStyle = "#6B7388";
    ctx.fillRect(0, baseY - 48, W, 52);
    drawKelp(32, baseY - 30, 2.0);
    drawCrab(155, baseY - 20, 1.75);
    drawClam(245, baseY - 16, 1.65);
    drawAnemone(330, baseY - 18, 1.7);
    drawSpottedShell(415, baseY - 14, 1.65);
    drawSmileStar(495, baseY - 16, 1.55);
    drawKelp(565, baseY - 28, 1.85);
  }

  function drawTitle() {
    drawOuterBg();
    if (ASSET.ui.bgBubbles) {
      ctx.globalAlpha = 0.85;
      drawAsset(ASSET.ui.bgBubbles, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    drawTitleSeabed();
    drawTitleLogo(W / 2, H * 0.26);
    drawStarButton(W * 0.35, H * 0.52, "#FF8C00", "开始", btnHover === "start", "start");
    drawStarButton(W * 0.65, H * 0.52, "#43A047", "说明", btnHover === "help", "help");
  }

  function drawHelp() {
    drawOuterBg();
    drawTitleSeabed();
    const panel = ASSET.ui.helpPanel;
    if (panel) {
      const pw = Math.min(560, W - 40);
      const ph = pw * (panel.height / panel.width);
      const px = (W - pw) / 2;
      const py = 28;
      drawAsset(panel, px, py, pw, ph);
      // Chinese caption under Korean original for the kid
      ctx.save();
      ctx.font = "bold 13px Microsoft YaHei, PingFang SC, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "#0A2A5A";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      const tip = "比自己小才能吃 · 撞大鱼会丢命 · 方向键移动";
      ctx.strokeText(tip, W / 2, py + ph + 18);
      ctx.fillText(tip, W / 2, py + ph + 18);
      ctx.restore();
      const next = ASSET.ui.btnNext;
      if (next) drawAssetCentered(next, W - 55, H - 55, 1.8);
      else {
        ctx.beginPath();
        ctx.arc(W - 55, H - 55, 28, 0, Math.PI * 2);
        ctx.fillStyle = btnHover === "next" ? "#FFA726" : "#FF8C00";
        ctx.fill();
      }
      return;
    }
    // Fallback vector help (kept for missing assets)
    const px = 50, py = 36, pw = 540, ph = 340;
    roundRect(px, py, pw, ph, 16);
    ctx.fillStyle = "#FFD01F";
    ctx.fill();
    roundRect(px + 14, py + 14, pw - 28, ph - 28, 10);
    ctx.fillStyle = "#A8D4F0";
    ctx.fill();
    ctx.fillStyle = "#1a3a5c";
    ctx.font = "bold 15px Microsoft YaHei, sans-serif";
    ctx.fillText("比自己小才能吃；撞大鱼会丢命；方向键移动", px + 40, py + 70);
    ctx.beginPath();
    ctx.arc(W - 55, H - 55, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#FF8C00";
    ctx.fill();
  }

  function drawSign(x, y, ch, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#8D6E63";
    ctx.fillRect(-3, 0, 6, 28);
    ctx.fillStyle = "#D7CCC8";
    ctx.strokeStyle = "#5D4037";
    ctx.lineWidth = 2;
    roundRect(-18, -22, 36, 28, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, 0, -8);
    ctx.restore();
  }

  function drawArrowKeys(cx, cy) {
    const keysPos = [
      [0, -22, "▲"],
      [-22, 0, "◀"],
      [0, 0, "▼"],
      [22, 0, "▶"],
    ];
    for (const [ox, oy, ch] of keysPos) {
      roundRect(cx + ox - 12, cy + oy - 12, 24, 24, 4);
      ctx.fillStyle = "#B0BEC5";
      ctx.fill();
      ctx.strokeStyle = "#546E7A";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#263238";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, cx + ox, cy + oy + 1);
    }
  }

  function drawPlay() {
    drawOuterBg();
    const ox = shake > 0 ? rand(-3, 3) : 0;
    const oy = shake > 0 ? rand(-3, 3) : 0;
    ctx.save();
    ctx.translate(ox, oy);
    drawGoldFrame();
    drawSeabed(true);

    ctx.save();
    roundRect(FX + BORDER, FY + BORDER, FW - BORDER * 2, FH - BORDER * 2, 10);
    ctx.clip();

    const all = fish.slice().sort((a, b) => a.y - b.y);
    for (const f of all) {
      if (f.y < (player ? player.y : 0)) {
        drawFishSprite(toScreenX(f.x), toScreenY(f.y), f.size, f.facing, f.kind, false, f.wobble, { artType: f.artType });
      }
    }
    if (player) {
      const blink = invuln > 0 && Math.floor(invuln * 8) % 2 === 0;
      if (!blink) {
        drawFishSprite(toScreenX(player.x), toScreenY(player.y), player.size, player.facing, "player", false, player.wobble, { player: true, chompT: player.chompT, hurtT: player.hurtT });
      }
    }
    for (const f of all) {
      if (f.y >= (player ? player.y : 0)) {
        drawFishSprite(toScreenX(f.x), toScreenY(f.y), f.size, f.facing, f.kind, false, f.wobble, { artType: f.artType });
      }
    }
    ctx.restore();

    for (const p of popups) {
      ctx.globalAlpha = clamp(p.life * 1.4, 0, 1);
      ctx.font = "bold 18px Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#3D1A00";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = "#FFEE58";
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // HUD: original logo + SCORE + TIME + lives
    if (ASSET.ui.logoHud) {
      drawAsset(ASSET.ui.logoHud, FX - 8, FY - 16, ASSET.ui.logoHud.width * 1.15, ASSET.ui.logoHud.height * 1.15);
    } else if (ASSET.ui.logo) {
      drawAsset(ASSET.ui.logo, FX - 16, FY - 28, 140, 70);
    } else {
      drawLogo(FX - 6, FY - 4, 1.05);
    }
    drawScorePlaque();
    drawTimeClock();
    drawLives();
  }

  function drawOver() {
    drawOuterBg();
    drawTitleSeabed();
    if (deathFish) {
      drawFishSprite(deathFish.x, deathFish.y, deathFish.size || 18, 1, "player", true, 0, { player: true });
    }
    const px = 70, py = 70, pw = 500, ph = 280;
    // Gold frame chrome
    if (ASSET.ui.goldFrame) {
      drawAsset(ASSET.ui.goldFrame, px, py, pw, ph);
      // fill inner with light blue
      ctx.save();
      roundRect(px + 28, py + 28, pw - 56, ph - 56, 8);
      ctx.fillStyle = "#A8D4F0";
      ctx.fill();
      ctx.restore();
    } else {
      roundRect(px, py, pw, ph, 16);
      ctx.fillStyle = "#FFD01F";
      ctx.fill();
      roundRect(px + 14, py + 14, pw - 28, ph - 28, 10);
      ctx.fillStyle = "#A8D4F0";
      ctx.fill();
    }

    if (mode === "win" && ASSET.ui.congratulation) {
      drawAssetCentered(ASSET.ui.congratulation, W / 2, py + 70, 0.55);
    } else if (ASSET.ui.gameOver) {
      drawAssetCentered(ASSET.ui.gameOver, W / 2, py + 70, 1.4);
    } else {
      ctx.font = "bold 42px Impact, Arial Black, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(mode === "win" ? "CLEAR!" : "GAME OVER", W / 2, py + 70);
    }

    // Score plaque (점수 + digits)
    if (ASSET.ui.gameoverScore) {
      const gs = ASSET.ui.gameoverScore;
      const gw = Math.min(320, gs.width * 1.1);
      const gh = gw * (gs.height / gs.width);
      const gx = W / 2 - gw / 2, gy = py + 120;
      drawAsset(gs, gx, gy, gw, gh);
      // Cover baked-in zeros then draw live score
      const digitX = gx + gw * 0.28;
      const digitW = gw * 0.70;
      roundRect(digitX, gy + gh * 0.12, digitW, gh * 0.76, 3);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.fillStyle = "#FFEE58";
      ctx.font = `bold ${Math.max(18, gh * 0.55)}px 'Courier New', monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(score).padStart(6, "0"), gx + gw - 14, gy + gh / 2 + 1);
    } else {
      ctx.fillStyle = "#FFEE58";
      ctx.font = "bold 28px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(score).padStart(6, "0"), W / 2, py + 140);
    }

    roundRect(W / 2 - 70, H * 0.62, 140, 44, 12);
    ctx.fillStyle = btnHover === "retry" ? "#FFA726" : "#FF8C00";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("再玩一次", W / 2, H * 0.62 + 22);
  }

  // ─── Loop ────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    ctx.clearRect(0, 0, W, H);
    if (mode === "title") drawTitle();
    else if (mode === "help") drawHelp();
    else if (mode === "play") drawPlay();
    else if (mode === "over" || mode === "win") drawOver();
    requestAnimationFrame(frame);
  }
  if (location.hash === "#play") startGame();
  else if (location.hash === "#help") mode = "help";
  else if (location.hash === "#over") {
    score = 12345; lives = 0; deathFish = { x: 560, y: 220, size: 18 }; mode = "over";
  }

  requestAnimationFrame(frame);
})();
