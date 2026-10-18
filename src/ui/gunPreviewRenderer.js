export class GunPreviewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  // Utility helper for shaded metal/polymer parts
  drawBeveledBox(ctx, x, y, w, h, baseColor, highlightColor, shadowColor, radius = 2) {
    ctx.save();
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x + 2, y + 3, w, h);

    // Base body
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, w, h);

    // Top highlight rim
    ctx.fillStyle = highlightColor;
    ctx.fillRect(x, y, w, 1.5);

    // Bottom shadow rim
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x, y + h - 1.5, w, 1.5);
    ctx.restore();
  }

  // Picatinny rail section generator
  drawRail(ctx, x, y, width) {
    ctx.fillStyle = '#1e242b';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = '#0f141a';
    for (let rx = x; rx < x + width - 3; rx += 5) {
      ctx.fillRect(rx, y, 2.5, 4);
    }
  }

  render(weapon) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!weapon || !weapon.profile) {
      return {
        optic: { x: 300, y: 130 },
        barrel: { x: 500, y: 160 },
        underbarrel: { x: 380, y: 190 },
        other: { x: 180, y: 160 },
        ammo: { x: 290, y: 220 }
      };
    }

    const p = weapon.profile;
    const atts = weapon.attachments || {};
    const ox = 250;
    const oy = 160;

    // Background technical inspection grid
    this.drawInspectionGrid(ctx);

    // ================= 1. REAR STOCK & BUFFER TUBE =================
    const stockPos = this.renderStock(ctx, ox, oy, p, atts, weapon.color);

    // ================= 2. MAIN RECEIVER & ACTION =================
    this.renderReceiver(ctx, ox, oy, p, atts, weapon);

    // ================= 3. MAGAZINE & WELL =================
    const ammoPos = this.renderMagazine(ctx, ox, oy, p, atts);

    // ================= 4. BARREL, HANDGUARD & HEAT SHIELD =================
    const barrelEnd = this.renderBarrelAndHandguard(ctx, ox, oy, p, atts);

    // ================= 5. MUZZLE DEVICE =================
    const muzzlePos = this.renderMuzzleDevice(ctx, barrelEnd.x, barrelEnd.y, atts);

    // ================= 6. UNDERBARREL ACCESSORIES =================
    const underbarrelPos = this.renderUnderbarrel(ctx, ox, oy, p, atts);

    // ================= 7. OPTIC & RAIL SIGHT =================
    const opticPos = this.renderOptic(ctx, ox, oy, p, atts);

    // Return the precise node coordinates for GunsmithUI
    return {
      optic: opticPos,
      barrel: muzzlePos,
      underbarrel: underbarrelPos,
      other: stockPos,
      ammo: ammoPos
    };
  }

  drawInspectionGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = '#161d27';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }

    // Measurement axis markers
    ctx.strokeStyle = '#2b3648';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, 290);
    ctx.lineTo(760, 290);
    ctx.stroke();
    for (let mx = 40; mx <= 760; mx += 60) {
      ctx.beginPath();
      ctx.moveTo(mx, 286);
      ctx.lineTo(mx, 294);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderStock(ctx, ox, oy, p, atts, baseColor) {
    if (p.layout === 'bullpup') {
      // Integrated Bullpup Stock Housing
      this.drawBeveledBox(ctx, ox - 90, oy - p.receiverHeight / 2, 90, p.receiverHeight + 6, '#232931', '#374151', '#111827');
      // Recoil Pad
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(ox - 94, oy - p.receiverHeight / 2 - 2, 7, p.receiverHeight + 10);
      // Cheek riser
      this.drawBeveledBox(ctx, ox - 70, oy - p.receiverHeight / 2 - 6, 45, 6, '#1a1f26', '#2b3442', '#0d1117');
      return { x: ox - 94, y: oy };
    }

    if (atts.other === 'fold_stock') {
      // Skeletonized Wire Stock
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(ox - 75, oy - 10, 72, 16);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox - 78, oy - 14, 5, 24);
      return { x: ox - 78, y: oy };
    }

    if (atts.other === 'heavy_stock' || p.stockType === 'heavy_cheek') {
      // PRS Precision Sniper Stock
      this.drawBeveledBox(ctx, ox - 110, oy - 16, 105, 42, '#21262d', '#30363d', '#0d1117');
      // Adjustable cheek riser plate
      this.drawBeveledBox(ctx, ox - 95, oy - 24, 52, 9, '#161b22', '#2d333b', '#090d13');
      // Knurled thumbwheels
      ctx.fillStyle = '#484f58';
      ctx.fillRect(ox - 90, oy - 14, 8, 4);
      ctx.fillRect(ox - 58, oy - 14, 8, 4);
      // Heavy rubber buttpad with ridged serrations
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(ox - 114, oy - 18, 8, 46);
      for (let s = oy - 16; s < oy + 26; s += 6) {
        ctx.fillStyle = '#30363d';
        ctx.fillRect(ox - 114, s, 8, 2);
      }
      return { x: ox - 114, y: oy + 4 };
    }

    if (p.stockType === 'wooden_solid') {
      // Stained Walnut / Hardwood Stock
      ctx.fillStyle = '#5c3a21';
      ctx.beginPath();
      ctx.moveTo(ox, oy - p.receiverHeight / 2 + 4);
      ctx.lineTo(ox - 95, oy - 4);
      ctx.lineTo(ox - 98, oy + 36);
      ctx.lineTo(ox, oy + p.receiverHeight / 2);
      ctx.closePath();
      ctx.fill();

      // Wood grain layers
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox - 15, oy);
      ctx.quadraticCurveTo(ox - 50, oy + 10, ox - 90, oy + 8);
      ctx.moveTo(ox - 25, oy + 12);
      ctx.quadraticCurveTo(ox - 60, oy + 22, ox - 94, oy + 20);
      ctx.stroke();

      // Steel buttplate
      ctx.fillStyle = '#1e242b';
      ctx.fillRect(ox - 102, oy - 6, 6, 44);
      return { x: ox - 102, y: oy + 16 };
    }

    // Standard Multi-Position Carbine Buffer Tube
    this.drawBeveledBox(ctx, ox - 80, oy - 6, 78, 12, '#30363d', '#484f58', '#161b22');
    // Collapsible Stock Body
    this.drawBeveledBox(ctx, ox - 75, oy - 12, 55, 28, '#21262d', '#30363d', '#0d1117');
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(ox - 82, oy - 14, 8, 32);
    // Adjustment pin lever
    ctx.fillStyle = '#484f58';
    ctx.fillRect(ox - 55, oy + 16, 16, 4);

    return { x: ox - 82, y: oy + 2 };
  }

  renderReceiver(ctx, ox, oy, p, atts, weapon) {
    const rY = oy - p.receiverHeight / 2;

    // Receiver Primary Upper/Lower Housing
    this.drawBeveledBox(ctx, ox, rY, p.receiverLength, p.receiverHeight, weapon.color || '#2d333b', '#484f58', '#161b22');

    // Upper Picatinny Rail
    this.drawRail(ctx, ox + 10, rY - 4, p.receiverLength - 15);

    // Ejection Port & Bolt Carrier Group
    const ejectX = p.layout === 'bullpup' ? ox - 45 : ox + 35;
    const ejectY = rY + 5;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(ejectX, ejectY, 32, 11);
    ctx.fillStyle = '#8b949e';
    ctx.fillRect(ejectX + 6, ejectY + 2, 18, 7);
    ctx.fillStyle = '#d29922';
    ctx.fillRect(ejectX + 2, ejectY + 3, 5, 5);

    // Deflector hump
    ctx.fillStyle = '#1e242b';
    ctx.beginPath();
    ctx.moveTo(ejectX - 2, ejectY);
    ctx.lineTo(ejectX - 7, ejectY + 6);
    ctx.lineTo(ejectX - 2, ejectY + 11);
    ctx.closePath();
    ctx.fill();

    // Assembly Takedown Pins
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(ox + 15, rY + p.receiverHeight - 8, 3, 0, Math.PI * 2);
    ctx.arc(ox + p.receiverLength - 15, rY + p.receiverHeight - 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Fire Mode Selector lever
    const selX = ox + 24;
    const selY = rY + p.receiverHeight - 12;
    ctx.fillStyle = '#8b949e';
    ctx.beginPath();
    ctx.arc(selX, selY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f85149';
    ctx.beginPath();
    ctx.moveTo(selX, selY);
    ctx.lineTo(selX + 6, selY - 4);
    ctx.stroke();

    // Ergonomic A2 Pistol Grip
    const gripX = p.layout === 'bullpup' ? ox + 40 : ox + 14;
    const gripY = rY + p.receiverHeight;
    ctx.fillStyle = '#161b22';
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(gripX + 22, gripY);
    ctx.lineTo(gripX + 14, gripY + 42);
    ctx.lineTo(gripX - 4, gripY + 40);
    ctx.closePath();
    ctx.fill();

    // Texture ribs
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 1.5;
    for (let gy = gripY + 10; gy < gripY + 36; gy += 6) {
      ctx.beginPath();
      ctx.moveTo(gripX + 2, gy);
      ctx.lineTo(gripX + 16, gy);
      ctx.stroke();
    }

    // Trigger Guard & Trigger
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2;
    ctx.strokeRect(gripX + 18, gripY, 20, 14);
    ctx.strokeStyle = '#c9d1d9';
    ctx.beginPath();
    ctx.arc(gripX + 30, gripY + 4, 8, 0.4, Math.PI * 0.7);
    ctx.stroke();
  }

  renderMagazine(ctx, ox, oy, p, atts) {
    const magSlotX = p.layout === 'bullpup' ? ox - 54 : ox + 56;
    const magSlotY = oy + p.receiverHeight / 2;
    const magColor = atts.ammo === 'armor_piercing' ? '#1f6feb' : (atts.ammo === 'hollow_point' ? '#b08800' : '#1e242b');

    if (p.magType === 'curved_m4' || p.magType === 'curved_ak') {
      ctx.save();
      ctx.fillStyle = magColor;
      ctx.beginPath();
      ctx.moveTo(magSlotX, magSlotY);
      ctx.lineTo(magSlotX + 24, magSlotY);
      ctx.quadraticCurveTo(magSlotX + 28, magSlotY + 28, magSlotX + 16, magSlotY + 54);
      ctx.lineTo(magSlotX - 8, magSlotY + 50);
      ctx.quadraticCurveTo(magSlotX + 4, magSlotY + 26, magSlotX, magSlotY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      for (let my = magSlotY + 12; my < magSlotY + 44; my += 7) {
        ctx.beginPath();
        ctx.moveTo(magSlotX + 2, my);
        ctx.lineTo(magSlotX + 20, my + 3);
        ctx.stroke();
      }
      ctx.restore();
      return { x: magSlotX + 8, y: magSlotY + 54 };
    } else if (p.magType === 'straight_stick') {
      this.drawBeveledBox(ctx, magSlotX, magSlotY, 18, 48, magColor, '#30363d', '#0d1117');
      return { x: magSlotX + 9, y: magSlotY + 48 };
    } else if (p.magType === 'heavy_box') {
      this.drawBeveledBox(ctx, magSlotX - 6, magSlotY, 36, 50, magColor, '#30363d', '#0d1117');
      return { x: magSlotX + 12, y: magSlotY + 50 };
    } else if (p.magType === 'drum_big') {
      ctx.save();
      ctx.fillStyle = '#161b22';
      ctx.beginPath();
      ctx.arc(magSlotX + 12, magSlotY + 28, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0d1117';
      ctx.beginPath();
      ctx.arc(magSlotX + 12, magSlotY + 28, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return { x: magSlotX + 12, y: magSlotY + 58 };
    } else if (p.magType === 'top_mount_p90') {
      ctx.fillStyle = 'rgba(56, 139, 253, 0.25)';
      ctx.fillRect(ox + 5, oy - p.receiverHeight / 2 - 12, 90, 11);
      ctx.strokeStyle = '#388bfd';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 5, oy - p.receiverHeight / 2 - 12, 90, 11);
      ctx.fillStyle = '#d29922';
      for (let ax = ox + 15; ax < ox + 85; ax += 7) {
        ctx.fillRect(ax, oy - p.receiverHeight / 2 - 9, 4, 6);
      }
      return { x: ox + 50, y: oy - p.receiverHeight / 2 - 14 };
    }

    return { x: magSlotX + 10, y: magSlotY + 40 };
  }

  renderBarrelAndHandguard(ctx, ox, oy, p, atts) {
    let barrelLen = p.barrelLength;
    if (atts.barrel === 'long_barrel') barrelLen += 45;
    if (atts.barrel === 'short_barrel') barrelLen -= 35;

    const bX = ox + p.receiverLength;
    const bY = oy - p.receiverHeight / 2 + p.barrelYOffset;

    // Steel Barrel
    this.drawBeveledBox(ctx, bX, bY, barrelLen, p.integralSuppressor ? 22 : 11, '#30363d', '#484f58', '#161b22');

    // Fluting
    if (!p.integralSuppressor) {
      ctx.fillStyle = '#161b22';
      for (let fx = bX + 40; fx < bX + barrelLen - 10; fx += 10) {
        ctx.fillRect(fx, bY + 3, 6, 5);
      }
    }

    // Ventilated Handguard
    const guardLen = Math.min(barrelLen - 25, 95);
    if (guardLen > 20) {
      const hgY = oy - p.receiverHeight / 2 + 1;
      const hgH = p.receiverHeight - 4;
      this.drawBeveledBox(ctx, bX - 5, hgY, guardLen, hgH, '#1e242b', '#2b3648', '#0d1117');

      ctx.fillStyle = '#090d13';
      for (let sx = bX + 12; sx < bX + guardLen - 15; sx += 18) {
        ctx.fillRect(sx, hgY + 6, 12, 5);
        ctx.fillRect(sx, hgY + hgH - 11, 12, 5);
      }

      this.drawRail(ctx, bX - 5, hgY - 4, guardLen);
    }

    return { x: bX + barrelLen, y: bY + (p.integralSuppressor ? 11 : 5.5) };
  }

  renderMuzzleDevice(ctx, mX, mY, atts) {
    if (atts.barrel === 'suppressor') {
      this.drawBeveledBox(ctx, mX, mY - 12, 56, 25, '#161b22', '#262c36', '#090d13');
      ctx.fillStyle = '#30363d';
      for (let kx = mX + 2; kx < mX + 16; kx += 3) {
        for (let ky = mY - 10; ky < mY + 11; ky += 4) {
          ctx.fillRect(kx, ky, 1.5, 1.5);
        }
      }
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(mX + 54, mY - 7, 4, 15);
      return { x: mX + 56, y: mY };
    } else if (atts.barrel === 'compensator') {
      this.drawBeveledBox(ctx, mX, mY - 8, 22, 17, '#8b949e', '#c9d1d9', '#484f58');
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(mX + 4, mY - 6, 4, 6);
      ctx.fillRect(mX + 12, mY - 6, 4, 6);
      return { x: mX + 22, y: mY };
    } else if (atts.barrel === 'muzzle_brake') {
      this.drawBeveledBox(ctx, mX, mY - 10, 24, 21, '#6e7681', '#8b949e', '#30363d');
      ctx.fillStyle = '#090d13';
      ctx.beginPath();
      ctx.moveTo(mX + 6, mY - 8);
      ctx.lineTo(mX + 12, mY);
      ctx.lineTo(mX + 6, mY + 8);
      ctx.closePath();
      ctx.fill();
      return { x: mX + 24, y: mY };
    }

    // Default A2 flash hider
    this.drawBeveledBox(ctx, mX, mY - 6, 14, 13, '#30363d', '#484f58', '#161b22');
    ctx.fillStyle = '#090d13';
    ctx.fillRect(mX + 4, mY - 4, 6, 2);
    ctx.fillRect(mX + 4, mY + 3, 6, 2);
    return { x: mX + 14, y: mY };
  }

  renderUnderbarrel(ctx, ox, oy, p, atts) {
    const railBottomX = ox + p.receiverLength + 15;
    const railBottomY = oy + p.receiverHeight / 2 - 2;

    if (atts.underbarrel === 'vertical_grip') {
      this.drawBeveledBox(ctx, railBottomX, railBottomY, 16, 36, '#161b22', '#30363d', '#090d13');
      ctx.fillStyle = '#090d13';
      for (let gy = railBottomY + 8; gy < railBottomY + 32; gy += 6) {
        ctx.fillRect(railBottomX, gy, 16, 2);
      }
      return { x: railBottomX + 8, y: railBottomY + 36 };
    } else if (atts.underbarrel === 'angled_grip') {
      ctx.fillStyle = '#161b22';
      ctx.beginPath();
      ctx.moveTo(railBottomX, railBottomY);
      ctx.lineTo(railBottomX + 36, railBottomY);
      ctx.lineTo(railBottomX + 22, railBottomY + 24);
      ctx.lineTo(railBottomX + 6, railBottomY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return { x: railBottomX + 18, y: railBottomY + 24 };
    } else if (atts.underbarrel === 'laser_sight') {
      this.drawBeveledBox(ctx, railBottomX, railBottomY, 30, 12, '#2d333b', '#484f58', '#161b22');
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(railBottomX + 28, railBottomY + 3, 3, 5);

      ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(railBottomX + 31, railBottomY + 5.5);
      ctx.lineTo(this.canvas.width - 20, railBottomY + 5.5);
      ctx.stroke();
      return { x: railBottomX + 15, y: railBottomY + 12 };
    }

    return { x: railBottomX + 12, y: railBottomY + 14 };
  }

  renderOptic(ctx, ox, oy, p, atts) {
    const railTopX = ox + 32;
    const railTopY = oy - p.receiverHeight / 2 - 4;

    if (atts.optic === 'red_dot' || atts.optic === 'coyote') {
      this.drawBeveledBox(ctx, railTopX, railTopY - 20, 34, 20, '#161b22', '#30363d', '#090d13');
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fillRect(railTopX + 6, railTopY - 17, 20, 13);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(railTopX + 16, railTopY - 10, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#484f58';
      ctx.fillRect(railTopX + 13, railTopY - 23, 7, 3);
      return { x: railTopX + 17, y: railTopY - 20 };
    } else if (atts.optic === 'acog') {
      this.drawBeveledBox(ctx, railTopX - 6, railTopY - 26, 52, 26, '#262c36', '#3b4354', '#11151c');
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(railTopX + 6, railTopY - 28, 26, 2.5);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(railTopX + 43, railTopY - 22, 4, 18);
      return { x: railTopX + 20, y: railTopY - 26 };
    } else if (atts.optic === 'sniper_scope') {
      this.drawBeveledBox(ctx, railTopX - 16, railTopY - 30, 88, 24, '#111827', '#1f2937', '#030712');
      this.drawBeveledBox(ctx, railTopX + 58, railTopY - 33, 16, 30, '#161b22', '#30363d', '#090d13');
      this.drawBeveledBox(ctx, railTopX - 22, railTopY - 32, 12, 28, '#161b22', '#30363d', '#090d13');
      ctx.fillStyle = '#374151';
      ctx.fillRect(railTopX + 2, railTopY - 8, 8, 8);
      ctx.fillRect(railTopX + 42, railTopY - 8, 8, 8);
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(railTopX + 22, railTopY - 35, 10, 5);
      ctx.fillRect(railTopX + 24, railTopY - 22, 6, 6);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(railTopX + 71, railTopY - 30, 3, 24);
      return { x: railTopX + 28, y: railTopY - 30 };
    }

    // Default iron sight rail spot
    return { x: railTopX + 16, y: railTopY - 4 };
  }
}