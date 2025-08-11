import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { EnemyManager } from './enemy.js';
import { PickupManager } from './pickups.js';
import { clamp, formatTime, lerp } from './utils.js';
import { setupUI } from './ui.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const world = createWorld(THREE);
const scene = world.scene;
const camera = world.camera;

const player = createPlayer(THREE, world);
const enemies = new EnemyManager(THREE, world, player);
const pickups = new PickupManager(THREE, world, player);

scene.add(player.group);

let gameState = 'menu'; // 'playing' | 'paused' | 'gameover'
let score = 0;
let kills = 0;
let highScore = Number(localStorage.getItem('sr_high') || 0);
let elapsed = 0;
let lastTime = performance.now();

const ui = setupUI({
  onPlay: startGame,
  onShowHow: () => { ui.show('menu', false); ui.show('how', true); },
  onBack: () => { ui.show('how', false); ui.show('menu', true); },
  onResume: resumeGame,
  onRestart: () => { endGame(false); startGame(); },
  onQuit: () => { endGame(false); showMenu(); },
  onRetry: () => { endGame(false); startGame(); },
  onMenu: () => { endGame(false); showMenu(); },
});

updateHUD();
showMenu();

function showMenu() {
  gameState = 'menu';
  ui.show('menu', true);
  ui.show('hud', false);
  ui.show('corner', true);
  ui.show('pause', false);
  ui.show('gameover', false);
}

function startGame() {
  // Reset state
  score = 0; kills = 0; elapsed = 0;
  player.reset();
  enemies.reset();
  pickups.reset();

  ui.lockPointer().then(() => {
    gameState = 'playing';
    ui.show('menu', false);
    ui.show('hud', true);
    ui.show('corner', false);
    ui.show('pause', false);
    ui.show('gameover', false);
  }).catch(() => {
    // User denied pointer lock
  });
}

function resumeGame() {
  ui.lockPointer().then(() => {
    gameState = 'playing';
    ui.show('pause', false);
  });
}

function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  ui.unlockPointer();
  ui.setPauseStats({ score, elapsed, kills });
  ui.show('pause', true);
}

function endGame(isDeath = true) {
  if (isDeath) {
    highScore = Math.max(highScore, score);
    localStorage.setItem('sr_high', String(highScore));
  }
  gameState = 'gameover';
  ui.unlockPointer();
  ui.setGameOver({ score, highScore, kills });
  ui.show('gameover', true);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  world.onResize(innerWidth, innerHeight);
});

addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (gameState === 'playing') pauseGame();
  }
});

// Shooting on click
addEventListener('mousedown', (e) => {
  if (gameState !== 'playing') return;
  if (e.button === 0) {
    const result = player.shoot();
    if (result) {
      // Hitscan result contains ray and potential hit; enemies manager will test collisions
    }
  }
});

function updateHUD() {
  ui.setScore(score);
  ui.setHigh(highScore);
  ui.setTime(formatTime(elapsed));
  ui.setAmmo(player.getAmmoText());
  ui.setHealth(player.health);
}

function update(dt) {
  // World background animation
  world.update(dt);

  if (gameState === 'playing') {
    elapsed += dt;

    const addScore = player.update(dt);
    score += addScore;

    enemies.update(dt);
    const hit = enemies.handlePlayerRay(player.getShootRay());
    if (hit) {
      score += hit.score;
      kills += hit.killed ? 1 : 0;
      ui.flashScore();
    }

    // Enemy damage to player
    const damage = enemies.dealDamageToPlayer();
    if (damage > 0) {
      player.applyDamage(damage);
      ui.flashDamage();
      if (player.health <= 0) {
        endGame(true);
      }
    }

    pickups.update(dt);
    const got = pickups.collectIfPossible();
    if (got) {
      ui.flashPickup(got.type);
    }

    updateHUD();
  }

  renderer.render(scene, camera);
}

function loop() {
  const now = performance.now();
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;
  update(dt);
  requestAnimationFrame(loop);
}

loop();