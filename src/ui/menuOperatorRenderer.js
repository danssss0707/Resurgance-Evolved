export class MenuOperatorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animTime = 0;
    this.currentWeapon = null;
    this.isRunning = false;

    this.startLoop();
  }

  setWeapon(weapon) {
    this.currentWeapon = weapon;
    this.render();
  }

  startLoop() {
    this.isRunning = true;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      this.animTime += dt;

      if (this.canvas.offsetParent !== null) {
        this.render();
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Operator Base Ground Position (Anchored near bottom)
    const ox = w * 0.50;
    const oy = h * 0.96;

    // Subtle idle breathing
    const breathe = Math.sin(this.animTime * 1.8) * 2.8;
    const shoulderBob = Math.sin(this.animTime * 1.8 - 0.3) * 2.2;

    ctx.save();

    // ================= GLOBAL 1.5X SCALE MATRIX =================
    // Translate origin to boot level, apply 1.48x uniform upscale, then draw
    ctx.translate(ox, oy);
    ctx.scale(1.48, 1.48);
    ctx.translate(-ox, -oy);

    // 1. Floor Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.ellipse(ox, oy, 140, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Balanced hip & torso top coordinates
    const hipY = oy - 235;
    const torsoTopY = hipY - 210 + breathe;

    // 2. Legs & Heavy Boots
    this.drawLegs(ctx, ox, oy, hipY);

    // 3. Heavy Torso / Plate Carrier
    this.drawTorso(ctx, ox, torsoTopY, hipY, shoulderBob);

    // 4. Neck Column
    const neckBaseY = torsoTopY + shoulderBob * 0.7;
    this.drawNeck(ctx, ox, neckBaseY);

    // 5. Head & Helmet (High profile, tough look)
    const headCenterY = neckBaseY - 44;
    this.drawHead(ctx, ox, headCenterY);

    // 6. Tactical Arms & Held Weapon
    this.drawArmsAndWeapon(ctx, ox, torsoTopY, breathe);

    ctx.restore(); // END SCALE MATRIX
  }

  drawLegs(ctx, ox, oy, hipY) {
    ctx.fillStyle = '#1c2128';
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 2.5;

    const kneeY = hipY + (oy - hipY) * 0.48;
    const bootTopY = oy - 42;

    // Left Leg
    ctx.beginPath();
    ctx.moveTo(ox - 64, hipY);
    ctx.lineTo(ox - 70, kneeY);
    ctx.lineTo(ox - 60, bootTopY);
    ctx.lineTo(ox - 20, bootTopY);
    ctx.lineTo(ox - 24, kneeY);
    ctx.lineTo(ox - 14, hipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Leg
    ctx.beginPath();
    ctx.moveTo(ox + 64, hipY);
    ctx.lineTo(ox + 70, kneeY);
    ctx.lineTo(ox + 60, bootTopY);
    ctx.lineTo(ox + 20, bootTopY);
    ctx.lineTo(ox + 24, kneeY);
    ctx.lineTo(ox + 14, hipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inseam Shadow
    ctx.fillStyle = '#10141a';
    ctx.beginPath();
    ctx.moveTo(ox - 16, hipY);
    ctx.lineTo(ox, hipY + 36);
    ctx.lineTo(ox + 16, hipY);
    ctx.closePath();
    ctx.fill();

    // Molded Tactical Knee Armor
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(ox - 72, kneeY - 24, 44, 48);
    ctx.fillRect(ox + 28, kneeY - 24, 44, 48);

    // Reinforced Combat Boots
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath();
    ctx.roundRect(ox - 78, bootTopY, 60, 44, [6, 12, 4, 4]);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(ox + 18, bootTopY, 60, 44, [12, 6, 4, 4]);
    ctx.fill();
  }

  drawTorso(ctx, ox, topY, hipY, bob) {
    const shoulderWidth = 104;
    const waistWidth = 68;

    // Under-layer Combat Shirt
    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.moveTo(ox - shoulderWidth, topY + 28 + bob);
    ctx.lineTo(ox + shoulderWidth, topY + 28 + bob);
    ctx.lineTo(ox + waistWidth, hipY);
    ctx.lineTo(ox - waistWidth, hipY);
    ctx.closePath();
    ctx.fill();

    // Deltoid Shoulder Pads
    ctx.fillStyle = '#1e242b';
    ctx.beginPath();
    ctx.roundRect(ox - shoulderWidth - 4, topY + 12 + bob, 28, 48, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(ox + shoulderWidth - 24, topY + 12 + bob, 28, 48, 6);
    ctx.fill();

    // Heavy Duty Utility Belt
    ctx.fillStyle = '#111620';
    ctx.fillRect(ox - waistWidth - 6, hipY - 24, (waistWidth + 6) * 2, 24);
    ctx.fillStyle = '#475569';
    ctx.fillRect(ox - 16, hipY - 22, 32, 20); // Cobra Buckle

    // Right Hip Holster
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(ox + waistWidth - 8, hipY - 14, 20, 36);

    // Large Front Plate Carrier
    ctx.fillStyle = '#18202c';
    ctx.strokeStyle = '#0f141c';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(ox - 64, topY);
    ctx.lineTo(ox + 64, topY);
    ctx.lineTo(ox + 58, hipY - 18);
    ctx.lineTo(ox - 58, hipY - 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shoulder Harness Straps
    ctx.fillStyle = '#10151f';
    ctx.fillRect(ox - 58, topY - 16 + bob, 26, 42);
    ctx.fillRect(ox + 32, topY - 16 + bob, 26, 42);

    // Ceramic Plate Inset Rim
    ctx.strokeStyle = '#283344';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 48, topY + 18, 96, 72);

    // Triple MOLLE Ammo Pouches
    ctx.fillStyle = '#222b3a';
    for (let r = 0; r < 3; r++) {
      ctx.fillRect(ox - 48 + r * 34, topY + 104, 28, 54);
      ctx.fillStyle = '#0f141c';
      ctx.fillRect(ox - 48 + r * 34, topY + 104, 28, 14);
      ctx.fillStyle = '#222b3a';
    }

    // Radio PTT Unit on Chest
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(ox - 54, topY + 28, 18, 30);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(ox - 48, topY + 34, 5, 5);
  }

  drawNeck(ctx, ox, neckBaseY) {
    ctx.fillStyle = '#171c23';
    ctx.fillRect(ox - 18, neckBaseY - 26, 36, 30);

    ctx.fillStyle = '#0c1017';
    ctx.beginPath();
    ctx.ellipse(ox, neckBaseY + 2, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHead(ctx, ox, hy) {
    // Balaclava & Jaw
    ctx.fillStyle = '#1c222b';
    ctx.beginPath();
    ctx.ellipse(ox, hy + 10, 24, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // FAST Ballistic Helmet
    ctx.fillStyle = '#333c4d';
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ox, hy - 4, 34, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
    ctx.stroke();

    // NVG Front Shroud
    ctx.fillStyle = '#111827';
    ctx.fillRect(ox - 10, hy - 20, 20, 20);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox - 6, hy - 16, 12, 10);

    // Headset Ear Cups
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(ox - 40, hy - 4, 10, 26);
    ctx.fillRect(ox + 30, hy - 4, 10, 26);

    // Boom Mic
    ctx.strokeStyle = '#0f141c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox - 35, hy + 16);
    ctx.quadraticCurveTo(ox - 20, hy + 30, ox - 6, hy + 26);
    ctx.stroke();

    // Ballistic Goggles
    ctx.fillStyle = '#030712';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(ox - 24, hy - 4, 48, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Lens Glint
    ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.beginPath();
    ctx.moveTo(ox - 18, hy - 2);
    ctx.lineTo(ox - 6, hy - 2);
    ctx.lineTo(ox - 12, hy + 11);
    ctx.lineTo(ox - 22, hy + 11);
    ctx.closePath();
    ctx.fill();
  }

  drawArmsAndWeapon(ctx, ox, ty, breathe) {
    const w = this.currentWeapon;
    const atts = w?.attachments || {};

    const gunX = ox - 20;
    const gunY = ty + 96 + breathe;
    const gunAngle = -0.18;

    // Draw Held Weapon
    ctx.save();
    ctx.translate(gunX, gunY);
    ctx.rotate(gunAngle);
    this.drawHeldWeapon(ctx, w, atts);
    ctx.restore();

    // Arms
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Right Arm (Trigger hand)
    ctx.beginPath();
    ctx.moveTo(ox + 82, ty + 26);
    ctx.lineTo(ox + 78, ty + 96);
    ctx.lineTo(gunX + 35, gunY + 2);
    ctx.stroke();

    // Left Arm (Foregrip support)
    ctx.beginPath();
    ctx.moveTo(ox - 82, ty + 26);
    ctx.lineTo(ox - 64, ty + 116);
    ctx.lineTo(gunX - 55, gunY - 14);
    ctx.stroke();

    // Tactical Gloves
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(gunX + 35, gunY + 4, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(gunX - 55, gunY - 12, 15, 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawHeldWeapon(ctx, w, atts) {
    if (!w) return;
    const baseColor = w.color || '#2d333b';

    // Receiver Body
    ctx.fillStyle = baseColor;
    ctx.fillRect(-60, -10, 110, 20);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.strokeRect(-60, -10, 110, 20);

    // Stock
    ctx.fillStyle = '#161b22';
    ctx.fillRect(50, -8, 65, 16);
    ctx.fillStyle = '#090d13';
    ctx.fillRect(112, -12, 10, 24);

    // Barrel
    let barrelLen = 95;
    if (atts.barrel === 'long_barrel') barrelLen += 35;
    if (atts.barrel === 'short_barrel') barrelLen -= 25;

    ctx.fillStyle = '#30363d';
    ctx.fillRect(-60 - barrelLen, -6, barrelLen, 12);

    // Muzzle
    const muzzleTipX = -60 - barrelLen;
    if (atts.barrel === 'suppressor') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(muzzleTipX - 42, -9, 42, 18);
    } else if (atts.barrel === 'compensator' || atts.barrel === 'muzzle_brake') {
      ctx.fillStyle = '#8b949e';
      ctx.fillRect(muzzleTipX - 16, -8, 16, 16);
    }

    // Magazine
    ctx.fillStyle = atts.ammo === 'armor_piercing' ? '#1d4ed8' : '#111827';
    ctx.fillRect(-15, 10, 20, 36);

    // Optics
    if (atts.optic === 'red_dot' || atts.optic === 'coyote') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(-25, -24, 28, 14);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-22, -21, 3, 8);
    } else if (atts.optic === 'acog') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-35, -26, 46, 16);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-33, -24, 3, 12);
    } else if (atts.optic === 'sniper_scope') {
      ctx.fillStyle = '#090d13';
      ctx.fillRect(-45, -28, 70, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-43, -26, 4, 14);
    }

    // Underbarrel Laser
    if (atts.underbarrel === 'laser_sight') {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-55, 6, 20, 8);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-55, 10);
      ctx.lineTo(-450, 45);
      ctx.stroke();
    }
  }
}