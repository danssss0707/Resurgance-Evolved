import { BASE_WEAPONS } from '../weapons/weaponData.js';
import { ATTACHMENTS } from '../weapons/attachmentData.js';
import { WeaponBuilder } from '../weapons/weaponBuilder.js';
import { GunPreviewRenderer } from './gunPreviewRenderer.js';
import { MenuOperatorRenderer } from './menuOperatorRenderer.js';

export class GunsmithUI {
  constructor(player) {
    this.player = player;

    // Header & Selectors
    this.categorySelect = document.getElementById('category-select');
    this.weaponSelect = document.getElementById('weapon-select');
    this.previewNameEl = document.getElementById('preview-weapon-name');
    this.previewCaliberEl = document.getElementById('preview-weapon-caliber');
    this.rangeWeaponInfoEl = document.querySelector('#range-weapon-info span');

    // Main Menu Showcase Labels
    this.menuShowcaseTitle = document.getElementById('showcase-weapon-name');
    this.menuShowcaseClass = document.getElementById('showcase-weapon-class');
    this.menuShowcaseMag = document.getElementById('showcase-stat-mag');
    this.menuShowcaseFire = document.getElementById('showcase-stat-fire');

    // Preset & Armory Action Buttons
    this.btnReset = document.getElementById('btn-gunsmith-reset');
    this.btnRandom = document.getElementById('btn-gunsmith-random');
    this.btnShare = document.getElementById('btn-gunsmith-share');

    // Hotspot Nodes & Tab Buttons
    this.nodes = document.querySelectorAll('.attachment-node');
    this.tabButtons = document.querySelectorAll('.slot-tab-btn');
    this.cardsContainer = document.getElementById('attachment-cards-container');

    // Active Slot Tab ('optic', 'barrel', 'underbarrel', 'other', 'ammo')
    this.activeSlot = 'optic';

    // Currently Selected Attachments Map
    this.selectedAttachments = {
      optic: 'none',
      barrel: 'none',
      underbarrel: 'none',
      other: 'none',
      ammo: 'none'
    };

    // Telemetry Stat Bars & Numerical Labels
    this.statElements = {
      dmg: { val: document.getElementById('stat-dmg'), bar: document.getElementById('bar-dmg') },
      rpm: { val: document.getElementById('stat-rpm'), bar: document.getElementById('bar-rpm') },
      vel: { val: document.getElementById('stat-vel'), bar: document.getElementById('bar-vel') },
      recoil: { val: document.getElementById('stat-recoil'), bar: document.getElementById('bar-recoil') },
      ads: { val: document.getElementById('stat-ads'), bar: document.getElementById('bar-ads') },
      mag: document.getElementById('stat-mag'),
      reload: document.getElementById('stat-reload'),
      spread: document.getElementById('stat-spread')
    };

    // Renderers
    this.previewCanvas = document.getElementById('gunPreviewCanvas');
    this.previewRenderer = new GunPreviewRenderer(this.previewCanvas);

    this.operatorCanvas = document.getElementById('menuOperatorCanvas');
    this.operatorRenderer = new MenuOperatorRenderer(this.operatorCanvas);

    this.init();
  }

  init() {
    this.populateCategoryWeapons();

    this.categorySelect.addEventListener('change', () => this.populateCategoryWeapons());
    this.weaponSelect.addEventListener('change', () => {
      this.resetAttachmentsToDefault();
      this.refreshWeapon();
    });

window.addEventListener('resize', () => {
      if (this.player.equippedWeapon) {
        this.refreshWeapon();
      }
    });

    // Preset Actions
    this.btnReset.addEventListener('click', () => {
      this.resetAttachmentsToDefault();
      this.refreshWeapon();
    });

    this.btnRandom.addEventListener('click', () => {
      this.randomizeAttachments();
      this.refreshWeapon();
    });

    this.btnShare.addEventListener('click', () => {
      this.copyBuildString();
    });

    // Interactive Node Clicks
    this.nodes.forEach((node) => {
      node.addEventListener('click', () => {
        const slot = node.dataset.slot;
        this.setActiveSlot(slot);
      });
    });

    // Slot Tab Clicks
    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        this.setActiveSlot(slot);
      });
    });

    this.setActiveSlot('optic');
    this.refreshWeapon();
  }

  setActiveSlot(slot) {
    this.activeSlot = slot;

    // Sync Tabs UI
    this.tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.slot === slot));

    // Sync Canvas Hotspot Nodes UI
    this.nodes.forEach((n) => n.classList.toggle('active', n.dataset.slot === slot));

    this.renderAttachmentCatalogCards();
  }

  resetAttachmentsToDefault() {
    this.selectedAttachments = {
      optic: 'none',
      barrel: 'none',
      underbarrel: 'none',
      other: 'none',
      ammo: 'none'
    };
  }

  randomizeAttachments() {
    for (const slot of Object.keys(this.selectedAttachments)) {
      const list = ATTACHMENTS[slot] || [];
      if (list.length > 0) {
        const pick = list[Math.floor(Math.random() * list.length)];
        this.selectedAttachments[slot] = pick.id;
      }
    }
  }

  copyBuildString() {
    const baseId = this.weaponSelect.value;
    const parts = [baseId, ...Object.values(this.selectedAttachments)];
    const code = `RSG-${parts.join(':')}`;
    navigator.clipboard.writeText(code).then(() => {
      this.btnShare.textContent = 'COPIED!';
      setTimeout(() => {
        this.btnShare.textContent = 'SHARE BUILD';
      }, 1500);
    });
  }

  populateCategoryWeapons() {
    const selectedCategory = this.categorySelect.value;
    this.weaponSelect.innerHTML = '';

    for (const [key, base] of Object.entries(BASE_WEAPONS)) {
      if (selectedCategory === 'ALL' || base.category === selectedCategory) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${base.name.toUpperCase()} [${base.category}]`;
        this.weaponSelect.appendChild(opt);
      }
    }
    this.resetAttachmentsToDefault();
    this.refreshWeapon();
  }

  renderAttachmentCatalogCards() {
    this.cardsContainer.innerHTML = '';
    const list = ATTACHMENTS[this.activeSlot] || [];
    const currentEquippedId = this.selectedAttachments[this.activeSlot];

    for (const att of list) {
      const isSelected = att.id === currentEquippedId;
      const card = document.createElement('div');
      card.className = `att-card-item ${isSelected ? 'selected' : ''}`;

      card.innerHTML = `
        <div>
          <div class="att-card-title">${att.name.toUpperCase()}</div>
          <div class="att-card-tag">${this.describePerk(att)}</div>
        </div>
        <div class="att-status-indicator">${isSelected ? 'EQUIPPED' : 'MOUNT'}</div>
      `;

      card.addEventListener('click', () => {
        this.selectedAttachments[this.activeSlot] = att.id;
        this.refreshWeapon();
        this.renderAttachmentCatalogCards();
      });

      this.cardsContainer.appendChild(card);
    }
  }

  describePerk(att) {
    if (att.id === 'none') return 'Standard Factory Profile';
    const perks = [];
    if (att.damageMax) perks.push(`${att.damageMax > 0 ? '+' : ''}${att.damageMax} Dmg`);
    if (att.rpm) perks.push(`${att.rpm > 0 ? '+' : ''}${att.rpm} RPM`);
    if (att.muzzleVelocity) perks.push(`${att.muzzleVelocity > 0 ? '+' : ''}${att.muzzleVelocity} Vel`);
    if (att.recoilVertical) perks.push(`${att.recoilVertical < 0 ? '' : '+'}${att.recoilVertical} Recoil`);
    if (att.adsTime) perks.push(`${att.adsTime < 0 ? '' : '+'}${att.adsTime}s ADS`);
    return perks.join(' • ') || 'Custom Rail Attachment';
  }

  refreshWeapon() {
    const baseId = this.weaponSelect.value;
    if (!baseId) return;

    const compiledWeapon = WeaponBuilder.createWeapon(baseId, this.selectedAttachments);
    this.player.equippedWeapon = compiledWeapon;

    // Update Headers
    this.previewNameEl.textContent = compiledWeapon.name.toUpperCase();
    this.previewCaliberEl.textContent = `${compiledWeapon.category.toUpperCase()} // ${compiledWeapon.fireType.toUpperCase()}`;
    if (this.rangeWeaponInfoEl) {
      this.rangeWeaponInfoEl.textContent = compiledWeapon.name;
    }

    // 1. Render Side Preview & Retrieve Exact Hotspot Coordinates
    const nodePositions = this.previewRenderer.render(compiledWeapon);
    this.updateHotspotNodePositions(nodePositions);

    // 2. Render Front-Facing Menu Operator
    if (this.operatorRenderer) {
      this.operatorRenderer.setWeapon(compiledWeapon);
    }

    // 3. Update Main Menu Showcase
    if (this.menuShowcaseTitle) {
      this.menuShowcaseTitle.textContent = compiledWeapon.name.toUpperCase();
      this.menuShowcaseClass.textContent = compiledWeapon.category.toUpperCase();
      this.menuShowcaseMag.textContent = `${compiledWeapon.magSize} RDS`;
      this.menuShowcaseFire.textContent = compiledWeapon.fireType.toUpperCase();
    }

    // 4. Update Comparative Spec Telemetry Bars
    this.updateTelemetryBars(compiledWeapon);
  }

  updateTelemetryBars(w) {
    // 1. Damage (0 - 120 scale)
    const dmgPct = Math.min(100, Math.max(10, (w.damageMax / 110) * 100));
    this.statElements.dmg.val.textContent = `${w.damageMax.toFixed(1)} / ${w.damageMin.toFixed(1)}`;
    this.statElements.dmg.bar.style.width = `${dmgPct}%`;

    // 2. Fire Rate (0 - 1300 RPM)
    const rpmPct = Math.min(100, Math.max(8, (w.rpm / 1250) * 100));
    this.statElements.rpm.val.textContent = `${w.rpm} RPM`;
    this.statElements.rpm.bar.style.width = `${rpmPct}%`;

    // 3. Velocity (0 - 3800 studs/s)
    const velPct = Math.min(100, Math.max(15, (w.muzzleVelocity / 3500) * 100));
    this.statElements.vel.val.textContent = `${w.muzzleVelocity} S/S`;
    this.statElements.vel.bar.style.width = `${velPct}%`;

    // 4. Recoil Stabilization (Inverted: lower recoil number = higher stability score)
    const recoilScore = Math.max(0, 16 - w.recoilVertical);
    const recoilPct = Math.min(100, Math.max(5, (recoilScore / 15) * 100));
    this.statElements.recoil.val.textContent = `${w.recoilVertical.toFixed(2)}`;
    this.statElements.recoil.bar.style.width = `${recoilPct}%`;

    // 5. Handling (Inverted ADS Time: faster aim speed = longer bar)
    const adsScore = Math.max(0, 0.45 - w.adsTime);
    const adsPct = Math.min(100, Math.max(10, (adsScore / 0.35) * 100));
    this.statElements.ads.val.textContent = `${w.adsTime.toFixed(2)}s`;
    this.statElements.ads.bar.style.width = `${adsPct}%`;

    // Metadata
    this.statElements.mag.textContent = `${w.magSize} RDS`;
    this.statElements.reload.textContent = `${w.reloadTime.toFixed(2)}s`;
    this.statElements.spread.textContent = `${w.spread.toFixed(2)}°`;
  }

// Position interactive hotspot rings directly over weapon coordinates
  updateHotspotNodePositions(nodePositions) {
    if (!nodePositions || !this.previewCanvas) return;

    // Get the display scale factor between canvas internal buffer & rendered client size
    const rect = this.previewCanvas.getBoundingClientRect();
    const scaleX = rect.width / this.previewCanvas.width;
    const scaleY = rect.height / this.previewCanvas.height;

    // Offset relative to the canvas container
    const offsetLeft = this.previewCanvas.offsetLeft;
    const offsetTop = this.previewCanvas.offsetTop;

    for (const [slot, pos] of Object.entries(nodePositions)) {
      const nodeEl = document.getElementById(`node-${slot}`);
      if (nodeEl) {
        const screenX = offsetLeft + pos.x * scaleX;
        const screenY = offsetTop + pos.y * scaleY;

        nodeEl.style.left = `${screenX}px`;
        nodeEl.style.top = `${screenY}px`;
      }
    }
  }
}