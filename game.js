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

  // ─── Candy gold frame (heavy bevel) ──────────────────────
  function drawGoldFrame() {
    ctx.save();
    const rOut = 22, rIn = 10;
    // Dark outer outline
    roundRect(FX - 2, FY - 2, FW + 4, FH + 4, rOut + 2);
    ctx.fillStyle = "#3D2200";
    ctx.fill();

    // Main candy yellow body
    roundRect(FX, FY, FW, FH, rOut);
    const body = ctx.createLinearGradient(FX, FY, FX, FY + FH);
    body.addColorStop(0, "#FFE456");
    body.addColorStop(0.35, "#FFD01F");
    body.addColorStop(0.7, "#F5B800");
    body.addColorStop(1, "#E0A000");
    ctx.fillStyle = body;
    ctx.fill();

    // Top highlight bevel strip
    ctx.save();
    roundRect(FX, FY, FW, FH, rOut);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,220,0.55)";
    ctx.fillRect(FX, FY, FW, 7);
    ctx.fillStyle = "rgba(255,255,220,0.35)";
    ctx.fillRect(FX, FY, 7, FH);
    // Bottom/right shadow bevel
    ctx.fillStyle = "rgba(120,70,0,0.35)";
    ctx.fillRect(FX, FY + FH - 8, FW, 8);
    ctx.fillStyle = "rgba(120,70,0,0.28)";
    ctx.fillRect(FX + FW - 8, FY, 8, FH);
    ctx.restore();

    // Inner dark lip
    roundRect(FX + BORDER - 3, FY + BORDER - 3, FW - (BORDER - 3) * 2, FH - (BORDER - 3) * 2, rIn + 2);
    ctx.fillStyle = "#5C3A00";
    ctx.fill();

    // Water playfield
    roundRect(FX + BORDER, FY + BORDER, FW - BORDER * 2, FH - BORDER * 2, rIn);
    const wg = ctx.createLinearGradient(0, FY, 0, FY + FH);
    wg.addColorStop(0, "#5CC3FF");
    wg.addColorStop(0.45, "#40AAFF");
    wg.addColorStop(1, "#2A88DD");
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.restore();
  }

  // ─── Seabed + LARGE character props ──────────────────────
  function drawSeabed(clip) {
    ctx.save();
    if (clip) {
      roundRect(FX + BORDER, FY + BORDER, FW - BORDER * 2, FH - BORDER * 2, 10);
      ctx.clip();
    }
    const baseY = FY + FH - BORDER - 2;
    const left = FX + BORDER;
    const right = FX + FW - BORDER;

    // Rocky floor
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

    // Darker rock silhouettes mid-ground
    ctx.fillStyle = "#4A5166";
    ctx.beginPath();
    ctx.moveTo(left + 70, baseY - 10);
    ctx.lineTo(left + 115, baseY - 52);
    ctx.lineTo(left + 175, baseY - 12);
    ctx.lineTo(left + 230, baseY - 58);
    ctx.lineTo(left + 295, baseY - 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(left + 360, baseY - 8);
    ctx.lineTo(left + 420, baseY - 48);
    ctx.lineTo(left + 485, baseY - 10);
    ctx.closePath();
    ctx.fill();

    // LARGE props (scaled to match ruffle-shots)
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

  function drawStarButton(cx, cy, color, label, hover) {
    const s = hover ? 1.07 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    drawPuffyStarfish(0, 0, color, 58);
    // white center disc
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
    const pw = 150, ph = 42;
    const px = FX + FW / 2 - pw / 2;
    const py = FY - 10;
    // dark outline
    roundRect(px - 2, py - 2, pw + 4, ph + 4, 8);
    ctx.fillStyle = "#3D2200";
    ctx.fill();
    // candy yellow plaque
    roundRect(px, py, pw, ph, 7);
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "#FFE456");
    g.addColorStop(0.5, "#FFD01F");
    g.addColorStop(1, "#E8A800");
    ctx.fillStyle = g;
    ctx.fill();
    // top highlight
    ctx.fillStyle = "rgba(255,255,230,0.45)";
    ctx.fillRect(px + 4, py + 2, pw - 8, 5);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCORE", px + pw / 2, py + 11);

    // LCD black inset — 6 wide digits
    roundRect(px + 10, py + 18, pw - 20, 18, 3);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.fillStyle = "#FFEE58";
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillText(String(score).padStart(6, "0"), px + pw / 2, py + 28);
  }

  // ─── TIME alarm clock (no LEVEL) ─────────────────────────
  function drawTimeClock() {
    const cx = FX + FW - 8;
    const cy = FY + 2;

    ctx.save();
    ctx.lineJoin = "round";

    // Handle arch
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 16, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Bells
    ctx.fillStyle = "#FFD01F";
    ctx.strokeStyle = "#3D2200";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(cx - 16, cy - 18, 10, 8, -0.35, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 16, cy - 18, 10, 8, 0.35, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // bell knobs
    ctx.fillStyle = "#C9970A";
    ctx.beginPath(); ctx.arc(cx - 16, cy - 26, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 16, cy - 26, 3, 0, Math.PI * 2); ctx.fill();

    // Clock body
    ctx.beginPath();
    ctx.arc(cx, cy + 14, 32, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - 8, cy + 2, 4, cx, cy + 14, 32);
    g.addColorStop(0, "#FFE456");
    g.addColorStop(0.55, "#FFD01F");
    g.addColorStop(1, "#D4A000");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#3D2200";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner face ring
    ctx.beginPath();
    ctx.arc(cx, cy + 14, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#F5C400";
    ctx.fill();
    ctx.stroke();

    // TIME label (top)
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TIME", cx, cy + 2);

    // Black LCD with orange digits
    roundRect(cx - 20, cy + 8, 40, 14, 2);
    ctx.fillStyle = "#111";
    ctx.fill();

    const total = Math.max(0, timeSec);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const cs = Math.floor((total % 1) * 100);
    const tstr = `${m}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
    ctx.fillStyle = "#FF8C00";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText(tstr, cx, cy + 16);

    // Mirrored TIME (original quirk) — faint upside-down
    ctx.save();
    ctx.translate(cx, cy + 30);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 8px Arial, sans-serif";
    ctx.fillText("TIME", 0, 0);
    ctx.restore();

    // Feet
    ctx.fillStyle = "#FFD01F";
    ctx.strokeStyle = "#3D2200";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx - 14, cy + 44, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 14, cy + 44, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  function drawLives() {
    for (let i = 0; i < lives; i++) {
      drawFishSprite(28, 100 + i * 52, 16, 1, "player", false, 0);
    }
  }

  // ─── Fish art (thicker outlines, distinct silhouettes) ────
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

  function drawFishSprite(x, y, size, facing, kind, dead, wobble) {
    const p = fishPalette(kind);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    if (dead) ctx.rotate(Math.PI / 2);
    if (wobble) ctx.rotate(Math.sin(wobble) * 0.08);
    const s = size;
    // Thicker even outlines
    ctx.lineWidth = Math.max(2.2, s * 0.12);
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Tail — more distinct fork
    ctx.fillStyle = p.fin;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.lineTo(-s * 1.35, -s * 0.5);
    ctx.quadraticCurveTo(-s * 1.05, 0, -s * 1.35, s * 0.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Body — player slightly rounder / chubbier for ID
    const bw = kind === "player" ? s * 1.05 : s;
    const bh = kind === "player" ? s * 0.68 : s * 0.6;
    ctx.fillStyle = p.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Belly
    ctx.fillStyle = p.belly;
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.2, s * 0.55, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal fin with ribbing
    ctx.fillStyle = p.fin;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -bh * 0.85);
    ctx.lineTo(s * 0.1, -s * 1.0);
    ctx.lineTo(s * 0.4, -bh * 0.75);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -bh * 0.85);
    ctx.lineTo(s * 0.12, -s * 0.92);
    ctx.stroke();

    // Side fin
    ctx.beginPath();
    ctx.moveTo(s * 0.0, s * 0.05);
    ctx.lineTo(-s * 0.2, s * 0.55);
    ctx.lineTo(s * 0.28, s * 0.32);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Specular highlight
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.2, -s * 0.22, s * 0.32, s * 0.16, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    const ex = s * 0.42, ey = -s * 0.06;
    if (dead) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = Math.max(2.5, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.18, ey - s * 0.18);
      ctx.lineTo(ex + s * 0.18, ey + s * 0.18);
      ctx.moveTo(ex + s * 0.18, ey - s * 0.18);
      ctx.lineTo(ex - s * 0.18, ey + s * 0.18);
      ctx.stroke();
    } else {
      const er = p.eye === "big" ? s * 0.32 : p.eye === "dot" ? s * 0.12 : s * 0.24;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (p.eye === "half" || p.eye === "angry") {
        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.ellipse(ex, ey - er * 0.5, er * 1.05, er * 0.55, 0, Math.PI, 0);
        ctx.fill();
        if (p.eye === "angry") {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = Math.max(2, s * 0.1);
          ctx.beginPath();
          ctx.moveTo(ex - er * 1.1, ey - er * 0.85);
          ctx.lineTo(ex + er * 0.9, ey - er * 0.15);
          ctx.stroke();
        }
      }
      if (p.eye === "dot") {
        // closed/peaceful line eye for tiny
        ctx.strokeStyle = "#000";
        ctx.lineWidth = Math.max(2, s * 0.1);
        ctx.beginPath();
        ctx.moveTo(ex - s * 0.12, ey);
        ctx.lineTo(ex + s * 0.12, ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#000";
        const pr = er * (p.eye === "big" ? 0.42 : 0.48);
        ctx.beginPath(); ctx.arc(ex + er * 0.18, ey + er * 0.05, pr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(ex + er * 0.05, ey - er * 0.28, pr * 0.38, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Mouth
    ctx.strokeStyle = "#000";
    ctx.lineWidth = Math.max(2, s * 0.09);
    const mx = s * 0.78, my = s * 0.18;
    if (p.face === "teeth") {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(mx - s * 0.08, my - s * 0.1);
      ctx.lineTo(mx + s * 0.22, my);
      ctx.lineTo(mx - s * 0.08, my + s * 0.2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx + s * 0.02, my - s * 0.02);
      ctx.lineTo(mx + s * 0.02, my + s * 0.12);
      ctx.stroke();
    } else if (p.face === "grumpy") {
      ctx.beginPath();
      ctx.arc(mx, my + s * 0.1, s * 0.14, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (p.face === "sleepy" || p.face === "smug") {
      ctx.fillStyle = "#8D6E63";
      ctx.beginPath();
      ctx.ellipse(mx + s * 0.02, my, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (p.face === "happy") {
      // open surprised/happy mouth + bubbles cue for player
      ctx.beginPath();
      ctx.arc(mx, my, s * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "#4A2010";
      ctx.fill();
      ctx.stroke();
      if (kind === "player" && s > 10) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.arc(mx + s * 0.25, my - s * 0.35, s * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + s * 0.38, my - s * 0.55, s * 0.05, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(mx, my, s * 0.08, 0, Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ─── Entities (SWF-faithful logic; see /workspace/4399-1876/SWF_LOGIC.md) ──
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

  // Flash fish frame (1..10) → remake palette kind
  const FRAME_KIND = [
    "tiny", "tiny", "pink", "pink", "yellow",
    "blue", "green", "purple", "purple", "purple",
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
    fish = makeNpcSlots(player.f_size);
    deathFish = null;
    shake = 0;
    won = false;
  }

  // ─── Input ───────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      kbdActive = true;
    }
    if (mode === "title" && (e.code === "Enter" || e.code === "Space")) startGame();
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
      if (hitStarBtn(p, W * 0.35, H * 0.48)) btnHover = "start";
      else if (hitStarBtn(p, W * 0.65, H * 0.48)) btnHover = "help";
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

  function handleClick(p) {
    if (mode === "title") {
      if (hitStarBtn(p, W * 0.35, H * 0.48)) startGame();
      else if (hitStarBtn(p, W * 0.65, H * 0.48)) mode = "help";
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
          break;
        }
      } else if (invuln <= 0) {
        // Hurt (SWF has no invuln; brief remake grace so one overlap ≠ multi-hit)
        lives -= 1;
        invuln = 1.2;
        shake = 0.4;
        f.x = 700;
        if (lives <= 0) {
          deathFish = {
            x: toScreenX(player.x),
            y: toScreenY(player.y),
            size: player.size,
          };
          mode = "over";
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
    const baseY = H - 4;
    ctx.fillStyle = "#6B7388";
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(0, baseY - 48);
    for (let x = 0; x <= W; x += 36) {
      ctx.lineTo(x, baseY - 24 - Math.sin(x * 0.05) * 18 - (x % 72 === 0 ? 14 : 0));
    }
    ctx.lineTo(W, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4A5166";
    ctx.beginPath();
    ctx.moveTo(90, baseY - 22);
    ctx.lineTo(145, baseY - 62);
    ctx.lineTo(210, baseY - 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(400, baseY - 18);
    ctx.lineTo(460, baseY - 55);
    ctx.lineTo(530, baseY - 16);
    ctx.closePath();
    ctx.fill();

    drawKelp(32, baseY - 30, 2.0);
    drawKelp(70, baseY - 24, 1.7);
    drawCrab(155, baseY - 20, 1.75);
    drawClam(245, baseY - 16, 1.65);
    drawAnemone(330, baseY - 18, 1.7);
    drawSpottedShell(415, baseY - 14, 1.65);
    drawSmileStar(495, baseY - 16, 1.55);
    drawKelp(565, baseY - 28, 1.85);
    drawKelp(605, baseY - 22, 1.6);
  }

  function drawTitle() {
    drawOuterBg();
    ctx.fillStyle = "#015BE6";
    ctx.fillRect(0, 0, W, H);
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${b.a})`;
      ctx.fill();
    }
    drawTitleSeabed();
    drawTitleLogo(W / 2, H * 0.26);
    drawStarButton(W * 0.35, H * 0.48, "#FF8C00", "开始", btnHover === "start");
    drawStarButton(W * 0.65, H * 0.48, "#43A047", "说明", btnHover === "help");
  }

  function drawHelp() {
    drawOuterBg();
    drawTitleSeabed();
    const px = 50, py = 36, pw = 540, ph = 340;
    // Thick candy frame with screws
    roundRect(px - 2, py - 2, pw + 4, ph + 4, 18);
    ctx.fillStyle = "#3D2200";
    ctx.fill();
    roundRect(px, py, pw, ph, 16);
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "#FFE456");
    g.addColorStop(1, "#E0A000");
    ctx.fillStyle = g;
    ctx.fill();
    roundRect(px + 14, py + 14, pw - 28, ph - 28, 10);
    ctx.fillStyle = "#A8D4F0";
    ctx.fill();
    for (const [sx, sy] of [[px + 20, py + 20], [px + pw - 20, py + 20], [px + 20, py + ph - 20], [px + pw - 20, py + ph - 20]]) {
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#C0C0C0"; ctx.fill();
      ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy);
      ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4);
      ctx.stroke();
    }
    drawLogo(px + 16, py + 4, 0.95);

    ctx.fillStyle = "#1a3a5c";
    ctx.font = "bold 15px Microsoft YaHei, PingFang SC, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("体型严格更大才能吃掉（相等不行）", px + 40, py + 70);

    drawFishSprite(px + 80, py + 110, 22, 1, "player", false, 0);
    drawFishSprite(px + 140, py + 115, 12, -1, "pink", false, 0);
    drawSign(px + 200, py + 110, "O", "#E53935");

    ctx.fillText("比自己大的鱼要躲开，撞到会丢命", px + 40, py + 160);
    drawFishSprite(px + 80, py + 205, 16, 1, "player", false, 0);
    drawFishSprite(px + 160, py + 200, 32, -1, "purple", false, 0);
    drawSign(px + 230, py + 200, "X", "#E53935");

    roundRect(px + 40, py + 250, 70, 24, 10);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#E53935";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#E53935";
    ctx.font = "bold 12px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("操作", px + 75, py + 266);

    drawArrowKeys(px + 140, py + 280);

    ctx.fillStyle = "#1a3a5c";
    ctx.font = "12px Microsoft YaHei, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("方向键/WASD（惯性）· Shift加速 · 触屏跟随", px + 250, py + 285);

    ctx.beginPath();
    ctx.arc(W - 55, H - 55, 28, 0, Math.PI * 2);
    ctx.fillStyle = btnHover === "next" ? "#FFA726" : "#FF8C00";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(W - 65, H - 68);
    ctx.lineTo(W - 65, H - 42);
    ctx.lineTo(W - 42, H - 55);
    ctx.closePath();
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
        drawFishSprite(toScreenX(f.x), toScreenY(f.y), f.size, f.facing, f.kind, false, f.wobble);
      }
    }
    if (player) {
      const blink = invuln > 0 && Math.floor(invuln * 8) % 2 === 0;
      if (!blink) {
        drawFishSprite(toScreenX(player.x), toScreenY(player.y), player.size, player.facing, "player", false, player.wobble);
      }
    }
    for (const f of all) {
      if (f.y >= (player ? player.y : 0)) {
        drawFishSprite(toScreenX(f.x), toScreenY(f.y), f.size, f.facing, f.kind, false, f.wobble);
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

    // HUD: chunky logo overlapping top-left corner of gold frame
    drawLogo(FX - 6, FY - 4, 1.05);
    drawScorePlaque();
    drawTimeClock();
    drawLives();
  }

  function drawOver() {
    drawOuterBg();
    drawTitleSeabed();
    if (deathFish) {
      drawFishSprite(deathFish.x, deathFish.y, deathFish.size || 18, 1, "player", true, 0);
    }
    const px = 70, py = 70, pw = 500, ph = 280;
    roundRect(px - 2, py - 2, pw + 4, ph + 4, 18);
    ctx.fillStyle = "#3D2200";
    ctx.fill();
    roundRect(px, py, pw, ph, 16);
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "#FFE456");
    g.addColorStop(1, "#E0A000");
    ctx.fillStyle = g;
    ctx.fill();
    roundRect(px + 14, py + 14, pw - 28, ph - 28, 10);
    ctx.fillStyle = "#A8D4F0";
    ctx.fill();
    for (const [sx, sy] of [[px + 20, py + 20], [px + pw - 20, py + 20], [px + 20, py + ph - 20], [px + pw - 20, py + ph - 20]]) {
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#C0C0C0"; ctx.fill();
      ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.stroke();
    }

    ctx.font = "bold 42px Impact, Arial Black, sans-serif";
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    // chunky black offset + orange outline
    const title = (mode === "win") ? "CLEAR!" : "GAME OVER";
    const outline = (mode === "win") ? "#2E7D32" : "#FF6D00";
    ctx.fillStyle = "#0A0A0A";
    ctx.fillText(title, W / 2 + 4, py + 74);
    ctx.lineWidth = 8;
    ctx.strokeStyle = outline;
    ctx.strokeText(title, W / 2, py + 70);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(title, W / 2, py + 70);

    const bx = W / 2 - 140, by = py + 110;
    roundRect(bx, by, 280, 48, 6);
    ctx.fillStyle = "#111";
    ctx.fill();
    roundRect(bx + 6, by + 8, 56, 32, 4);
    ctx.fillStyle = "#FFD01F";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Malgun Gothic, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("점수", bx + 34, by + 29);

    ctx.fillStyle = "#FFEE58";
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(score).padStart(6, "0"), bx + 268, by + 34);

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
