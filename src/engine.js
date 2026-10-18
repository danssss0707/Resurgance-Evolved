import { Player } from './player.js';

export class Engine {
  constructor(canvas, player, network = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.player = player;
    this.network = network;

    this.bullets = [];
    this.remoteBullets = [];
    this.casings = [];
    this.particles = [];
    this.droppedMags = [];
    this.damageNumbers = [];
    this.hitmarkers = [];

    // Screen Shake & Recoil
    this.cameraShake = {
      x: 0,
      y: 0,
      decay: 14,
      maxOffset: 36,
      aftershockTimer: 0,
      aftershockIntensity: 0
    };

    // Concussion Vignette
    this.concussionVignette = {
      opacity: 0,
      decayRate: 0.75,
      tunnelSqueeze: 0,
      sustainedFireCount: 0
    };

    // Red Damage Hurt Vignette
    this.damageFlash = {
      opacity: 0,
      decayRate: 2.0 // Fades out in ~0.5s
    };

    // Suppression State
    this.suppression = {
      intensity: 0,
      decayRate: 2.2
    };

    // Camera Zoom & Tracking State
    this.camera = {
      x: player.x,
      y: player.y,
      zoom: 1.0,
      targetZoom: 1.0,
      leadDist: 0,
      targetLeadDist: 0
    };

    // Target dummies
    this.targets = [
      { x: player.x + 400, y: player.y - 150, hp: 100, maxHp: 100, radius: 24, name: 'Close Dummy', hitFlash: 0 },
      { x: player.x + 750, y: player.y, hp: 100, maxHp: 100, radius: 24, name: 'Mid Dummy', hitFlash: 0 },
      { x: player.x + 1100, y: player.y + 150, hp: 100, maxHp: 100, radius: 24, name: 'Far Dummy', hitFlash: 0 }
    ];

    this.keys = {};
    this.mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      isDown: false,
      rightDown: false,
      justPressed: false
    };

    this.lastTime = performance.now();
    this.running = false;

    this.burstRemaining = 0;
    this.nextBurstShotTime = 0;
    this.openBoltTimer = 0;

    this.remoteRendererDummy = new Player(0, 0);

    // Magazine Drop Hook
    this.player.onMagDropCallback = (px, py, aimAngle, weapon) => {
      const dropAngle = aimAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      const speed = 40 + Math.random() * 30;
      this.droppedMags.push({
        x: px + Math.cos(aimAngle) * 16,
        y: py + Math.sin(aimAngle) * 16,
        vx: Math.cos(dropAngle) * speed,
        vy: Math.sin(dropAngle) * speed,
        rot: aimAngle,
        vRot: (Math.random() - 0.5) * 8,
        life: 5.0,
        opacity: 1,
        magType: weapon?.profile?.magType || 'curved_m4'
      });
    };

    this.setupNetworkHooks();
    this.resize();
    this.setupListeners();
  }

  setupNetworkHooks() {
    if (!this.network) return;

    this.network.onPeerShoot = (senderId, muzzle, bullets) => {
      for (const b of bullets) {
        this.remoteBullets.push({
          x: b.x,
          y: b.y,
          prevX: b.x,
          prevY: b.y,
          vx: b.vx,
          vy: b.vy,
          travelDist: 0,
          maxDist: b.maxDist || 2200,
          owner: senderId
        });
      }
      const peer = this.network.remotePlayers.get(senderId);
      if (peer) {
        peer.muzzleFlashTimer = 0.06;
        peer.lastMuzzleWorldPos = muzzle;
      }
    };

    this.network.onPeerDamage = (targetPeerId, damage, isKill, attackerId) => {
      if (targetPeerId === this.network.peerId) {
        this.player.hp = Math.max(0, (this.player.hp || 100) - damage);
        this.triggerRedDamageFlash(damage);
        this.addSuppressionImpulse(1.0);

        if (this.player.hp <= 0) {
          this.player.hp = 100;
          this.player.x = 160 + (Math.random() - 0.5) * 100;
          this.player.y = 360 + (Math.random() - 0.5) * 100;
        }
      } else {
        const victim = this.network.remotePlayers.get(targetPeerId);
        if (victim) {
          victim.hp = Math.max(0, victim.hp - damage);
          victim.hitFlash = 0.15;
          this.spawnDamageNumber(victim.x, victim.y, damage, isKill);
          if (isKill) victim.hp = 100;
        }
      }
    };
  }

  triggerRedDamageFlash(damage) {
    const flashStrength = Math.min(0.9, 0.45 + (damage / 100) * 0.5);
    this.damageFlash.opacity = Math.max(this.damageFlash.opacity, flashStrength);

    this.cameraShake.x += (Math.random() - 0.5) * 22;
    this.cameraShake.y += (Math.random() - 0.5) * 22;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  snapCameraToPlayer() {
    this.resize();
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.zoom = 1.0;
    this.camera.leadDist = 0;
  }

  setupListeners() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if ((e.key === 'r' || e.key === 'R') && this.player.equippedWeapon) {
        this.startReload(this.player.equippedWeapon);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.isDown = true;
        this.mouse.justPressed = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.mouse.rightDown = true;
        this.player.isAiming = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.isDown = false;
        this.openBoltTimer = 0;
        this.concussionVignette.sustainedFireCount = 0;
      } else if (e.button === 2) {
        this.mouse.rightDown = false;
        this.player.isAiming = false;
      }
    });
  }

  startReload(weapon) {
    if (weapon.isReloading || weapon.currentAmmo === weapon.magSize) return;
    weapon.isReloading = true;
    weapon.reloadTimer = weapon.reloadTime;
  }

  computeDamage(weapon, distance) {
    if (!weapon) return 25;
    const dStart = weapon.rangeDropStart || 60;
    const dEnd = weapon.rangeDropEnd || 180;
    const dMax = weapon.damageMax || 35;
    const dMin = weapon.damageMin || 20;
    if (distance <= dStart) return dMax;
    if (distance >= dEnd) return dMin;
    const factor = (distance - dStart) / (dEnd - dStart);
    return dMax - factor * (dMax - dMin);
  }

  addScreenShake(weapon, shotAngle) {
    const baseForce = weapon.recoilVertical || 2.0;
    const pelletBonus = (weapon.bulletCount || 1) > 1 ? Math.sqrt(weapon.bulletCount) * 1.4 : 1.0;
    const velocityScale = (weapon.muzzleVelocity || 2200) / 2500;
    const adsDamp = 1.0 - (this.player.adsProgress * 0.35);

    const impulseStrength = Math.min(
      this.cameraShake.maxOffset,
      baseForce * pelletBonus * velocityScale * 2.3 * adsDamp
    );

    const kickAngle = shotAngle + Math.PI;
    const backKickX = Math.cos(kickAngle) * impulseStrength;
    const backKickY = Math.sin(kickAngle) * impulseStrength;

    const sideJitter = (Math.random() - 0.5) * impulseStrength * 0.55;
    const sideAngle = shotAngle + Math.PI / 2;
    const sideX = Math.cos(sideAngle) * sideJitter;
    const sideY = Math.sin(sideAngle) * sideJitter;

    this.cameraShake.x += backKickX + sideX;
    this.cameraShake.y += backKickY + sideY;

    if (baseForce >= 9.0) {
      this.cameraShake.aftershockTimer = 0.45;
      this.cameraShake.aftershockIntensity = baseForce * 0.4;
    }
  }

  addSuppressionImpulse(intensity = 0.6) {
    this.suppression.intensity = Math.min(1.0, this.suppression.intensity + intensity);
    this.cameraShake.x += (Math.random() - 0.5) * 16 * intensity;
    this.cameraShake.y += (Math.random() - 0.5) * 16 * intensity;
  }

  addConcussionVignette(weapon) {
    const recoilV = weapon.recoilVertical || 1.0;
    const isShotgun = (weapon.bulletCount || 1) > 1;

    if (recoilV >= 13.0) {
      this.concussionVignette.opacity = 0.88;
      this.concussionVignette.tunnelSqueeze = 0.55;
      this.concussionVignette.decayRate = 0.65;
      return;
    }

    if (recoilV >= 9.0) {
      this.concussionVignette.opacity = Math.max(this.concussionVignette.opacity, 0.55);
      this.concussionVignette.tunnelSqueeze = 0.35;
      this.concussionVignette.decayRate = 0.85;
      return;
    }

    if (isShotgun && recoilV >= 4.0) {
      this.concussionVignette.opacity = Math.max(this.concussionVignette.opacity, 0.38);
      this.concussionVignette.tunnelSqueeze = 0.20;
      this.concussionVignette.decayRate = 1.1;
      return;
    }

    if (weapon.category === 'LMG') {
      this.concussionVignette.sustainedFireCount++;
      if (this.concussionVignette.sustainedFireCount > 6) {
        this.concussionVignette.opacity = Math.min(0.55, this.concussionVignette.opacity + 0.08);
        this.concussionVignette.tunnelSqueeze = Math.min(0.40, this.concussionVignette.tunnelSqueeze + 0.05);
        this.concussionVignette.decayRate = 0.9;
      }
    }
  }

  spawnHitmarker(isKill = false) {
    this.hitmarkers.push({
      x: this.mouse.x,
      y: this.mouse.y,
      isKill: isKill,
      life: 0.16,
      maxLife: 0.16,
      scale: isKill ? 1.4 : 1.0
    });
  }

  spawnDamageNumber(x, y, damage, isKill = false) {
    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 25,
      vy: -(45 + Math.random() * 25),
      vx: (Math.random() - 0.5) * 15,
      damage: Math.round(damage),
      isKill: isKill,
      life: 0.85,
      maxLife: 0.85,
      scale: isKill ? 1.4 : 1.0
    });
  }

  spawnProjectiles(weapon) {
    this.player.applyRecoil(weapon.recoilVertical, weapon.recoilHorizontal);
    this.addScreenShake(weapon, this.player.aimAngle);
    this.addConcussionVignette(weapon);

    const ejectAngle = this.player.aimAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    const ejectSpeed = 90 + Math.random() * 60;
    this.casings.push({
      x: this.player.x + Math.cos(this.player.aimAngle) * 16,
      y: this.player.y + Math.sin(this.player.aimAngle) * 16,
      vx: Math.cos(ejectAngle) * ejectSpeed,
      vy: Math.sin(ejectAngle) * ejectSpeed,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 20,
      life: 2.2,
      opacity: 1
    });

    const velocityMultiplier = 0.95;
    const currentSpread = weapon.spread * (1.0 - (this.player.adsProgress * 0.75));
    const newBullets = [];

    let muzzleX = this.player.x + Math.cos(this.player.aimAngle) * 32;
    let muzzleY = this.player.y + Math.sin(this.player.aimAngle) * 32;

    if (this.player.lastMuzzleWorldPos && Number.isFinite(this.player.lastMuzzleWorldPos.x)) {
      muzzleX = this.player.lastMuzzleWorldPos.x;
      muzzleY = this.player.lastMuzzleWorldPos.y;
    }

    for (let i = 0; i < weapon.bulletCount; i++) {
      const spreadRad = ((Math.random() - 0.5) * currentSpread * Math.PI) / 180;
      const recoilOffset = ((Math.random() - 0.5) * weapon.recoilHorizontal * (1.0 - this.player.adsProgress * 0.35) * Math.PI) / 180;
      const angle = this.player.aimAngle + spreadRad + recoilOffset;

      const speed = (weapon.muzzleVelocity || 2400) * velocityMultiplier;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const bObj = {
        x: muzzleX,
        y: muzzleY,
        prevX: muzzleX,
        prevY: muzzleY,
        vx: vx,
        vy: vy,
        weaponRef: weapon,
        travelDist: 0,
        maxDist: 2500
      };
      this.bullets.push(bObj);
      newBullets.push(bObj);
    }

    if (this.network) {
      this.network.broadcastShot({ x: muzzleX, y: muzzleY }, newBullets);
    }
  }

  handleFiring(dt, nowSec) {
    const weapon = this.player.equippedWeapon;
    if (!weapon) return;

    if (weapon.isReloading) {
      weapon.reloadTimer -= dt;
      if (weapon.reloadTimer <= 0) {
        weapon.isReloading = false;
        weapon.currentAmmo = weapon.magSize;
      }
      return;
    }

    if (weapon.isCycling) {
      weapon.cycleTimer -= dt;
      if (weapon.cycleTimer <= 0) {
        weapon.isCycling = false;
      }
      return;
    }

    if (this.burstRemaining > 0 && nowSec >= this.nextBurstShotTime) {
      this.spawnProjectiles(weapon);
      weapon.currentAmmo--;
      this.burstRemaining--;
      this.nextBurstShotTime = nowSec + 60 / weapon.burstRpm;
      if (this.burstRemaining === 0) {
        weapon.lastShotTime = nowSec + weapon.burstDelay;
      }
      return;
    }

    const wantsToFire = weapon.fireType === 'automatic' || weapon.fireType === 'open_bolt' ? this.mouse.isDown : this.mouse.justPressed;
    if (!wantsToFire) return;

    if (weapon.currentAmmo <= 0) {
      this.startReload(weapon);
      return;
    }

    const fireInterval = 60 / weapon.rpm;
    if (nowSec - weapon.lastShotTime < fireInterval) return;

    if (weapon.fireType === 'open_bolt') {
      if (this.openBoltTimer < weapon.openBoltDelay) {
        this.openBoltTimer += dt;
        return;
      }
    }

    if (weapon.fireType === 'burst') {
      this.burstRemaining = Math.min(weapon.burstCount, weapon.currentAmmo);
      this.nextBurstShotTime = nowSec;
      return;
    }

    if (weapon.fireType === 'single_feed') {
      this.spawnProjectiles(weapon);
      weapon.currentAmmo = 0;
      this.startReload(weapon);
      return;
    }

    if (weapon.fireType === 'bolt_action' || weapon.fireType === 'pump_action') {
      this.spawnProjectiles(weapon);
      weapon.currentAmmo--;
      weapon.isCycling = true;
      weapon.cycleTimer = weapon.boltCycleTime || weapon.pumpCycleTime || 0.6;
      weapon.lastShotTime = nowSec;
      return;
    }

    this.spawnProjectiles(weapon);
    weapon.lastShotTime = nowSec;
    weapon.currentAmmo--;
  }

  update(dt, nowSec) {
    const midX = this.canvas.width / 2;
    const midY = this.canvas.height / 2;
    const zoom = Math.max(0.1, this.camera.zoom);

    const worldMouse = {
      x: this.camera.x + (this.mouse.x - midX) / zoom,
      y: this.camera.y + (this.mouse.y - midY) / zoom
    };

    this.player.update(this.keys, worldMouse, dt);
    this.handleFiring(dt, nowSec);
    this.mouse.justPressed = false;

    // Broadcast local player state
    if (this.network) {
      this.network.broadcastState(this.player);

      for (const r of this.network.remotePlayers.values()) {
        if (r.targetX !== undefined) {
          r.x += (r.targetX - r.x) * 15 * dt;
          r.y += (r.targetY - r.y) * 15 * dt;
        }
        if (r.hitFlash > 0) r.hitFlash -= dt;
      }
    }

    // Optical Zoom & Downrange Lead
    const opticId = this.player.equippedWeapon?.attachments?.optic || 'none';
    let targetZoom = 1.0;
    let targetLead = 0;

    if (this.player.isAiming) {
      if (opticId === 'sniper_scope') {
        targetZoom = 2.2;
        targetLead = 320;
      } else if (opticId === 'acog') {
        targetZoom = 1.7;
        targetLead = 200;
      } else if (opticId === 'red_dot' || opticId === 'coyote') {
        targetZoom = 1.3;
        targetLead = 110;
      } else {
        targetZoom = 1.15;
        targetLead = 75;
      }
    }

    this.camera.zoom += (targetZoom - this.camera.zoom) * 8 * dt;
    this.camera.leadDist += (targetLead - this.camera.leadDist) * 8 * dt;

    const aimDirX = Math.cos(this.player.aimAngle);
    const aimDirY = Math.sin(this.player.aimAngle);
    const targetCamX = this.player.x + aimDirX * this.camera.leadDist;
    const targetCamY = this.player.y + aimDirY * this.camera.leadDist;

    this.camera.x += (targetCamX - this.camera.x) * 12 * dt;
    this.camera.y += (targetCamY - this.camera.y) * 12 * dt;

    // Screen Shake Decay
    const decayFactor = Math.exp(-this.cameraShake.decay * dt);
    this.cameraShake.x *= decayFactor;
    this.cameraShake.y *= decayFactor;

    if (this.cameraShake.aftershockTimer > 0) {
      this.cameraShake.aftershockTimer -= dt;
      const wobble = Math.sin(nowSec * 32) * this.cameraShake.aftershockIntensity * (this.cameraShake.aftershockTimer / 0.45);
      this.cameraShake.x += wobble * 0.3;
      this.cameraShake.y += wobble * 0.3;
    }

    if (Math.abs(this.cameraShake.x) < 0.05) this.cameraShake.x = 0;
    if (Math.abs(this.cameraShake.y) < 0.05) this.cameraShake.y = 0;

    // Concussion Decay
    if (this.concussionVignette.opacity > 0) {
      this.concussionVignette.opacity -= this.concussionVignette.decayRate * dt;
      this.concussionVignette.tunnelSqueeze *= Math.exp(-2.2 * dt);
      if (this.concussionVignette.opacity < 0) {
        this.concussionVignette.opacity = 0;
        this.concussionVignette.tunnelSqueeze = 0;
      }
    }

    // Red Damage Hurt Vignette Decay
    if (this.damageFlash.opacity > 0) {
      this.damageFlash.opacity -= this.damageFlash.decayRate * dt;
      if (this.damageFlash.opacity < 0) this.damageFlash.opacity = 0;
    }

    // Suppression Decay
    if (this.suppression.intensity > 0) {
      this.suppression.intensity -= this.suppression.decayRate * dt;
      if (this.suppression.intensity < 0) this.suppression.intensity = 0;
    }

    // Hitmarkers
    for (let i = this.hitmarkers.length - 1; i >= 0; i--) {
      const h = this.hitmarkers[i];
      h.life -= dt;
      if (h.life <= 0) this.hitmarkers.splice(i, 1);
    }

    // Floating Damage Text
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy *= 0.94;
      d.life -= dt;
      if (d.life <= 0) this.damageNumbers.splice(i, 1);
    }

    // Dropped Mags
    for (let i = this.droppedMags.length - 1; i >= 0; i--) {
      const m = this.droppedMags[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vx *= 0.88;
      m.vy *= 0.88;
      m.rot += m.vRot * dt;
      m.vRot *= 0.90;
      m.life -= dt;
      if (m.life < 1.0) m.opacity = m.life;
      if (m.life <= 0) this.droppedMags.splice(i, 1);
    }

    // Casings
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.90;
      c.vy *= 0.90;
      c.rot += c.vRot * dt;
      c.vRot *= 0.92;
      c.life -= dt;
      if (c.life < 0.5) c.opacity = c.life / 0.5;
      if (c.life <= 0) this.casings.splice(i, 1);
    }

    // Sparks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // ================= 1. LOCAL BULLETS: RAYCAST & HIT DETECTION =================
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      b.prevX = b.x;
      b.prevY = b.y;

      const stepVx = b.vx * dt;
      const stepVy = b.vy * dt;
      const stepDist = Math.hypot(stepVx, stepVy);

      b.x += stepVx;
      b.y += stepVy;
      b.travelDist += stepDist;

      const potentialTargets = [];

      // Practice Dummies (Always targetable)
      for (const d of this.targets) {
        potentialTargets.push({
          x: d.x,
          y: d.y,
          radius: d.radius || 24,
          hp: d.hp,
          maxHp: d.maxHp || 100,
          isPeer: false,
          rawRef: d
        });
      }

      // Remote Players: Targetable if deployed (not in menu or gunsmith workbench)
      if (this.network) {
        for (const [peerId, r] of this.network.remotePlayers.entries()) {
          if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) continue;
          if (r.screenState === 'gunsmith' || r.screenState === 'menu') continue;

          potentialTargets.push({
            x: r.x,
            y: r.y,
            radius: 28, // Generous hitbox for smooth networking
            peerId: peerId,
            hp: r.hp !== undefined ? r.hp : 100,
            maxHp: 100,
            isPeer: true,
            rawRef: r
          });
        }
      }

      let hitTarget = null;
      let closestHitDist = Infinity;
      let contactX = b.x;
      let contactY = b.y;

      const segX = b.x - b.prevX;
      const segY = b.y - b.prevY;
      const segLenSq = segX * segX + segY * segY;

      for (const t of potentialTargets) {
        let projX = b.x;
        let projY = b.y;

        if (segLenSq > 0) {
          const u = Math.max(0, Math.min(1, ((t.x - b.prevX) * segX + (t.y - b.prevY) * segY) / segLenSq));
          projX = b.prevX + u * segX;
          projY = b.prevY + u * segY;
        }

        const distSq = (t.x - projX) * (t.x - projX) + (t.y - projY) * (t.y - projY);

        if (distSq <= t.radius * t.radius) {
          const dFromStart = (projX - b.prevX) * (projX - b.prevX) + (projY - b.prevY) * (projY - b.prevY);
          if (dFromStart < closestHitDist) {
            closestHitDist = dFromStart;
            hitTarget = t;
            contactX = projX;
            contactY = projY;
          }
        }
      }

      if (hitTarget) {
        b.x = contactX;
        b.y = contactY;

        const dmg = this.computeDamage(b.weaponRef, b.travelDist);
        const wasLethal = hitTarget.hp <= dmg;

        hitTarget.hp = Math.max(0, hitTarget.hp - dmg);

        // Flash target white & sync HP
        if (hitTarget.rawRef) {
          hitTarget.rawRef.hp = hitTarget.hp;
          hitTarget.rawRef.hitFlash = 0.15;
          if (!hitTarget.isPeer && wasLethal) {
            hitTarget.rawRef.hp = hitTarget.rawRef.maxHp;
          }
        }

        // Local feedback: hitmarker & damage numbers
        this.spawnHitmarker(wasLethal);
        this.spawnDamageNumber(contactX, contactY, dmg, wasLethal);

        // Broadcast damage to peer
        if (hitTarget.isPeer && this.network) {
          this.network.broadcastDamage(hitTarget.peerId, dmg, wasLethal);
        }

        // Impact spark particles
        const sparkCount = wasLethal ? 14 : 7;
        for (let k = 0; k < sparkCount; k++) {
          const spd = 70 + Math.random() * 160;
          const pAngle = Math.random() * Math.PI * 2;
          this.particles.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(pAngle) * spd,
            vy: Math.sin(pAngle) * spd,
            color: wasLethal ? '#ef4444' : '#fbbf24',
            life: 0.15 + Math.random() * 0.12
          });
        }

        // Consume bullet
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.travelDist > b.maxDist) {
        this.bullets.splice(i, 1);
      }
    }

    // ================= 2. REMOTE BULLETS: COLLISION ON LOCAL PLAYER & DUMMIES =================
    for (let i = this.remoteBullets.length - 1; i >= 0; i--) {
      const b = this.remoteBullets[i];

      b.prevX = b.x;
      b.prevY = b.y;

      const stepVx = b.vx * dt;
      const stepVy = b.vy * dt;
      const stepDist = Math.hypot(stepVx, stepVy);

      b.x += stepVx;
      b.y += stepVy;
      b.travelDist += stepDist;

      const segX = b.x - b.prevX;
      const segY = b.y - b.prevY;
      const segLenSq = segX * segX + segY * segY;

      let hitLocal = false;

      if (segLenSq > 0) {
        // Test 1: Did enemy bullet hit YOU (the local player)?
        const uPlayer = Math.max(0, Math.min(1, ((this.player.x - b.prevX) * segX + (this.player.y - b.prevY) * segY) / segLenSq));
        const projPlayerX = b.prevX + uPlayer * segX;
        const projPlayerY = b.prevY + uPlayer * segY;
        const distToPlayerSq = (this.player.x - projPlayerX) * (this.player.x - projPlayerX) + (this.player.y - projPlayerY) * (this.player.y - projPlayerY);

        if (distToPlayerSq <= 26 * 26) {
          // Direct hit on you! Stop bullet immediately and spawn blood/sparks
          b.x = projPlayerX;
          b.y = projPlayerY;

          for (let k = 0; k < 9; k++) {
            const spd = 60 + Math.random() * 140;
            const pAngle = Math.random() * Math.PI * 2;
            this.particles.push({
              x: b.x,
              y: b.y,
              vx: Math.cos(pAngle) * spd,
              vy: Math.sin(pAngle) * spd,
              color: '#ef4444',
              life: 0.15 + Math.random() * 0.1
            });
          }

          this.triggerRedDamageFlash(25);
          this.addSuppressionImpulse(0.85);

          hitLocal = true;
          this.remoteBullets.splice(i, 1);
          continue;
        }

        // Test 2: Did enemy bullet hit a practice dummy?
        let hitDummy = false;
        for (const d of this.targets) {
          const uD = Math.max(0, Math.min(1, ((d.x - b.prevX) * segX + (d.y - b.prevY) * segY) / segLenSq));
          const projDX = b.prevX + uD * segX;
          const projDY = b.prevY + uD * segY;
          if ((d.x - projDX) * (d.x - projDX) + (d.y - projDY) * (d.y - projDY) <= (d.radius || 24) * (d.radius || 24)) {
            d.hitFlash = 0.12;
            for (let k = 0; k < 6; k++) {
              const spd = 60 + Math.random() * 120;
              const pAngle = Math.random() * Math.PI * 2;
              this.particles.push({
                x: projDX,
                y: projDY,
                vx: Math.cos(pAngle) * spd,
                vy: Math.sin(pAngle) * spd,
                color: '#fbbf24',
                life: 0.12 + Math.random() * 0.08
              });
            }
            hitDummy = true;
            break;
          }
        }

        if (hitDummy) {
          this.remoteBullets.splice(i, 1);
          continue;
        }

        // Test 3: Near-miss fly-by suppression
        const distToPlayer = Math.sqrt(distToPlayerSq);
        if (distToPlayer > 26 && distToPlayer < 65) {
          this.addSuppressionImpulse(0.45);
        }
      }

      // Despawn bullet if past max distance
      if (b.travelDist > b.maxDist) {
        this.remoteBullets.splice(i, 1);
      }
    }

    for (const t of this.targets) {
      if (t.hitFlash > 0) t.hitFlash -= dt;
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const midX = this.canvas.width / 2;
    const midY = this.canvas.height / 2;

    // ================= 1. WORLD TRANSFORM PASS =================
    this.ctx.save();
    this.ctx.translate(midX + this.cameraShake.x, midY + this.cameraShake.y);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Floor Grid
    this.ctx.strokeStyle = '#151b23';
    this.ctx.lineWidth = 1;
    const gridBound = 3500;
    for (let x = -gridBound; x <= gridBound; x += 48) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, -gridBound);
      this.ctx.lineTo(x, gridBound);
      this.ctx.stroke();
    }
    for (let y = -gridBound; y <= gridBound; y += 48) {
      this.ctx.beginPath();
      this.ctx.moveTo(-gridBound, y);
      this.ctx.lineTo(gridBound, y);
      this.ctx.stroke();
    }

    // Dropped Mags
    for (const m of this.droppedMags) {
      this.ctx.save();
      this.ctx.translate(m.x, m.y);
      this.ctx.rotate(m.rot);
      this.ctx.globalAlpha = m.opacity;
      this.ctx.fillStyle = '#0f172a';
      this.ctx.fillRect(-4, -6, 8, 12);
      this.ctx.strokeStyle = '#1e293b';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(-4, -6, 8, 12);
      this.ctx.restore();
    }

    // Spent Casings
    for (const c of this.casings) {
      this.ctx.save();
      this.ctx.translate(c.x, c.y);
      this.ctx.rotate(c.rot);
      this.ctx.globalAlpha = c.opacity;
      this.ctx.fillStyle = '#eab308';
      this.ctx.fillRect(-3, -1, 6, 2.5);
      this.ctx.restore();
    }

    // Target Dummies
    for (const t of this.targets) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
      this.ctx.beginPath();
      this.ctx.ellipse(t.x + 3, t.y + 5, t.radius, t.radius * 0.8, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = t.hitFlash > 0 ? '#ffffff' : '#dc2626';
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#991b1b';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(t.x - 24, t.y - 36, 48, 6);
      this.ctx.fillStyle = '#22c55e';
      this.ctx.fillRect(t.x - 24, t.y - 36, Math.max(0, (t.hp / t.maxHp) * 48), 6);

      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '11px Consolas';
      this.ctx.fillText(t.name, t.x - 28, t.y + 38);
      this.ctx.restore();
    }

    // Draw Remote Players (Only visible if deployed or in gunsmith)
    if (this.network) {
      for (const [peerId, r] of this.network.remotePlayers.entries()) {
        if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) continue;
        if (r.screenState === 'menu') continue; // Don't draw players still at main menu

        this.ctx.save();
        this.remoteRendererDummy.x = r.x;
        this.remoteRendererDummy.y = r.y;
        this.remoteRendererDummy.aimAngle = r.aimAngle || 0;
        this.remoteRendererDummy.bodyAngle = r.bodyAngle || 0;
        this.remoteRendererDummy.isMoving = r.isMoving || false;
        this.remoteRendererDummy.walkCycle = r.walkCycle || 0;
        this.remoteRendererDummy.adsProgress = r.adsProgress || 0;
        this.remoteRendererDummy.equippedWeapon = r.equippedWeapon;

        const isGunsmith = r.screenState === 'gunsmith';
        this.ctx.globalAlpha = isGunsmith ? 0.6 : 1.0;

        this.remoteRendererDummy.draw(this.ctx);

        // Health Bar
        const barW = 46;
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(r.x - barW / 2, r.y - 42, barW, 6);
        this.ctx.fillStyle = r.hitFlash > 0 ? '#ffffff' : '#38bdf8';
        this.ctx.fillRect(r.x - barW / 2, r.y - 42, Math.max(0, (r.hp / 100) * barW), 6);

        // Overhead Callout Badge
        this.ctx.font = 'bold 11px Consolas';
        if (isGunsmith) {
          this.ctx.fillStyle = '#f59e0b';
          this.ctx.fillText('[IN GUNSMITH]', r.x - 38, r.y - 52);
        } else {
          this.ctx.fillStyle = '#cbd5e1';
          const shortName = `OPERATOR [${peerId.slice(-4)}]`;
          this.ctx.fillText(shortName, r.x - 38, r.y - 52);
        }

        this.ctx.restore();
      }
    }

    // High-Speed Bullets & Tracers
    const allTracers = [...this.bullets, ...this.remoteBullets];
    for (const b of allTracers) {
      this.ctx.save();
      const bSpeed = Math.hypot(b.vx, b.vy);
      const bAngle = Math.atan2(b.vy, b.vx);
      const tracerLength = Math.min(85, Math.max(30, bSpeed * 0.026));

      const tailX = b.x - Math.cos(bAngle) * tracerLength;
      const tailY = b.y - Math.sin(bAngle) * tracerLength;

      this.ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
      this.ctx.lineWidth = 5.0;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(tailX, tailY);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();

      this.ctx.strokeStyle = '#facc15';
      this.ctx.lineWidth = 2.2;
      this.ctx.beginPath();
      this.ctx.moveTo(tailX, tailY);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Sparks
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x, p.y, 2.5, 2.5);
    }

    // Floating Damage Numbers
    for (const d of this.damageNumbers) {
      this.ctx.save();
      const alpha = Math.min(1.0, d.life / (d.maxLife * 0.6));
      this.ctx.globalAlpha = Math.max(0, alpha);

      if (d.isKill) {
        this.ctx.fillStyle = '#ef4444';
        this.ctx.font = 'bold 20px Consolas';
        this.ctx.shadowColor = '#7f1d1d';
        this.ctx.shadowBlur = 8;
        this.ctx.fillText(`-${d.damage} KILL`, d.x - 22, d.y);
      } else {
        this.ctx.fillStyle = '#fef08a';
        this.ctx.font = 'bold 15px Consolas';
        this.ctx.shadowColor = '#000000';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(`-${d.damage}`, d.x - 10, d.y);
      }
      this.ctx.restore();
    }

    // Local Player Rig
    this.player.draw(this.ctx);

    // Muzzle Flash
    if (this.player.muzzleFlashTimer > 0) {
      const pos = this.player.lastMuzzleWorldPos;
      const grad = this.ctx.createRadialGradient(pos.x, pos.y, 10, pos.x, pos.y, 120);
      grad.addColorStop(0, 'rgba(253, 224, 71, 0.4)');
      grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 120, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore(); // END WORLD TRANSFORM

    // ================= 2. ADS MASK & RETICLES =================
    if (this.player.adsProgress > 0) {
      this.renderADSScopeAndVignette();
    }

    // ================= 3. CONCUSSION & FLY-BY SUPPRESSION VIGNETTE =================
    const totalBlackVignette = Math.min(1.0, this.concussionVignette.opacity + this.suppression.intensity * 0.75);
    if (totalBlackVignette > 0) {
      this.ctx.save();
      const outerRadius = Math.max(this.canvas.width, this.canvas.height) * 0.88;
      const vignetteGrad = this.ctx.createRadialGradient(midX, midY, 120, midX, midY, outerRadius);
      vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignetteGrad.addColorStop(0.35, `rgba(4, 5, 8, ${totalBlackVignette * 0.45})`);
      vignetteGrad.addColorStop(0.70, `rgba(0, 0, 2, ${totalBlackVignette * 0.82})`);
      vignetteGrad.addColorStop(1, `rgba(0, 0, 0, ${totalBlackVignette})`);

      this.ctx.fillStyle = vignetteGrad;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // ================= 4. RED DAMAGE HURT VIGNETTE =================
    if (this.damageFlash.opacity > 0) {
      this.ctx.save();
      const outerRadius = Math.max(this.canvas.width, this.canvas.height) * 0.85;
      const redGrad = this.ctx.createRadialGradient(midX, midY, 100, midX, midY, outerRadius);
      redGrad.addColorStop(0, 'rgba(185, 28, 28, 0)');
      redGrad.addColorStop(0.45, `rgba(220, 38, 38, ${this.damageFlash.opacity * 0.35})`);
      redGrad.addColorStop(0.85, `rgba(185, 28, 28, ${this.damageFlash.opacity * 0.75})`);
      redGrad.addColorStop(1.0, `rgba(127, 29, 29, ${this.damageFlash.opacity * 0.95})`);

      this.ctx.fillStyle = redGrad;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // ================= 5. HITMARKERS =================
    this.renderHitmarkers();

    // ================= 6. STATIC HUD PASS =================
    if (this.player.equippedWeapon) {
      const w = this.player.equippedWeapon;
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = 'bold 18px Consolas';

      const adsStatus = this.player.isAiming ? ' [ADS]' : '';
      if (w.isReloading) {
        const pct = Math.round(this.player.reloadProgress * 100);
        this.ctx.fillText(`${w.name}${adsStatus}  |  RELOADING [${pct}%]`, 28, this.canvas.height - 38);

        this.ctx.fillStyle = '#1e293b';
        this.ctx.fillRect(28, this.canvas.height - 24, 180, 8);
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.fillRect(28, this.canvas.height - 24, 1.8 * pct, 8);
      } else {
        let stateText = `${w.currentAmmo} / ${w.magSize}`;
        if (w.isCycling) stateText = `[RACKING ${w.fireType.toUpperCase()}]`;
        this.ctx.fillText(`${w.name}${adsStatus}  |  ${stateText}`, 28, this.canvas.height - 28);
      }

      if (this.network) {
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '12px Consolas';
        const peerCount = this.network.connections.size + 1;
        this.ctx.fillText(`ROOM: ${this.network.roomCode}  |  OPERATORS ONLINE: ${peerCount}`, 28, 54);
      }
    }
  }

  renderHitmarkers() {
    const ctx = this.ctx;
    for (const h of this.hitmarkers) {
      ctx.save();
      const progress = h.life / h.maxLife;
      ctx.globalAlpha = Math.max(0, progress);

      const spread = (1.0 - progress) * 4;
      const innerDist = 6 * h.scale + spread;
      const armLen = 8 * h.scale;

      ctx.strokeStyle = h.isKill ? '#ef4444' : '#ffffff';
      ctx.lineWidth = h.isKill ? 3.0 : 2.0;
      ctx.lineCap = 'round';

      const hx = this.mouse.x;
      const hy = this.mouse.y;

      ctx.beginPath();
      ctx.moveTo(hx - innerDist, hy - innerDist);
      ctx.lineTo(hx - innerDist - armLen, hy - innerDist - armLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx + innerDist, hy - innerDist);
      ctx.lineTo(hx + innerDist + armLen, hy - innerDist - armLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx - innerDist, hy + innerDist);
      ctx.lineTo(hx - innerDist - armLen, hy + innerDist + armLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx + innerDist, hy + innerDist);
      ctx.lineTo(hx + innerDist + armLen, hy + innerDist + armLen);
      ctx.stroke();

      ctx.restore();
    }
  }

  renderADSScopeAndVignette() {
    const ctx = this.ctx;
    const targetX = this.mouse.x;
    const targetY = this.mouse.y;
    const p = this.player.adsProgress;
    const optic = this.player.equippedWeapon?.attachments?.optic || 'none';

    ctx.save();

    if (optic === 'sniper_scope') {
      const scopeRadius = Math.min(this.canvas.width, this.canvas.height) * 0.38;

      ctx.fillStyle = `rgba(0, 0, 0, ${0.96 * p})`;
      ctx.beginPath();
      ctx.rect(0, 0, this.canvas.width, this.canvas.height);
      ctx.arc(targetX, targetY, scopeRadius, 0, Math.PI * 2, true);
      ctx.fill();

      ctx.strokeStyle = `rgba(17, 24, 39, ${p})`;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(targetX, targetY, scopeRadius + 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0, 0, 0, ${0.65 * p})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(targetX, targetY, scopeRadius - 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0, 0, 0, ${0.85 * p})`;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(targetX - scopeRadius, targetY);
      ctx.lineTo(targetX + scopeRadius, targetY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(targetX, targetY - scopeRadius);
      ctx.lineTo(targetX, targetY + scopeRadius);
      ctx.stroke();

      ctx.fillStyle = `rgba(0, 0, 0, ${0.9 * p})`;
      for (let d = -160; d <= 160; d += 40) {
        if (d === 0) continue;
        if (Math.abs(d) < scopeRadius - 10) {
          ctx.fillRect(targetX + d - 1, targetY - 3, 2, 6);
          ctx.fillRect(targetX - 3, targetY + d - 1, 6, 2);
        }
      }
    } else {
      const maxEdge = Math.max(this.canvas.width, this.canvas.height) * 0.78;
      const grad = ctx.createRadialGradient(targetX, targetY, 70, targetX, targetY, maxEdge);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.55, `rgba(0, 0, 0, ${0.38 * p})`);
      grad.addColorStop(1, `rgba(0, 0, 0, ${0.88 * p})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      if (optic === 'red_dot' || optic === 'coyote') {
        ctx.fillStyle = `rgba(239, 68, 68, ${p * 0.95})`;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(239, 68, 68, ${p * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(239, 68, 68, ${p * 0.65})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(targetX - 22, targetY);
        ctx.lineTo(targetX - 16, targetY);
        ctx.moveTo(targetX + 16, targetY);
        ctx.lineTo(targetX + 22, targetY);
        ctx.moveTo(targetX, targetY - 22);
        ctx.lineTo(targetX - 16, targetY);
        ctx.moveTo(targetX, targetY + 16);
        ctx.lineTo(targetX + 22, targetY);
        ctx.stroke();
      } else if (optic === 'acog') {
        ctx.strokeStyle = `rgba(239, 68, 68, ${p * 0.95})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(targetX - 7, targetY + 6);
        ctx.lineTo(targetX, targetY - 2);
        ctx.lineTo(targetX + 7, targetY + 6);
        ctx.stroke();

        ctx.strokeStyle = `rgba(0, 0, 0, ${p * 0.75})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY + 6);
        ctx.lineTo(targetX, targetY + 45);
        ctx.stroke();

        ctx.fillStyle = `rgba(0, 0, 0, ${p * 0.7})`;
        ctx.fillRect(targetX - 8, targetY + 20, 16, 1.5);
        ctx.fillRect(targetX - 5, targetY + 32, 10, 1.5);
      }
    }

    ctx.restore();
  }

  start() {
    this.running = true;
    const loop = (now) => {
      if (!this.running) {
        requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      this.update(dt, now / 1000);
      this.draw();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}