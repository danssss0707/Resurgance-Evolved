import { BASE_WEAPONS } from './weaponData.js';
import { ATTACHMENTS } from './attachmentData.js';

export class WeaponBuilder {
  static createWeapon(baseKey, chosenAttachments = {}) {
    const base = BASE_WEAPONS[baseKey];
    if (!base) return null;

    const finalWeapon = JSON.parse(JSON.stringify(base));
    finalWeapon.attachments = {};

    const slots = ['optic', 'barrel', 'underbarrel', 'other', 'ammo'];

    for (const slot of slots) {
      const attId = chosenAttachments[slot] || 'none';
      const attDef = (ATTACHMENTS[slot] || []).find((a) => a.id === attId);

      if (attDef) {
        if (attDef.targetOnly && attDef.targetOnly !== base.category) {
          finalWeapon.attachments[slot] = 'none';
          continue;
        }

        finalWeapon.attachments[slot] = attDef.id;

        for (const [stat, mod] of Object.entries(attDef.modifiers)) {
          if (finalWeapon[stat] !== undefined) {
            finalWeapon[stat] += mod;
          }
        }
      }
    }

    // Stat bounds & clamp
    finalWeapon.spread = Math.max(0.05, finalWeapon.spread);
    finalWeapon.recoilVertical = Math.max(0.1, finalWeapon.recoilVertical);
    finalWeapon.recoilHorizontal = Math.max(0.05, finalWeapon.recoilHorizontal);
    finalWeapon.adsTime = Math.max(0.05, finalWeapon.adsTime);
    finalWeapon.bulletCount = Math.max(1, finalWeapon.bulletCount);
    finalWeapon.magSize = Math.max(1, Math.round(finalWeapon.magSize));

    // Dynamic runtime state
    finalWeapon.currentAmmo = finalWeapon.magSize;
    finalWeapon.lastShotTime = 0;
    finalWeapon.isReloading = false;
    finalWeapon.reloadTimer = 0;

    return finalWeapon;
  }
}