export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseSpeed = 210;
    this.speed = 210;
    this.equippedWeapon = null;

    // Angles: decoupled head/aim vs body torso
    this.aimAngle = 0;
    this.bodyAngle = 0;
    this.turnLimit = 0.85;

    // Procedural walk animation
    this.walkCycle = 0;
    this.isMoving = false;

    // Procedural weapon recoil physics (spring-damper)
    this.recoilKick = 0;
    this.recoilRot = 0;
    this.recoilVelocity = 0;
    this.recoilRotVelocity = 0;

    // Muzzle flash timer
    this.muzzleFlashTimer = 0;
    this.lastMuzzleWorldPos = { x: 0, y: 0 };

    // Reload IK Animation State
    this.reloadProgress = 0;
    this.isReloading = false;
    this.droppedMagThisCycle = false;
    this.onMagDropCallback = null;

    // ADS (Aim Down Sights) State
    this.isAiming = false;
    this.adsProgress = 0; // 0.0 (Hipfire) to 1.0 (Full ADS)
  }

  applyRecoil(forceVertical, forceHorizontal) {
    // Recoil kick is damped while in ADS
    const adsDamp = 1.0 - this.adsProgress * 0.35;
    this.recoilKick = Math.min(16, this.recoilKick + forceVertical * 2.2 * adsDamp);
    this.recoilRot += (Math.random() - 0.5) * (forceHorizontal * 0.04 * adsDamp);
    this.muzzleFlashTimer = 0.06;
  }

  update(keys, mousePos, dt) {
    // 1. Dynamic movement speed factoring weapon weight & ADS state
    let speedMult = 1.0;
    if (this.equippedWeapon) {
      speedMult -= (this.equippedWeapon.weightPenalty || 0);
    }
    // Slower tactical walk while aiming
    if (this.isAiming) {
      speedMult *= 0.65;
    }
    this.speed = this.baseSpeed * Math.max(0.2, speedMult);

    // 2. Smooth ADS Transition (Interpolate based on weapon's adsTime)
    const adsRate = 1.0 / (this.equippedWeapon?.adsTime || 0.22);
    if (this.isAiming) {
      this.adsProgress = Math.min(1.0, this.adsProgress + adsRate * dt);
    } else {
      this.adsProgress = Math.max(0.0, this.adsProgress - adsRate * dt);
    }

    // 3. WASD Movement Input
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['W']) dy -= 1;
    if (keys['s'] || keys['S']) dy += 1;
    if (keys['a'] || keys['A']) dx -= 1;
    if (keys['d'] || keys['D']) dx += 1;

    const moveDist = Math.hypot(dx, dy);
    this.isMoving = moveDist > 0;

    if (this.isMoving) {
      dx /= moveDist;
      dy /= moveDist;
      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;
      this.walkCycle += dt * (this.speed * 0.05);
    }

    // 4. Aim Angle & Decoupled Torso Rotation
    this.aimAngle = Math.atan2(mousePos.y - this.y, mousePos.x - this.x);

    let angleDiff = this.aimAngle - this.bodyAngle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    // Torso locks tighter to aim while ADS
    const activeTurnLimit = this.isAiming ? 0.45 : this.turnLimit;
    if (this.isMoving || this.isAiming) {
      this.bodyAngle += angleDiff * 10 * dt;
    } else {
      if (Math.abs(angleDiff) > activeTurnLimit) {
        const excess = angleDiff > 0 ? angleDiff - activeTurnLimit : angleDiff + activeTurnLimit;
        this.bodyAngle += excess * 14 * dt;
      }
    }

    // 5. Spring-Damper Recoil Recovery
    const springK = 180;
    const damping = 16;
    const springAcc = -springK * this.recoilKick - damping * this.recoilVelocity;
    this.recoilVelocity += springAcc * dt;
    this.recoilKick += this.recoilVelocity * dt;
    if (this.recoilKick < 0) {
      this.recoilKick = 0;
      this.recoilVelocity = 0;
    }

    const rotSpringAcc = -springK * this.recoilRot - damping * this.recoilRotVelocity;
    this.recoilRotVelocity += rotSpringAcc * dt;
    this.recoilRot += this.recoilRotVelocity * dt;

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
    }

    // 6. Reload Progression
    if (this.equippedWeapon && this.equippedWeapon.isReloading) {
      this.isReloading = true;
      const totalTime = this.equippedWeapon.reloadTime;
      const elapsed = totalTime - this.equippedWeapon.reloadTimer;
      this.reloadProgress = Math.min(1.0, Math.max(0.0, elapsed / totalTime));

      if (this.reloadProgress >= 0.25 && !this.droppedMagThisCycle) {
        this.droppedMagThisCycle = true;
        if (this.onMagDropCallback) {
          this.onMagDropCallback(this.x, this.y, this.aimAngle, this.equippedWeapon);
        }
      }
    } else {
      this.isReloading = false;
      this.reloadProgress = 0;
      this.droppedMagThisCycle = false;
    }
  }

  solveIK(startX, startY, targetX, targetY, len1, len2, bendDirection = 1) {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.hypot(dx, dy);

    const maxReach = (len1 + len2) * 0.999;
    const clampedDist = Math.max(1, Math.min(dist, maxReach));

    const baseAngle = Math.atan2(dy, dx);
    const cosAngle1 = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
    const angle1 = Math.acos(Math.max(-1, Math.min(1, cosAngle1)));

    const jointAngle = baseAngle + bendDirection * angle1;
    const elbowX = startX + Math.cos(jointAngle) * len1;
    const elbowY = startY + Math.sin(jointAngle) * len1;

    return { elbowX, elbowY };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // ================= 1. LOWER BODY: BOOTS & TORSO =================
    ctx.save();
    ctx.rotate(this.bodyAngle);

    const strideLen = 14;
    const legOffset1 = Math.sin(this.walkCycle) * strideLen;
    const legOffset2 = -Math.sin(this.walkCycle) * strideLen;

    const leftFootY = -12;
    const rightFootY = 12;
    const leftFootX = this.isMoving ? legOffset1 : 0;
    const rightFootX = this.isMoving ? legOffset2 : 0;

    ctx.fillStyle = '#1e242b';
    ctx.strokeStyle = '#0f141a';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(leftFootX, leftFootY, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(rightFootX, rightFootY, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const bobbing = this.isMoving ? Math.abs(Math.sin(this.walkCycle * 2)) * 2 : 0;
    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 + bobbing * 0.2, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#1a202c';
    ctx.fillRect(-6, -8, 12, 16);
    ctx.restore();

    // ================= 2. UPPER BODY & KINEMATIC RIG =================
    ctx.save();

    let reloadGunTilt = 0;
    let reloadGunOffsetBack = 0;
    if (this.isReloading) {
      const tiltPhase = Math.sin(this.reloadProgress * Math.PI);
      reloadGunTilt = -0.32 * tiltPhase;
      reloadGunOffsetBack = 4 * tiltPhase;
    }

    ctx.rotate(this.aimAngle + this.recoilRot + reloadGunTilt);

    // Helmet & NVG Mount
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(-2, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.fillRect(4, -5, 4, 10);

    const leftShoulder = { x: 2, y: -13 };
    const rightShoulder = { x: -2, y: 13 };

    // In ADS, gun slides horizontally to align centered with line of sight (Y -> 0)
    const hipfireGunY = 4;
    const adsGunY = 0; // Exactly centered with the shooter's dominant eye/crosshair
    const gunOriginY = hipfireGunY + (adsGunY - hipfireGunY) * this.adsProgress;

    const gunOriginX = (18 - (this.adsProgress * 3)) - this.recoilKick - reloadGunOffsetBack;

    const w = this.equippedWeapon;
    const gunProfile = w?.profile || { barrelLength: 80, receiverLength: 90 };

    const rightHandGrip = { x: gunOriginX + 6, y: gunOriginY + 2 };
    const restingForegrip = { x: gunOriginX + Math.min(38, (gunProfile.barrelLength || 60) * 0.4), y: gunOriginY };

    let dynamicLeftHand = { ...restingForegrip };
    let holdingFreshMag = false;

    if (this.isReloading) {
      const p = this.reloadProgress;
      const magWellX = gunOriginX + 16;
      const magWellY = gunOriginY + 1;
      const pouchX = -2;
      const pouchY = -12;
      const chargingHandleX = gunOriginX + 8;
      const chargingHandleY = gunOriginY - 5;

      if (p < 0.20) {
        const t = p / 0.20;
        dynamicLeftHand.x = restingForegrip.x + (magWellX - restingForegrip.x) * t;
        dynamicLeftHand.y = restingForegrip.y + (magWellY - restingForegrip.y) * t;
      } else if (p < 0.45) {
        const t = (p - 0.20) / 0.25;
        dynamicLeftHand.x = magWellX + (pouchX - magWellX) * t;
        dynamicLeftHand.y = magWellY + (pouchY - magWellY) * t;
      } else if (p < 0.70) {
        const t = (p - 0.45) / 0.25;
        dynamicLeftHand.x = pouchX + (magWellX - pouchX) * t;
        dynamicLeftHand.y = pouchY + (magWellY - pouchY) * t;
        holdingFreshMag = true;
      } else if (p < 0.88) {
        const t = (p - 0.70) / 0.18;
        const rackPull = Math.sin(t * Math.PI) * 5;
        dynamicLeftHand.x = chargingHandleX - rackPull;
        dynamicLeftHand.y = chargingHandleY;
      } else {
        const t = (p - 0.88) / 0.12;
        dynamicLeftHand.x = chargingHandleX + (restingForegrip.x - chargingHandleX) * t;
        dynamicLeftHand.y = chargingHandleY + (restingForegrip.y - chargingHandleY) * t;
      }
    }

    const upperArmLen = 15;
    const foreArmLen = 14;

    const leftIK = this.solveIK(leftShoulder.x, leftShoulder.y, dynamicLeftHand.x, dynamicLeftHand.y, upperArmLen, foreArmLen, -1);
    const rightIK = this.solveIK(rightShoulder.x, rightShoulder.y, rightHandGrip.x, rightHandGrip.y, upperArmLen, foreArmLen, 1);

    // Arms
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(leftShoulder.x, leftShoulder.y);
    ctx.lineTo(leftIK.elbowX, leftIK.elbowY);
    ctx.lineTo(dynamicLeftHand.x, dynamicLeftHand.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightShoulder.x, rightShoulder.y);
    ctx.lineTo(rightIK.elbowX, rightIK.elbowY);
    ctx.lineTo(rightHandGrip.x, rightHandGrip.y);
    ctx.stroke();

    // Weapon
    const isMagInGun = !this.isReloading || this.reloadProgress < 0.25 || this.reloadProgress > 0.68;
    this.drawTopDownWeapon(ctx, gunOriginX, gunOriginY, w, isMagInGun);

    if (holdingFreshMag) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(dynamicLeftHand.x - 3, dynamicLeftHand.y - 2, 7, 10);
    }

    // Gloves
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(dynamicLeftHand.x, dynamicLeftHand.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rightHandGrip.x, rightHandGrip.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Muzzle flash
    const muzzleTipX = gunOriginX + (gunProfile.barrelLength || 80) * 0.45 + 28;
    if (this.muzzleFlashTimer > 0) {
      this.drawMuzzleFlash(ctx, muzzleTipX, gunOriginY);
    }

    const cosAim = Math.cos(this.aimAngle + reloadGunTilt);
    const sinAim = Math.sin(this.aimAngle + reloadGunTilt);
    this.lastMuzzleWorldPos = {
      x: this.x + cosAim * muzzleTipX - sinAim * gunOriginY,
      y: this.y + sinAim * muzzleTipX + cosAim * gunOriginY
    };

    ctx.restore();
    ctx.restore();
  }

  drawTopDownWeapon(ctx, ox, oy, weapon, isMagInGun = true) {
    if (!weapon) return;
    const p = weapon.profile || {};
    const atts = weapon.attachments || {};
    const barrelLen = (p.barrelLength || 80) * 0.42;

    ctx.save();

    if (atts.underbarrel === 'laser_sight') {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox + barrelLen + 10, oy);
      ctx.lineTo(ox + 1000, oy);
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(ox + 980, oy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#111827';
    ctx.fillRect(ox - 16, oy - 2.5, 16, 5);
    ctx.fillStyle = '#030712';
    ctx.fillRect(ox - 17, oy - 4, 3, 8);

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(ox + 12, oy - 1.5, barrelLen, 3);

    const hgLen = Math.min(barrelLen - 8, 36);
    ctx.fillStyle = '#161b22';
    ctx.fillRect(ox + 12, oy - 3.5, hgLen, 7);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 12, oy - 3.5, hgLen, 7);

    ctx.fillStyle = '#090d13';
    for (let vx = ox + 16; vx < ox + 12 + hgLen - 4; vx += 6) {
      ctx.fillRect(vx, oy - 2.5, 3, 5);
    }

    const muzzleTipX = ox + 12 + barrelLen;
    if (atts.barrel === 'suppressor') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(muzzleTipX, oy - 4.5, 22, 9);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(muzzleTipX, oy - 4.5, 22, 9);
      ctx.fillStyle = '#020617';
      ctx.fillRect(muzzleTipX + 21, oy - 2, 2, 4);
    } else if (atts.barrel === 'compensator' || atts.barrel === 'muzzle_brake') {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(muzzleTipX, oy - 3.5, 8, 7);
      ctx.fillStyle = '#000000';
      ctx.fillRect(muzzleTipX + 2, oy - 3.5, 2, 7);
    } else {
      ctx.fillStyle = '#374151';
      ctx.fillRect(muzzleTipX, oy - 2.5, 6, 5);
    }

    ctx.fillStyle = weapon.color || '#2d333b';
    ctx.fillRect(ox, oy - 4.5, 28, 9);
    ctx.strokeStyle = '#484f58';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy - 4.5, 28, 9);

    ctx.fillStyle = '#0f141a';
    for (let rx = ox + 2; rx < ox + 26; rx += 4) {
      ctx.fillRect(rx, oy - 4.5, 2, 9);
    }

    ctx.fillStyle = '#090d13';
    ctx.fillRect(ox + 8, oy - 4.5, 9, 3);
    ctx.fillStyle = '#d29922';
    ctx.fillRect(ox + 10, oy - 3.5, 4, 1.5);

    if (isMagInGun) {
      ctx.fillStyle = atts.ammo === 'armor_piercing' ? '#1d4ed8' : '#111827';
      ctx.fillRect(ox + 12, oy - 4, 8, 8);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox + 13, oy - 3.5, 6, 7);
    }

    if (atts.optic === 'red_dot' || atts.optic === 'coyote') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox + 8, oy - 4, 11, 8);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + 17, oy - 2.5, 2, 5);
    } else if (atts.optic === 'acog') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(ox + 4, oy - 4.5, 18, 9);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + 6, oy - 0.5, 12, 1);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(ox + 20, oy - 3, 2, 6);
    } else if (atts.optic === 'sniper_scope') {
      ctx.fillStyle = '#090d13';
      ctx.fillRect(ox - 2, oy - 4.5, 26, 9);
      ctx.fillStyle = '#374151';
      ctx.fillRect(ox + 2, oy - 5.5, 3, 11);
      ctx.fillRect(ox + 18, oy - 5.5, 3, 11);
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(ox + 10, oy - 6, 4, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(ox + 23, oy - 3.5, 2, 7);
    }

    ctx.restore();
  }

  drawMuzzleFlash(ctx, tipX, tipY) {
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + 22, tipY - 8);
    ctx.lineTo(tipX + 16, tipY - 2);
    ctx.lineTo(tipX + 28, tipY);
    ctx.lineTo(tipX + 16, tipY + 2);
    ctx.lineTo(tipX + 22, tipY + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tipX + 4, tipY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}