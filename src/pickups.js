import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

export class PickupManager {
  constructor(THREERef, world, player) {
    this.THREE = THREERef;
    this.world = world;
    this.player = player;
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.reset();
  }

  reset() {
    this.pickups = [];
    this.spawnTimer = 1.5;
    while (this.group.children.length) this.group.remove(this.group.children[0]);
  }

  spawnPickup() {
    const THREE = this.THREE;
    const radius = this.world.planetRadius + 1.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const pos = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);

    const types = [ 'heal', 'speed', 'shield', 'firerate' ];
    const type = types[Math.floor(Math.random() * types.length)];
    const mesh = this.createPickupMesh(type);
    mesh.position.copy(pos);
    mesh.userData.type = type;
    mesh.userData.t = Math.random() * Math.PI * 2;
    this.group.add(mesh);

    const p = { mesh, type, alive: true };
    this.pickups.push(p);
  }

  createPickupMesh(type) {
    const THREE = this.THREE;
    let color = 0x7bffbd;
    if (type === 'speed') color = 0x6dd6ff;
    if (type === 'shield') color = 0xffe06d;
    if (type === 'firerate') color = 0xff7a7a;

    const core = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.8, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, metalness: 0.1, roughness: 0.4, flatShading: true })
    );
    core.castShadow = true; core.receiveShadow = true;

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.06, 8, 24),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, metalness: 0.1, roughness: 0.6 })
    );
    halo.rotation.x = Math.PI / 2;
    core.add(halo);

    return core;
  }

  update(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPickup();
      this.spawnTimer = 4.0;
    }
    for (const p of this.pickups) {
      if (!p.alive) continue;
      const up = p.mesh.position.clone().normalize();
      p.mesh.userData.t += dt;
      p.mesh.position.add(up.clone().multiplyScalar(Math.sin(p.mesh.userData.t * 2.0) * 0.1));
      p.mesh.rotation.y += dt * 1.2;
    }
    // Cleanup
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (!this.pickups[i].alive) { this.group.remove(this.pickups[i].mesh); this.pickups.splice(i, 1); }
    }
  }

  collectIfPossible() {
    let got = null;
    for (const p of this.pickups) {
      if (!p.alive) continue;
      const distance = p.mesh.position.distanceTo(this.player.group.position);
      if (distance < 2.2) {
        p.alive = false;
        const type = p.type;
        if (type === 'heal') this.player.addEffect('heal', 0.1, 1);
        if (type === 'speed') this.player.addEffect('speed', 8.0, 1);
        if (type === 'shield') this.player.addEffect('shield', 10.0, 1);
        if (type === 'firerate') this.player.addEffect('firerate', 8.0, 1);
        got = { type };
      }
    }
    return got;
  }
}

export function PickupManagerFactory(THREE, world, player) {
  return new PickupManager(THREE, world, player);
}