import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { clamp, smoothstep } from './utils.js';

export function createPlayer(THREERef, world) {
  // Use world.THREE for consistency
  const THREE = THREERef;
  const group = new THREE.Group();

  const bodyGeo = new THREE.CapsuleGeometry(0.8, 1.6, 8, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7bffbd, emissive: 0x0c3025, emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.4 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Muzzle flash sphere
  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  muzzle.position.set(0.4, 0.6, -0.6);
  muzzle.visible = false;
  group.add(muzzle);

  const cameraHolder = new THREE.Object3D();
  cameraHolder.position.set(0, 1.0, 0);
  group.add(cameraHolder);
  cameraHolder.add(world.camera);

  // Player state
  const state = {
    radius: world.planetRadius + 1.2,
    yaw: 0,
    pitch: 0,
    moveForward: 0,
    moveRight: 0,
    sprint: false,
    dash: false,
    health: 100,
    maxHealth: 100,
    stamina: 100,
    dashCooldown: 0,
    shootCooldown: 0,
    muzzleTimer: 0,
    activeEffects: [],
  };

  const keys = new Set();
  addEventListener('keydown', (e) => { keys.add(e.code); });
  addEventListener('keyup', (e) => { keys.delete(e.code); });

  // Pointer lock mouse look
  let lookActive = false;
  document.addEventListener('pointerlockchange', () => {
    lookActive = document.pointerLockElement === document.body;
  });
  document.addEventListener('mousemove', (e) => {
    if (!lookActive) return;
    const sens = 0.0025;
    state.yaw -= e.movementX * sens;
    state.pitch -= e.movementY * sens;
    state.pitch = clamp(state.pitch, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
  });

  function getNormalFromPosition(pos) {
    return pos.clone().normalize();
  }

  function reset() {
    // Place at a random location around equator
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.PI / 2 + (Math.random() * 0.4 - 0.2);
    const r = state.radius;
    const pos = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    group.position.copy(pos);

    const normal = getNormalFromPosition(group.position);
    state.yaw = Math.atan2(normal.z, normal.x) + Math.PI;
    state.pitch = 0;

    state.health = state.maxHealth;
    state.stamina = 100;
    state.dashCooldown = 0;
    state.shootCooldown = 0;
    state.muzzleTimer = 0;
    state.activeEffects = [];
  }

  function update(dt) {
    // Inputs
    state.moveForward = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
    state.moveRight = (keys.has('KeyD') ? 1 : 0) + (keys.has('KeyA') ? -1 : 0);
    state.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const tryDash = keys.has('Space');

    // Movement frame (tangent space)
    const up = getNormalFromPosition(group.position);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(up, state.yaw);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQuat);

    // Speed
    let speed = 12;
    if (state.sprint && state.stamina > 0) {
      speed = 18; state.stamina = Math.max(0, state.stamina - dt * 22);
    } else {
      state.stamina = Math.min(100, state.stamina + dt * 12);
    }

    // Dash
    if (tryDash && state.dashCooldown <= 0) {
      state.dash = true;
      state.dashCooldown = 1.0;
    }
    if (state.dash) {
      speed *= 3.2; // short burst
      state.dash = false;
    }
    state.dashCooldown -= dt;

    const moveDir = forward.clone().multiplyScalar(state.moveForward).add(right.clone().multiplyScalar(state.moveRight));
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    // Integrate along surface: project movement onto tangent plane
    let delta = moveDir.multiplyScalar(speed * dt);

    // Move position along sphere by rotating around axis perpendicular to up and desired move vector
    if (delta.lengthSq() > 0) {
      const axis = up.clone().cross(delta).normalize();
      const angle = delta.length() / state.radius;
      const rot = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      group.position.applyQuaternion(rot);
    }

    // Keep on surface radius
    group.position.normalize().multiplyScalar(state.radius);

    // Align body upright to planet normal and yaw/pitch for camera
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    const yawRotation = new THREE.Quaternion().setFromAxisAngle(up, state.yaw);
    group.quaternion.copy(targetQuat.multiply(yawRotation));

    // Camera pitch relative to right axis
    const rightAxis = right;
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(rightAxis, state.pitch);
    world.camera.quaternion.copy(pitchQuat.multiply(group.quaternion));

    // Update muzzle flash
    if (state.muzzleTimer > 0) {
      state.muzzleTimer -= dt;
      muzzle.visible = state.muzzleTimer > 0;
    } else {
      muzzle.visible = false;
    }

    // Score trickle for moving
    const scoreGain = moveDir.length() > 0 ? 1 * dt : 0;

    // Update effects
    if (state.activeEffects.length > 0) {
      for (let i = state.activeEffects.length - 1; i >= 0; i--) {
        const eff = state.activeEffects[i];
        eff.timeLeft -= dt;
        if (eff.timeLeft <= 0) {
          eff.onEnd?.();
          state.activeEffects.splice(i, 1);
        } else {
          eff.onTick?.(dt);
        }
      }
    }

    return scoreGain;
  }

  const shootRay = new THREE.Ray();
  function getShootRay() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(world.camera.quaternion);
    shootRay.origin.copy(world.camera.getWorldPosition(new THREE.Vector3()));
    shootRay.direction.copy(dir.normalize());
    return shootRay;
  }

  function shoot() {
    if (shootCooldown() > 0) return false;
    // Flash
    muzzle.visible = true;
    state.muzzleTimer = 0.05;
    _shootCooldown = 0.12 / (1 + getEffectLevel('firerate') * 0.5);
    return true;
  }

  let _shootCooldown = 0;
  function shootCooldown() {
    return _shootCooldown;
  }

  function getAmmoText() {
    return '∞';
  }

  function applyDamage(dmg) {
    const shield = getEffectLevel('shield');
    const taken = Math.max(0, dmg - shield * 0.5);
    state.health = Math.max(0, state.health - taken);
  }

  function addEffect(type, duration, magnitude = 1) {
    const existing = state.activeEffects.find(e => e.type === type);
    if (existing) {
      existing.timeLeft = Math.max(existing.timeLeft, duration);
      existing.magnitude = Math.max(existing.magnitude, magnitude);
      return;
    }
    const effect = { type, timeLeft: duration, magnitude };
    // Hook behaviors
    if (type === 'speed') {
      effect.onTick = () => {};
    }
    if (type === 'heal') {
      state.health = Math.min(state.maxHealth, state.health + 30 * magnitude);
    }
    state.activeEffects.push(effect);
  }

  function getEffectLevel(type) {
    const eff = state.activeEffects.find(e => e.type === type);
    return eff ? eff.magnitude : 0;
  }

  function tickCooldowns(dt) {
    _shootCooldown = Math.max(0, _shootCooldown - dt);
  }

  return {
    group,
    reset,
    update: (dt) => { tickCooldowns(dt); return update(dt); },
    shoot,
    getShootRay,
    getAmmoText,
    applyDamage,
    get health() { return state.health; },
    addEffect,
  };
}