export function setupUI(handlers) {
  const $ = (id) => document.getElementById(id);
  const menu = $('menu');
  const hud = $('hud');
  const corner = $('corner');
  const pause = $('pause');
  const over = $('gameover');
  const how = $('how');

  $('btnPlay').onclick = handlers.onPlay;
  $('btnHow').onclick = () => { handlers.onShowHow?.(); };
  $('btnBack').onclick = () => { handlers.onBack?.(); };
  $('btnResume').onclick = () => { handlers.onResume?.(); };
  $('btnRestart').onclick = () => { handlers.onRestart?.(); };
  $('btnQuit').onclick = () => { handlers.onQuit?.(); };
  $('btnRetry').onclick = () => { handlers.onRetry?.(); };
  $('btnMenu').onclick = () => { handlers.onMenu?.(); };

  function show(id, vis) {
    $(id).classList.toggle('hidden', !vis);
  }

  function lockPointer() {
    if (document.pointerLockElement === document.body) return Promise.resolve();
    return new Promise((resolve, reject) => {
      function onChange() {
        if (document.pointerLockElement === document.body) {
          document.removeEventListener('pointerlockchange', onChange);
          resolve();
        }
      }
      document.addEventListener('pointerlockchange', onChange);
      document.body.requestPointerLock?.();
      setTimeout(() => {
        if (document.pointerLockElement !== document.body) {
          document.removeEventListener('pointerlockchange', onChange);
          reject();
        }
      }, 600);
    });
  }

  function unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  function setScore(v) { $('score').textContent = Math.floor(v).toString(); }
  function setHigh(v) { $('high').textContent = Math.floor(v).toString(); }
  function setTime(text) { $('time').textContent = text; }
  function setAmmo(text) { $('ammo').textContent = text; }
  function setHealth(hp) {
    const n = Math.max(0, Math.min(100, hp));
    $('hpbar').style.width = `${n}%`;
  }

  function setPauseStats({ score, elapsed, kills }) {
    const t = formatTime(elapsed);
    $('pauseStats').textContent = `Счёт: ${Math.floor(score)} • Время: ${t} • Убийств: ${kills}`;
  }

  function setGameOver({ score, highScore, kills }) {
    $('overStats').textContent = `Счёт: ${Math.floor(score)} • Рекорд: ${Math.floor(highScore)} • Убийств: ${kills}`;
  }

  function flashScore() {
    const el = $('score');
    el.style.transform = 'scale(1.2)';
    el.style.transition = 'transform 0.12s ease';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 120);
  }
  function flashDamage() {
    document.body.animate([{ backgroundColor: 'rgba(255,0,0,0.2)' }, { backgroundColor: 'transparent' }], { duration: 120, iterations: 1 });
  }
  function flashPickup(type) {
    const el = $('ammo');
    el.style.color = '#6dd6ff';
    setTimeout(() => { el.style.color = ''; }, 200);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return {
    show,
    lockPointer,
    unlockPointer,
    setScore,
    setHigh,
    setTime,
    setAmmo,
    setHealth,
    setPauseStats,
    setGameOver,
    flashScore,
    flashDamage,
    flashPickup,
  };
}