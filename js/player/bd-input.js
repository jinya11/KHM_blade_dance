"use strict";
// 입력 처리 — 마우스/터치 좌표 해석, 대시 대상(적 or 빈 공간) 탐색, 대시 시작(startDash).
let mouseX = W/2, mouseY = H/2; // 마우스 추적 이동(update)이 참조하는 최신 포인터 좌표
cv.addEventListener("mousemove", e=>{ const p = pointerAt(e); mouseX = p.x; mouseY = p.y; });
function pointerAt(e){
  const r = cv.getBoundingClientRect();
  const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
  return {x:p.clientX - r.left, y:p.clientY - r.top};
}
function findNearestEnemy(p){
  let best = null, bd = 1e9;
  for(const en of enemies){
    if(!en.alive) continue;
    const d = dist(p.x,p.y,en.x,en.y);
    if(d < en.r + 30 && d < bd){ bd = d; best = en; }
  }
  return best;
}
function onPress(e){
  if(state !== "play" || staminaLock > 0) return;
  e.preventDefault();
  const p = pointerAt(e);
  if(player.dashing) return;
  if(player.cd > 0){
    if(player.quickRecover <= 0) return;
    player.cd = 0; player.quickRecover = 0; // 방패 막힘 직후 빠른 재입력 — 페널티 없이 재돌진
    addText(player.x, player.y-40, "파훼!", "#DCE9F2", 19);
  }
  const best = findNearestEnemy(p);
  if(best){ startDash(best.x, best.y, best); return; }
  // 빈 공간: 클릭한 지점까지 자유 이동(최대 사거리 제한) — 처치 없이 계속하면 기력이 가중치를 받으며 소모된다
  const d = dist(player.x, player.y, p.x, p.y);
  const k = Math.min(1, MAX_DASH_RANGE/Math.max(1,d));
  const tx = player.x + (p.x-player.x)*k, ty = player.y + (p.y-player.y)*k;
  const cost = STAMINA_COST_BASE + evadeStreak*STAMINA_COST_STEP;
  evadeStreak++;
  stamina = Math.max(0, stamina - cost);
  if(stamina <= 0) staminaLock = STAMINA_LOCK_TIME;
  syncHud();
  startDash(tx, ty, null);
}
/** 마우스 휠 클릭: 질풍참 발동. 스택 수(1/2/3)에 따라 효과가 다르다. */
function onWheelPress(e){
  e.preventDefault();
  if(state !== "play" || paused || player.dashing || charges <= 0) return;
  const n = charges;
  charges = 0; syncHud();
  if(n === 1) galeSwords();
  else if(n === 2) galeLine();
  else galeNuke();
}
cv.addEventListener("mousedown", e=>{ if(e.button === 1) onWheelPress(e); else if(e.button !== 2) onPress(e); });
cv.addEventListener("auxclick", e=>{ if(e.button === 1) e.preventDefault(); });
cv.addEventListener("touchstart", onPress, {passive:false});

function startDash(tx,ty,target,forceUlt){
  // 감금 벽은 dashHitsCage()가 실제로 벽에 닿았을 때만 막는다 — 벽 밖은 항상 자유롭게 이동 가능
  tx = clamp(tx, 14, W-14); ty = clamp(ty, 14, H-14);
  const d = Math.max(1, dist(player.x,player.y,tx,ty));
  player.dashing = true; player.t = 0;
  player.dur = clamp(d/DASH_SPEED, .07, .26);
  player.fx = player.x; player.fy = player.y; player.tx = tx; player.ty = ty;
  player.dx = (tx-player.x)/d; player.dy = (ty-player.y)/d;
  player.facing = Math.atan2(player.dy, player.dx);
  player.killed = false;
  player.isReposition = !target;
  player.ult = !!forceUlt; // 더 이상 charges에서 자동으로 켜지지 않는다 — 오른쪽 클릭(질풍참)으로만 켜진다
  player.hitSet = new Set();
  if(player.ult){ sfx.ult(); flash = Math.max(flash,.45); }
  else sfx.dash();
  dashCount++;
  slashes.push({x:player.x,y:player.y,a:player.facing,len:d,life:0,dur:.3,ult:player.ult});
}
