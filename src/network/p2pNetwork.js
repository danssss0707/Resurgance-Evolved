export class P2PNetwork {
  constructor(roomCode = '1111') {
    this.roomCode = String(roomCode);
    this.beaconId = `${this.roomCode}_beacon`;
    this.peer = null;
    this.peerId = null;
    this.isBeacon = false;

    this.connections = new Map(); // peerId -> DataConnection
    this.remotePlayers = new Map(); // peerId -> player state

    this.onPeerJoin = null;
    this.onPeerLeave = null;
    this.onPeerShoot = null;
    this.onPeerDamage = null;

    this.broadcastRate = 30; // 30Hz
    this.lastBroadcast = 0;

    // Track tab focus state without aggressively hiding players
    this.isTabActive = true;
    window.addEventListener('focus', () => { this.isTabActive = true; });
    window.addEventListener('blur', () => { this.isTabActive = false; });
    document.addEventListener('visibilitychange', () => {
      this.isTabActive = !document.hidden;
    });

    // Current state: 'game' | 'gunsmith' | 'menu'
    this.currentScreen = 'menu';
  }

  connect(onReady) {
    if (this.peer && !this.peer.destroyed) {
      if (onReady) onReady(this.peerId);
      return;
    }

    // Try claiming the room beacon
    this.peer = new window.Peer(this.beaconId, { debug: 1 });

    this.peer.on('open', (id) => {
      this.peerId = id;
      this.isBeacon = true;
      console.log(`[P2P] Room ${this.roomCode} Beacon active:`, id);
      this.listenForIncoming();
      if (onReady) onReady(id);
    });

    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        this.peer.destroy();
        this.connectAsMember(onReady);
      } else {
        console.error('[P2P] Peer error:', err);
      }
    });
  }

  connectAsMember(onReady) {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    this.peerId = `${this.roomCode}_p_${randomSuffix}`;
    this.isBeacon = false;

    this.peer = new window.Peer(this.peerId, { debug: 1 });

    this.peer.on('open', (id) => {
      console.log(`[P2P] Joined room ${this.roomCode}:`, id);
      this.listenForIncoming();

      // Connect to the beacon
      const conn = this.peer.connect(this.beaconId, { reliable: false });
      this.bindConnection(conn);

      if (onReady) onReady(id);
    });

    this.peer.on('error', (err) => {
      console.error('[P2P Member Error]:', err);
    });
  }

  listenForIncoming() {
    this.peer.on('connection', (conn) => {
      this.bindConnection(conn);

      // If we are the beacon, introduce the new connection to everyone else in the room
      if (this.isBeacon) {
        conn.on('open', () => {
          const allOtherPeers = Array.from(this.connections.keys()).filter(id => id !== conn.peer);
          // Tell the newcomer about everyone
          conn.send({ t: 'mesh_manifest', peers: allOtherPeers });
          // Tell everyone about the newcomer
          this.broadcast({ t: 'new_peer_arrived', peerId: conn.peer });
        });
      }
    });
  }

  bindConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      console.log(`[P2P] Connected to: ${conn.peer}`);
      if (this.onPeerJoin) this.onPeerJoin(conn.peer);
    });

    conn.on('data', (data) => {
      if (!data || !data.t) return;

      // Full mesh handshake resolution
      if (data.t === 'mesh_manifest') {
        for (const pid of data.peers) {
          if (!this.connections.has(pid) && pid !== this.peerId) {
            const peerConn = this.peer.connect(pid, { reliable: false });
            this.bindConnection(peerConn);
          }
        }
        return;
      }

      if (data.t === 'new_peer_arrived') {
        if (!this.connections.has(data.peerId) && data.peerId !== this.peerId) {
          const peerConn = this.peer.connect(data.peerId, { reliable: false });
          this.bindConnection(peerConn);
        }
        return;
      }

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