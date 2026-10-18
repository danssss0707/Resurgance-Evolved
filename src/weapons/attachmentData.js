export const ATTACHMENTS = {
  optic: [
    { id: 'none', name: 'Standard Iron Sights', modifiers: {} },
    { id: 'red_dot', name: 'Reflex Sight', modifiers: { adsTime: 0.02, spread: -0.1 } },
    { id: 'acog', name: 'ACOG Scope (4x)', modifiers: { adsTime: 0.08, recoilVertical: -0.2 } },
    { id: 'sniper_scope', name: 'High-Power Scope', modifiers: { adsTime: 0.15, spread: -0.3 } }
  ],
  barrel: [
    { id: 'none', name: 'Stock Barrel', modifiers: {} },
    { id: 'compensator', name: 'Compensator', modifiers: { recoilHorizontal: -0.4, recoilVertical: 0.1 } },
    { id: 'muzzle_brake', name: 'Muzzle Brake', modifiers: { recoilVertical: -0.4, recoilHorizontal: 0.1 } },
    { id: 'suppressor', name: 'PBS-4 Suppressor', modifiers: { muzzleVelocity: -200, damageMax: -2, spread: -0.1 } },
    { id: 'long_barrel', name: 'Extended Barrel', modifiers: { muzzleVelocity: 350, rangeMax: 20, adsTime: 0.05 } }
  ],
  underbarrel: [
    { id: 'none', name: 'None', modifiers: {} },
    { id: 'vertical_grip', name: 'Vertical Foregrip', modifiers: { recoilVertical: -0.35, adsTime: 0.03 } },
    { id: 'angled_grip', name: 'Angled Grip', modifiers: { recoilHorizontal: -0.3, adsTime: -0.02 } },
    { id: 'laser_sight', name: 'Green Tactical Laser', modifiers: { spread: -0.3 } }
  ],
  other: [
    { id: 'none', name: 'Standard Stock', modifiers: {} },
    { id: 'fold_stock', name: 'No Stock / Wire Stock', modifiers: { adsTime: -0.06, recoilVertical: 0.6, recoilHorizontal: 0.4 } },
    { id: 'heavy_stock', name: 'Heavy Tactical Stock', modifiers: { adsTime: 0.05, recoilVertical: -0.4, recoilHorizontal: -0.3 } }
  ],
  ammo: [
    { id: 'standard', name: 'Standard Ball / FMJ', modifiers: {} },
    { id: 'hollow_point', name: 'Hollow Point', modifiers: { damageMax: 6, damageMin: -6, rangeMax: -20 } },
    { id: 'armor_piercing', name: 'Armor Piercing', modifiers: { damageMax: -3, rangeMax: 30, muzzleVelocity: 200 } },
    { id: 'slugs', name: 'Slug Rounds (Shotgun Only)', targetOnly: 'Shotgun', modifiers: { bulletCount: -7, damageMax: 65, spread: -4.5, muzzleVelocity: 600 } }
  ]
};