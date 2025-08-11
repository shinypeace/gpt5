import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

export class EnemyManager {
  constructor(THREERef, world, player) {
    this.THREE = THREERef;
    this.world = world;
    this.player = player;
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.reset();
  }

  reset() {
    this.enemies = [];
    this.spawnTimer = 0;
    this.difficulty = 1;
    // Remove all from scene
    while (this.group.children.length) this.group.remove(this.group.children[0]);
  }

  spawnEnemy() {
    const THREE = this.THREE;
    const radius = this.world.planetRadius + 1.0;
    // Random position not too close to player
    let pos;
    for (let i = 0; i < 20; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
      if (pos.distanceTo(this.player.group.position) > 25) break;
    }

    const body = this.createEnemyMesh();
    body.position.copy(pos);
    this.group.add(body);

    const enemy = {
      mesh: body,
      health: 30,
      speed: 8 + Math.random() * 2 + this.difficulty * 0.3,
      fireCooldown: 1.0,
      attackTimer: 0,
      alive: true,
      value: 15,
    };
    this.enemies.push(enemy);
  }

  createEnemyMesh() {
    const THREE = this.THREE;
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4, 0),
      new THREE.MeshStandardMaterial({ color: 0xb16dff, emissive: 0x2b0c42, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.4, flatShading: true })
    );
    core.castShadow = true; core.receiveShadow = true;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.15, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x6dd6ff, emissive: 0x0b2440, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    core.add(ring);

    return core;
  }

  update(dt) {
    // Spawn logic scales with time
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = Math.max(0.4, 2.2 - this.difficulty * 0.08);
      this.difficulty += 0.05;
    }

    // Move enemies towards player on sphere surface
    const upPlayer = this.player.group.position.clone().normalize();

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const pos = e.mesh.position;
      const up = pos.clone().normalize();

      // Tangent basis
      const toPlayer = this.player.group.position.clone().sub(pos);
      const tangentToPlayer = toPlayer.sub(up.clone().multiplyScalar(toPlayer.dot(up))).normalize();
      const step = Math.min(1, e.speed * dt / this.world.planetRadius);

      const axis = up.clone().cross(tangentToPlayer).normalize();
      const angle = step; // small rotation along surface
      const rot = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      pos.applyQuaternion(rot);
      pos.normalize().multiplyScalar(this.world.planetRadius + 1.0);

      // Face
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), up);
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(tangentToPlayer.x, tangentToPlayer.z));
      e.mesh.quaternion.slerp(targetQuat.multiply(yawQuat), 0.2);

      // Attack
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        const distance = pos.distanceTo(this.player.group.position);
        if (distance < 20) {
          // Hitscan ray towards player with slight inaccuracy
          const dir = this.player.group.position.clone().sub(pos).normalize();
          dir.applyAxisAngle(up, (Math.random() - 0.5) * 0.1);
          // Determine hit
          const aimDot = dir.dot(this.player.group.position.clone().normalize());
          // Damage probability scales with proximity
          if (Math.random() < 0.6) {
            e.pendingDamage = (e.pendingDamage || 0) + (distance < 10 ? 12 : 6);
          }
          e.attackTimer = e.fireCooldown;
        }
      }
    }

    // Cleanup dead
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        this.group.remove(e.mesh);
        this.enemies.splice(i, 1);
      }
    }
  }

  handlePlayerRay(ray) {
    if (!ray) return null;
    // Perform simple sphere intersection per enemy
    let best = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const center = e.mesh.position;
      const radius = 1.5;
      const t = intersectRaySphere(ray.origin, ray.direction, center, radius);
      if (t && t < bestDist) { bestDist = t; best = e; }
    }
    if (best) {
      const damage = 20;
      best.health -= damage;
      if (best.health <= 0) {
        best.alive = false;
        return { score: best.value, killed: true };
      }
      return { score: 5, killed: false };
    }
    return null;
  }

  dealDamageToPlayer() {
    // Aggregate pending damage from enemies
    let dmg = 0;
    for (const e of this.enemies) {
      if (e.pendingDamage) { dmg += e.pendingDamage; e.pendingDamage = 0; }
    }
    return dmg;
  }
}

function intersectRaySphere(ro, rd, center, radius) {
  const oc = ro.clone().sub(center);
  const b = oc.dot(rd);
  const c = oc.dot(oc) - radius * radius;
  const h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : null;
}