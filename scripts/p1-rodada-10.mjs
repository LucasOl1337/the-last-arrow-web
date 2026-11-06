// Fixed, deliberately simple controller, shared by the numerical benchmark and real keyboard play.
// Observes visible positions at 5 Hz. No bot brain, path graph, arrow interception or ballistic oracle.
// Frozen before the baseline: do not tune this controller to improve the after score.
export function createPilot() {
  let nextRead = 0, nextShot = 0, release = 0, jumpUntil = 0, nextJump = 0, nextDash = 1.5;
  let round = -1, keys = [];
  const delta = (a, b, size) => ((b - a + size * 1.5) % size) - size / 2;
  return w => {
    if (w.round !== round) {
      round = w.round; nextRead = nextShot = release = jumpUntil = nextJump = 0; nextDash = 1.5; keys = [];
    }
    const f = w.fighters[0], t = w.roundTime;
    if (w.phase !== 'playing' || !f.alive) return [];
    if (t + 1e-6 < nextRead) return keys;
    nextRead = t + 0.2;
    const targets = w.fighters.filter(other => other.id !== 0 && other.alive);
    const target = targets.sort((a, b) => Math.hypot(delta(f.x,a.x,32),delta(f.y,a.y,18)) - Math.hypot(delta(f.x,b.x,32),delta(f.y,b.y,18)))[0];
    if (!target) return [];
    const dx = delta(f.x,target.x,32), dy = delta(f.y,target.y,18), distance = Math.hypot(dx,dy);
    keys = [];
    if (Math.abs(dx) > .5) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
    // Aim diagonally only when the enemy is visibly well above/below us.
    if (Math.abs(dy) > Math.max(1.2, Math.abs(dx) * .5)) keys.push(dy > 0 ? 'KeyS' : 'KeyW');
    if (t >= nextJump && (f.grounded || f.wall)) { jumpUntil = t + .4; nextJump = t + 1.4; }
    if (t < jumpUntil) keys.push('KeyK');
    if (t >= nextShot && f.ammo > 0 && distance < 11) { release = t + .2; nextShot = t + 1.2; }
    if (t < release - 1e-6) keys.push('KeyJ');
    // Periodic dash, never an inhuman reaction to a projectile.
    if (t >= nextDash) { keys.push('KeyL'); nextDash = t + 2.6; }
    return keys;
  };
}

export function keysToIntent(keys, previous = []) {
  const has = key => keys.includes(key), edge = key => has(key) && !previous.includes(key);
  return { moveX: Number(has('KeyD')) - Number(has('KeyA')), moveY: Number(has('KeyS')) - Number(has('KeyW')),
    jump: edge('KeyK'), jumpHeld: has('KeyK'), shoot: edge('KeyJ'), shootHeld: has('KeyJ'), dash: edge('KeyL') };
}
