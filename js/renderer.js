/* ============================================================================
   BLACKJACK — canvas renderer: card room backdrop, half-moon table with rail
   and printed felt, shoe and discard tray, seats with betting circles and
   chip stacks, vector playing cards with generated court figures, dealing /
   flipping animations, hand badges, payout chip flights and labels.
   ========================================================================== */
(function (root) {
  'use strict';
  const BJ = root.BJ, ZEUS = root.ZEUS, K = BJ.cards, FX = ZEUS.fx;
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
  const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const SUIT_FONT = '"Segoe UI Symbol", "Apple Symbols", "Arial Unicode MS", sans-serif';
  const RED = s => s === 'H' || s === 'D';
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  BJ.fmt = fmt;
  const SEAT_POS = [{ x: 400, y: 612 }, { x: 665, y: 718 }, { x: 960, y: 760 }, { x: 1255, y: 718 }, { x: 1520, y: 612 }];
  const DEALER = { x: 960, y: 330 }, SHOE = { x: 1540, y: 255 }, TRAY = { x: 380, y: 255 };
  const CARD = { w: 112, h: 160 }, SEAT_CARD = { w: 86, h: 124 };
  BJ.LAYOUT = { W: W, H: H, SEAT_POS: SEAT_POS, DEALER: DEALER, SHOE: SHOE, TRAY: TRAY, CARD: CARD, SEAT_CARD: SEAT_CARD };

  const PIPS = {
    2: [[0.5, 0.17], [0.5, 0.83]], 3: [[0.5, 0.17], [0.5, 0.5], [0.5, 0.83]], 4: [[0.28, 0.17], [0.72, 0.17], [0.28, 0.83], [0.72, 0.83]],
    5: [[0.28, 0.17], [0.72, 0.17], [0.5, 0.5], [0.28, 0.83], [0.72, 0.83]], 6: [[0.28, 0.17], [0.72, 0.17], [0.28, 0.5], [0.72, 0.5], [0.28, 0.83], [0.72, 0.83]],
    7: [[0.28, 0.17], [0.72, 0.17], [0.5, 0.335], [0.28, 0.5], [0.72, 0.5], [0.28, 0.83], [0.72, 0.83]],
    8: [[0.28, 0.17], [0.72, 0.17], [0.5, 0.335], [0.28, 0.5], [0.72, 0.5], [0.5, 0.665], [0.28, 0.83], [0.72, 0.83]],
    9: [[0.28, 0.17], [0.72, 0.17], [0.28, 0.39], [0.72, 0.39], [0.5, 0.5], [0.28, 0.61], [0.72, 0.61], [0.28, 0.83], [0.72, 0.83]],
    10: [[0.28, 0.17], [0.72, 0.17], [0.5, 0.28], [0.28, 0.39], [0.72, 0.39], [0.28, 0.61], [0.72, 0.61], [0.5, 0.72], [0.28, 0.83], [0.72, 0.83]]
  };
  function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
  function cover(ctx, img) { const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); }

  function Renderer(canvas, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.game = game;
    this.scale = 1; this.dpr = 1; this.images = {}; this.courts = {}; this.flyers = []; this.labels = []; this.hover = null; this.backPattern = null;
    this.resize(); root.addEventListener('resize', () => this.resize());
  }
  const P = Renderer.prototype;
  P.resize = function () {
    const vw = root.innerWidth, vh = root.innerHeight, s = Math.min(vw / W, vh / H);
    this.scale = s; this.dpr = Math.min(2, root.devicePixelRatio || 1);
    const stage = document.getElementById('stage'); if (stage) stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    this.canvas.width = Math.round(W * s * this.dpr); this.canvas.height = Math.round(H * s * this.dpr);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
  };
  P.loadImages = function (files) {
    return Promise.all(Object.keys(files).map(k => new Promise(res => { const img = new Image(); img.onload = () => { if (k.length === 2) this.courts[k] = img; else this.images[k] = img; res(); }; img.onerror = () => res(); img.src = files[k]; })));
  };
  P.update = function (dt) { this.flyers = this.flyers.filter(f => (f.t += dt) < f.dur); this.labels = this.labels.filter(l => (l.t += dt) < l.dur); };
  P.fly = function (from, to, color, dur, n) { for (let i = 0; i < (n || 1); i++) this.flyers.push({ x0: from.x + (Math.random() - 0.5) * 10, y0: from.y, x1: to.x + (Math.random() - 0.5) * 12, y1: to.y, color: color, t: -i * 0.05, dur: dur || 0.6 }); };
  P.label = function (x, y, text, color) { this.labels.push({ x: x, y: y, text: text, color: color || '#ffe9a8', t: 0, dur: 1.8 }); };

  /* seat hand geometry: hand h of n hands at seat i → card anchor (first card centre) */
  P.handAnchor = function (seatIndex, h, n) {
    const p = SEAT_POS[seatIndex], spread = n > 1 ? 150 : 0, x = p.x + (h - (n - 1) / 2) * spread;
    return { x: x - 20, y: p.y - 150 };
  };
  P.cardPos = function (anchor, idx, size) { return { x: anchor.x + idx * (size.w * 0.42), y: anchor.y - idx * 6 }; };

  P.draw = function (now) {
    const ctx = this.ctx, S = this.scale * this.dpr; this.now = now;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    this.drawBackground(ctx); this.drawTable(ctx); this.drawShoeAndTray(ctx);
    this.drawSeats(ctx, now); this.drawDealerHand(ctx, now); this.drawCards(ctx, now);
    this.drawFlyers(ctx); FX.drawParticles(ctx); this.drawLabels(ctx); FX.drawFlash(ctx, W, H);
  };
  P.drawBackground = function (ctx) {
    const img = this.images.bg; ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, 0, W, H);
    if (img) cover(ctx, img);
    const v = ctx.createRadialGradient(W / 2, H * 0.45, 200, W / 2, H * 0.45, 1300); v.addColorStop(0, 'rgba(0,0,0,0.05)'); v.addColorStop(1, 'rgba(0,0,0,0.8)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  };
  P.tablePath = function (ctx, inset) {
    const cx = 960, cy = 170, rx = 940 - inset, ry = 760 - inset;
    ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath();
  };
  P.drawTable = function (ctx) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = '#2a140a'; this.tablePath(ctx, 0); ctx.fill(); ctx.restore();
    let g = ctx.createLinearGradient(0, 170, 0, 930); g.addColorStop(0, '#5a2b14'); g.addColorStop(0.5, '#3d1a0b'); g.addColorStop(1, '#6a3418'); ctx.fillStyle = g; this.tablePath(ctx, 0); ctx.fill();
    /* padded armrest */
    g = ctx.createLinearGradient(0, 200, 0, 900); g.addColorStop(0, '#14110f'); g.addColorStop(1, '#2a2420'); ctx.fillStyle = g; this.tablePath(ctx, 34); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(233,194,80,0.35)'; this.tablePath(ctx, 36); ctx.stroke();
    /* felt */
    g = ctx.createRadialGradient(960, 300, 100, 960, 500, 900); g.addColorStop(0, '#1f6a40'); g.addColorStop(0.7, '#175633'); g.addColorStop(1, '#0f4027'); ctx.fillStyle = g; this.tablePath(ctx, 74); ctx.fill();
    if (!this.noise) { const c = document.createElement('canvas'); c.width = c.height = 256; const cx = c.getContext('2d'), id = cx.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 60; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } cx.putImageData(id, 0, 0); this.noise = ctx.createPattern(c, 'repeat'); }
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = this.noise; this.tablePath(ctx, 74); ctx.fill(); ctx.restore();
    const sp = ctx.createRadialGradient(960, 220, 60, 960, 220, 900); sp.addColorStop(0, 'rgba(255,240,200,0.12)'); sp.addColorStop(1, 'rgba(0,0,0,0.2)'); ctx.fillStyle = sp; this.tablePath(ctx, 74); ctx.fill();
    /* printed arcs */
    this.arcText(ctx, 'BLACKJACK PAYS 3 TO 2', 960, 170, 330, 34, '700 34px ' + SERIF, 'rgba(248,244,220,0.9)');
    this.arcText(ctx, 'Dealer must draw to 16 and stand on all 17s', 960, 170, 390, 18, 'italic 600 20px ' + SERIF, 'rgba(248,244,220,0.8)');
    this.arcText(ctx, 'INSURANCE PAYS 2 TO 1', 960, 170, 445, 22, '700 24px ' + SERIF, 'rgba(248,244,220,0.85)');
    /* insurance line */
    ctx.save(); ctx.strokeStyle = 'rgba(248,244,220,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.ellipse(960, 170, 480, 480 * 0.82, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke(); ctx.restore();
    const logo = this.images.logo; if (logo) { ctx.save(); ctx.globalAlpha = 0.35; const lw = 360, lh = lw * logo.height / logo.width; ctx.drawImage(logo, 960 - lw / 2, 560 - lh / 2, lw, lh); ctx.restore(); }
  };
  P.arcText = function (ctx, text, cx, cy, r, size, font, color) {
    ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const widths = text.split('').map(ch => ctx.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0);
    /* lower arc, read from the players' side: the first glyph sits on the left (angle > 90°) and the angle decreases */
    let a = Math.PI / 2 + total / (2 * r);
    text.split('').forEach((ch, i) => { const w = widths[i], mid = a - w / (2 * r); ctx.save(); ctx.translate(cx + Math.cos(mid) * r, cy + Math.sin(mid) * r * 0.82); ctx.rotate(mid - Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore(); a -= w / r; });
    ctx.restore();
  };
  P.drawShoeAndTray = function (ctx) {
    const g = this.game;
    /* shoe */
    ctx.save(); ctx.translate(SHOE.x, SHOE.y); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    let gr = ctx.createLinearGradient(-90, -40, 90, 60); gr.addColorStop(0, '#2b2b33'); gr.addColorStop(1, '#0d0d12'); ctx.fillStyle = gr; roundRect(ctx, -92, -46, 184, 96, 14); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const left = g.shoe ? g.shoe.length - g.shoePos : 0, stackH = Math.max(6, Math.min(60, left / 5));
    for (let i = 0; i < stackH; i += 2) { ctx.fillStyle = i % 4 ? '#f2eee0' : '#d9d4c2'; ctx.fillRect(-70 + i * 0.3, -30 - i * 0.35, 120, 2); }
    this.drawCardBack(ctx, -74 + stackH * 0.3, -36 - stackH * 0.35, 120, 70, true);
    ctx.fillStyle = '#c9a84a'; ctx.font = '700 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('SHOE · ' + left + ' CARDS', 0, 64); ctx.restore();
    /* discard tray */
    ctx.save(); ctx.translate(TRAY.x, TRAY.y); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    gr = ctx.createLinearGradient(-60, -50, 60, 60); gr.addColorStop(0, 'rgba(120,20,30,0.55)'); gr.addColorStop(1, 'rgba(60,8,14,0.7)'); ctx.fillStyle = gr; roundRect(ctx, -62, -52, 124, 100, 10); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const disc = Math.min(40, (g.discards || 0) / 6);
    for (let i = 0; i < disc; i++) { ctx.fillStyle = i % 3 ? '#f2eee0' : '#d9d4c2'; ctx.fillRect(-50, 38 - i * 2, 100, 2); }
    if (disc > 0) this.drawCardBack(ctx, -52, 36 - disc * 2 - 60, 104, 60, true);
    ctx.fillStyle = '#c9a84a'; ctx.font = '700 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('DISCARDS', 0, 66); ctx.restore();
  };

  /* ---------------------------------------------------------------- cards */
  P.backPatternFill = function (ctx) {
    if (!this.backPattern) { const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d'); x.fillStyle = '#8c1c24'; x.fillRect(0, 0, 24, 24); x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(24, 24); x.moveTo(24, 0); x.lineTo(0, 24); x.stroke(); x.fillStyle = 'rgba(255,215,120,0.35)'; x.beginPath(); x.arc(12, 12, 3, 0, TAU); x.fill(); this.backPattern = ctx.createPattern(c, 'repeat'); }
    return this.backPattern;
  };
  P.drawCardBack = function (ctx, x, y, w, h, flat) {
    ctx.save(); if (!flat) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5; }
    ctx.fillStyle = '#f7f4ea'; roundRect(ctx, x, y, w, h, w * 0.08); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = this.backPatternFill(ctx); roundRect(ctx, x + w * 0.07, y + w * 0.07, w - w * 0.14, h - w * 0.14, w * 0.05); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,120,0.7)'; ctx.lineWidth = Math.max(1, w * 0.012); roundRect(ctx, x + w * 0.11, y + w * 0.11, w - w * 0.22, h - w * 0.22, w * 0.04); ctx.stroke();
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, w * 0.22); g.addColorStop(0, '#fff2c4'); g.addColorStop(1, '#b8860b'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.17, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a1a1a'; ctx.font = '900 ' + Math.round(w * 0.2) + 'px ' + SERIF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BJ', x + w / 2, y + h / 2 + 1); ctx.restore();
  };
  P.drawCardFace = function (ctx, card, x, y, w, h) {
    const red = RED(card.suit), col = red ? '#c8102e' : '#161618', glyph = SUIT_GLYPH[card.suit], r = card.rank;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#efebdf'); ctx.fillStyle = g; roundRect(ctx, x, y, w, h, w * 0.08); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, w * 0.08); ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const idxSize = Math.round(w * 0.2), m = w * 0.1;
    const corner = (cx, cy, rot) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.font = '700 ' + idxSize + 'px ' + FONT; ctx.fillText(r, 0, 0); ctx.font = Math.round(idxSize * 0.95) + 'px ' + SUIT_FONT; ctx.fillText(glyph, 0, idxSize * 0.95); ctx.restore(); };
    corner(x + m + idxSize * 0.3, y + m + idxSize * 0.55, 0); corner(x + w - m - idxSize * 0.3, y + h - m - idxSize * 0.55, Math.PI);
    const ix = x + w * 0.2, iy = y + h * 0.12, iw = w * 0.6, ih = h * 0.76;
    if (r === 'A') { ctx.font = Math.round(w * 0.62) + 'px ' + SUIT_FONT; ctx.fillText(glyph, x + w / 2, y + h / 2 + w * 0.04); }
    else if (PIPS[r]) { ctx.font = Math.round(w * 0.22) + 'px ' + SUIT_FONT; PIPS[r].forEach(p => { const px = ix + p[0] * iw, py = iy + p[1] * ih; ctx.save(); ctx.translate(px, py); if (p[1] > 0.5) ctx.rotate(Math.PI); ctx.fillText(glyph, 0, w * 0.02); ctx.restore(); }); }
    else {
      const img = this.courts[r + card.suit];
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(ix, iy, iw, ih);
      if (img) { ctx.save(); ctx.beginPath(); ctx.rect(ix + 1, iy + 1, iw - 2, ih - 2); ctx.clip(); const sc = Math.max((iw - 4) / img.width, (ih - 4) / img.height) * 0.98, dw = img.width * sc, dh = img.height * sc; ctx.drawImage(img, ix + iw / 2 - dw / 2, iy + ih / 2 - dh / 2, dw, dh); ctx.restore(); }
      else { const cg = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih); cg.addColorStop(0, red ? '#f3d9d9' : '#dfe3ee'); cg.addColorStop(1, red ? '#d9a0a6' : '#a8b0c8'); ctx.fillStyle = cg; ctx.fillRect(ix + 1, iy + 1, iw - 2, ih - 2); ctx.fillStyle = col; ctx.font = '900 ' + Math.round(w * 0.5) + 'px ' + SERIF; ctx.fillText(r, x + w / 2, y + h / 2); }
      ctx.font = Math.round(w * 0.14) + 'px ' + SUIT_FONT; ctx.fillStyle = col; ctx.fillText(glyph, ix + w * 0.08, iy + w * 0.1); ctx.save(); ctx.translate(ix + iw - w * 0.08, iy + ih - w * 0.1); ctx.rotate(Math.PI); ctx.fillText(glyph, 0, 0); ctx.restore();
    }
    ctx.restore();
  };
  /* card view object: {card, x, y, w, h, faceUp, anim:{x0,y0,x1,y1,t0,dur}, flip:{t0,dur,to}} */
  P.drawCardView = function (ctx, v, now) {
    let x = v.x, y = v.y, rot = 0;
    if (v.anim) { const u = Math.min(1, (now - v.anim.t0) / v.anim.dur), e = 1 - Math.pow(1 - u, 3); x = v.anim.x0 + (v.anim.x1 - v.anim.x0) * e; y = v.anim.y0 + (v.anim.y1 - v.anim.y0) * e - Math.sin(u * Math.PI) * 40; rot = (1 - e) * 0.5; if (u >= 1) { v.anim = null; v.x = x; v.y = y; } }
    let scaleX = 1, face = v.faceUp;
    if (v.flip) { const u = Math.min(1, (now - v.flip.t0) / v.flip.dur); scaleX = Math.abs(Math.cos(u * Math.PI)); face = u < 0.5 ? !v.flip.to : v.flip.to; if (u >= 1) { v.flip = null; v.faceUp = face; scaleX = 1; } }
    ctx.save(); ctx.translate(x + v.w / 2, y + v.h / 2); ctx.rotate(rot); ctx.scale(Math.max(0.04, scaleX), 1 + (1 - scaleX) * 0.06); ctx.translate(-v.w / 2, -v.h / 2);
    if (face) this.drawCardFace(ctx, v.card, 0, 0, v.w, v.h); else this.drawCardBack(ctx, 0, 0, v.w, v.h, false);
    ctx.restore();
  };
  P.drawCards = function (ctx, now) { this.game.views.forEach(v => this.drawCardView(ctx, v, now)); };

  /* -------------------------------------------------------------- seats */
  P.drawChipStack = function (ctx, x, y, amount, color, textColor, showAmount) {
    if (amount <= 0) return;
    const denoms = BJ.CHIPS.slice().reverse(); let rest = amount, k = 0;
    const list = [];
    denoms.forEach(d => { while (rest >= d.value && list.length < 12) { list.push(d); rest -= d.value; } });
    if (rest > 0) list.push(BJ.CHIPS[0]);
    list.forEach((d, i) => { this.drawChip(ctx, x, y - i * 4, color || d.color, null, textColor, 16); k = i; });
    if (showAmount) { ctx.save(); ctx.font = '800 15px ' + FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6; ctx.fillText(fmt(amount), x, y - k * 4 - 1); ctx.restore(); }
  };
  P.drawChip = function (ctx, x, y, color, text, textColor, r) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.72);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
    ctx.fillStyle = shade(color, -0.4); ctx.beginPath(); ctx.arc(0, 4, r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, shade(color, 0.25)); g.addColorStop(1, shade(color, -0.08)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = r * 0.18; ctx.setLineDash([r * 0.5, r * 0.55]); ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = shade(color, 0.08); ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.fill();
    if (text) { ctx.fillStyle = textColor || '#fff'; ctx.font = '900 ' + Math.round(r * 0.8) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.scale(1, 1.38); ctx.fillText(text, 0, 1); }
    ctx.restore();
  };
  P.drawSeats = function (ctx, now) {
    const g = this.game;
    g.seats.forEach((seat, i) => {
      const p = SEAT_POS[i], active = seat.active, mine = seat.human;
      ctx.save();
      /* betting circle */
      ctx.lineWidth = 3; ctx.strokeStyle = active ? (mine && g.selectedSeat === i && g.state === 'betting' ? 'rgba(255,230,140,0.95)' : 'rgba(248,244,220,0.75)') : 'rgba(248,244,220,0.25)';
      if (mine && g.selectedSeat === i && g.state === 'betting') { ctx.shadowColor = 'rgba(255,220,120,0.9)'; ctx.shadowBlur = 18; }
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 46, 34, 0, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
      if (!active) { ctx.fillStyle = 'rgba(248,244,220,0.45)'; ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(seat.optional ? 'OPEN SEAT' : 'EMPTY', p.x, p.y); }
      /* name plate */
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, p.x - 92, p.y + 44, 184, 40, 8); ctx.fill();
      ctx.fillStyle = seat.color; ctx.beginPath(); ctx.arc(p.x - 76, p.y + 64, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f3e9c8'; ctx.font = '700 15px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(seat.name, p.x - 62, p.y + 57);
      ctx.fillStyle = '#e9c250'; ctx.font = '800 15px ' + FONT; ctx.fillText(active ? fmt(seat.shown != null ? seat.shown : seat.bankroll) : '', p.x - 62, p.y + 74);
      /* chips on the circle (per hand when split) */
      if (active && seat.hands && seat.hands.length) {
        seat.hands.forEach((h, hi) => { const a = this.handAnchor(i, hi, seat.hands.length); const cx = seat.hands.length > 1 ? a.x + 40 : p.x, cy = seat.hands.length > 1 ? a.y + 150 : p.y; this.drawChipStack(ctx, cx, cy, h.bet, mine ? null : seat.color, mine ? null : seat.textColor, true); if (h.insurance) this.drawChipStack(ctx, cx + 48, cy + 10, h.insurance, mine ? null : seat.color, mine ? null : seat.textColor, true); });
      } else if (active && seat.bet > 0) this.drawChipStack(ctx, p.x, p.y, seat.bet, mine ? null : seat.color, mine ? null : seat.textColor, true);
      /* hand badges */
      if (active && seat.hands) seat.hands.forEach((h, hi) => {
        const a = this.handAnchor(i, hi, seat.hands.length), size = SEAT_CARD, cx = a.x + size.w * 0.42 * (h.cards.length - 1) / 2 + size.w / 2, by = a.y - 24;
        const t = K.handTotal(h.cards);
        let text = h.surrendered ? 'SURRENDER' : t.bust ? 'BUST' : (t.natural && !h.fromSplit) ? 'BLACKJACK' : (t.soft && t.total !== 21 ? 'SOFT ' : '') + t.total;
        if (h.result != null && g.state === 'settle') text = h.result > 0 ? 'WIN +' + fmt(h.result) : h.result < 0 ? 'LOSE' : 'PUSH';
        const current = g.state === 'playing' && g.turn && g.turn.seat === i && g.turn.hand === hi;
        ctx.save(); ctx.font = '800 15px ' + FONT; const tw = ctx.measureText(text).width + 22;
        ctx.fillStyle = current ? 'rgba(233,194,80,0.95)' : t.bust ? 'rgba(160,30,30,0.9)' : (h.result > 0 && g.state === 'settle') ? 'rgba(30,120,60,0.95)' : 'rgba(0,0,0,0.65)';
        if (current) { ctx.shadowColor = 'rgba(255,220,120,0.9)'; ctx.shadowBlur = 16; }
        roundRect(ctx, cx - tw / 2, by - 13, tw, 26, 13); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = current ? '#2a1a00' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, by + 1); ctx.restore();
      });
      ctx.restore();
    });
  };
  P.drawDealerHand = function (ctx) {
    const g = this.game, d = g.dealer;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(ctx, DEALER.x - 190, DEALER.y - 96, 380, 190, 16); ctx.fill(); ctx.restore();
    if (d && d.cards.length && (g.state === 'dealer' || g.state === 'settle' || (g.state === 'playing' && d.revealed))) {
      const t = K.handTotal(d.cards.filter((c, i) => d.revealed || i === 0));
      let text = d.revealed ? (t.bust ? 'DEALER BUSTS' : t.natural ? 'BLACKJACK' : (t.soft && t.total !== 21 ? 'SOFT ' : '') + t.total) : 'SHOWING ' + t.total;
      ctx.save(); ctx.font = '800 16px ' + FONT; const tw = ctx.measureText(text).width + 24; ctx.fillStyle = t.bust && d.revealed ? 'rgba(160,30,30,0.9)' : 'rgba(0,0,0,0.7)'; roundRect(ctx, DEALER.x - tw / 2, DEALER.y + 104, tw, 28, 14); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, DEALER.x, DEALER.y + 119); ctx.restore();
    }
  };
  P.drawFlyers = function (ctx) { this.flyers.forEach(f => { if (f.t < 0) return; const u = f.t / f.dur, e = 1 - Math.pow(1 - u, 2), x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(u * Math.PI) * 50; ctx.save(); ctx.globalAlpha = 1 - Math.pow(u, 6); this.drawChip(ctx, x, y, f.color, null, null, 14); ctx.restore(); }); };
  P.drawLabels = function (ctx) { this.labels.forEach(l => { const u = l.t / l.dur; ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.font = '900 30px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8; ctx.fillStyle = l.color; ctx.fillText(l.text, l.x, l.y - u * 50); ctx.restore(); }); };

  BJ.Renderer = Renderer;
})(window);
