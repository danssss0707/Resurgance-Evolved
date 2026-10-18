export class P2PNetwork {
  constructor(roomCode = '1111') {
    this.roomCode = String(roomCode);
    this.peer = null;
    this.peerId = null;
    this.slotIndex = -1;

    this.connections = new Map(); // peerId -> DataConnection
    this.remotePlayers = new Map(); // peerId -> player state

    this.onPeerJoin = null;
    this.onPeerLeave = null;
    this.onPeerShoot = null;
    this.onPeerDamage = null;

    this.broadcastRate = 30; // 30Hz
    this.lastBroadcast = 0;

    this.isTabActive = true;
    window.addEventListener('focus', () => { this.isTabActive = true; });
    window.addEventListener('blur', () => { this.isTabActive = false; });
    document.addEventListener('visibilitychange', () => {
      this.isTabActive = !document.hidden;
    });

    this.currentScreen = 'game';
  }

  connect(onReady) {
    if (this.peer && !this.peer.destroyed) {
      if (onReady) onReady(this.peerId);
      return;
    }

    // Attempt to claim sequential slots 0 through 7
    this.claimSlot(0, onReady);
  }

  claimSlot(slotIndex, onReady) {
    if (slotIndex > 8) {
      // Fallback if all standard slots are busy
      const rand = Math.floor(1000 + Math.random() * 9000);
      this.slotIndex = slotIndex;
      this.peerId = `${this.roomCode}_slot_${rand}`;
      this.initializePeer(onReady);
      return;
    }

    const testId = `${this.roomCode}_slot_${slotIndex}`;
    const testPeer = new window.Peer(testId, { debug: 0 });

    testPeer.on('open', (id) => {
      this.peer = testPeer;
      this.peerId = id;
      this.slotIndex = slotIndex;
      console.log(`[P2P] Claimed room slot ${slotIndex}: ${id}`);
      this.initializePeer(onReady);
    });

    testPeer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        testPeer.destroy();
        // Slot is taken, try next slot index
        this.claimSlot(slotIndex + 1, onReady);
      } else {
        console.error('[P2P Slot Error]:', err);
      }
    });
  }

  initializePeer(onReady) {
    // Listen for incoming peer connections
    this.peer.on('connection', (conn) => {
      this.bindConnection(conn);
    });

    // Connect outward to all lower slots (0 through slotIndex - 1)
    for (let s = 0; s < this.slotIndex; s++) {
      const targetId = `${this.roomCode}_slot_${s}`;
      const conn = this.peer.connect(targetId, { reliable: false });
      this.bindConnection(conn);
    }

    if (onReady) onReady(this.peerId);
  }

  bindConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      console.log(`[P2P] Mesh connected with: ${conn.peer}`);
      if (this.onPeerJoin) this.onPeerJoin(conn.peer);
    });

    conn.on('data', (data) => {
      this.handleIncomingPacket(conn.peer, data);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.remotePlayers.delete(conn.peer);
      if (this.onPeerLeave) this.onPeerLeave(conn.peer);
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
      this.remotePlayers.delete(conn.peer);
    });
  }

  broadcast(packet) {
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(packet);
      }
    }
  }

  broadcastState(player) {
    const now = performance.now();
    if (now - this.lastBroadcast < 1000 / this.broadcastRate) return;
    this.lastBroadcast = now;

    if (!player) return;

    this.broadcast({
      t: 'sync',
      x: Math.round(player.x),
      y: Math.round(player.y),
      aim: player.aimAngle,
      body: player.bodyAngle,
      moving: player.isMoving,
      walk: player.walkCycle,
      hp: player.hp || 100,
      ads: player.adsProgress,
      tabActive: this.isTabActive,
      screenState: this.currentScreen,
      weapon: player.equippedWeapon ? {
        name: player.equippedWeapon.name,
        category: player.equippedWeapon.category,
        color: player.equippedWeapon.color,
        profile: player.equippedWeapon.profile,
        attachments: player.equippedWeapon.attachments
      } : null
    });
  }

  broadcastShot(muzzlePos, bullets) {
    this.broadcast({
      t: 'shoot',
      m: muzzlePos,
      b: bullets.map(b => ({
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        maxDist: b.maxDist
      }))
    });
  }

  broadcastDamage(targetPeerId, damage, isKill) {
    this.broadcast({
      t: 'dmg',
      target: targetPeerId,
      d: damage,
      k: isKill
    });
  }

  handleIncomingPacket(senderId, data) {
    if (!data || !data.t) return;

    if (data.t === 'sync') {
      let r = this.remotePlayers.get(senderId);
      if (!r) {
        r = { id: senderId, hitFlash: 0, hp: 100, maxHp: 100, radius: 24 };
        this.remotePlayers.set(senderId, r);
      }
      r.targetX = data.x;
      r.targetY = data.y;
      r.x = r.x !== undefined ? r.x : data.x;
      r.y = r.y !== undefined ? r.y : data.y;
      r.aimAngle = data.aim;
      r.bodyAngle = data.body;
      r.isMoving = data.moving;
      r.walkCycle = data.walk;
      r.hp = data.hp;
      r.adsProgress = data.ads;
      r.equippedWeapon = data.weapon;
      r.tabActive = data.tabActive !== undefined ? data.tabActive : true;
      r.screenState = data.screenState || 'game';
    } else if (data.t === 'shoot') {
      if (this.onPeerShoot) this.onPeerShoot(senderId, data.m, data.b);
    } else if (data.t === 'dmg') {
      if (this.onPeerDamage) this.onPeerDamage(data.target, data.d, data.k, senderId);
    }
  }
}
