"use strict";
// 보스 공통 시스템 — 모드별 등장 타이밍, 체력/피격/처치/보상, 잔상·감금벽 같은 범용 위험지대, 체력바.
// 보스별 고유 스탯·패턴은 bd-boss-*.js가 BOSS_TYPES에 등록해서 여기 공통 시스템에 얹힌다.
const BOSS_TYPES = {};

function spawnBoss(){
  bossActive = true;
  enemies = []; bossZones = []; cage = null; // 보스전 동안은 다른 몬스터 없이 필드를 비운다
  const key = Object.keys(BOSS_TYPES)[0]; // 현재 1종 — 추후 무작위 선택으로 교체 가능
  const type = BOSS_TYPES[key], s = type.stats;
  const x = W/2, y = -70;
  const boss = {key:"boss", type:key, x, y, r:s.r, spd:s.spd, hp:s.hp, maxHp:s.hp, score:0, color:s.color,
                alive:true, facing:Math.atan2(player.y-y,player.x-x), atk:.8, born:0, stagger:0, wob:0, kb:0, kx:0, ky:0};
  enemies.push(boss);
  shake = Math.max(shake, 14); flash = Math.max(flash, .4);
  sfx.boom();
  addText(W/2, H*0.3, s.name+" 출현", "#E0453A", 30);
  syncBossHp(boss);
  if(type.onSpawn) type.onSpawn(boss);
}
/** 타이머가 있던 자리(hud__timer)를 보스전 동안 체력바로 재사용한다. */
function syncBossHp(e){
  el.timerFill.style.width = Math.max(0, e.hp/e.maxHp*100) + "%";
  el.timerFill.classList.add("low");
  el.timerTxt.textContent = Math.max(0,e.hp)+" / "+e.maxHp;
}
function hitBoss(e, dmg){
  e.hp -= dmg;
  e.atk = Math.max(e.atk, 0.5); // 피격 시 0.5초간 공격 불가(패턴별 조건)
  bossNoAttack = Math.max(bossNoAttack, 0.5); // 피격 시 0.5초간 어떤 공격도 실제로 적용되지 않음(공통 안전장치)
  player.killed = true; // 명중 시 쿨타임 즉시 초기화 — 보스도 예외 없이 매 타격마다 적용
  stamina = Math.min(MAX_STAMINA, stamina + BOSS_HIT_STAMINA_RESTORE);
  comboTimer = COMBO_WINDOW;
  shake = Math.max(shake, 5);
  burst(e.x, e.y, e.color, 6, 200);
  addText(e.x, e.y-e.r-10, "-"+dmg, "#EDE4D3", 16);
  syncBossHp(e); syncHud();
  if(e.hp <= 0) killBoss(e);
}
function killBoss(e){
  // 보스는 무한 모드에서만 등장하므로 보상 경로도 하나뿐이다.
  e.alive = false; kills++;
  combo++; comboTimer = COMBO_WINDOW; maxCombo = Math.max(maxCombo, combo);
  player.killed = true;
  bossActive = false; bossZones = []; cage = null;
  burst(e.x, e.y, e.color, 40, 420);
  sfx.boom();
  const type = BOSS_TYPES[e.type];
  if(type && type.onKilled) type.onKilled(e);
  charges = Math.min(MAX_CHARGE, charges + BOSS_CHARGE_BONUS);
  score += BOSS_SCORE_BONUS;
  flash = Math.max(flash, .5);
  addText(e.x, e.y-e.r-14, "+"+BOSS_SCORE_BONUS.toLocaleString(), "#E8B84B", 26);
  syncHud();
  bossTimer = rnd(BOSS_INTERVAL_MIN, BOSS_INTERVAL_MAX);
}

/** 공통. 보스 패턴이 어떤 경로로든 플레이어에게 피해를 줄 때 반드시 이걸 통해야 한다.
 *  무적(invuln) 중이거나 방금 피격당해 bossNoAttack이 남아있으면 아무 효과가 없다 —
 *  "공격 성공 시 피격 판정 삭제" + "피격 시 공격 판정 자체가 발생하지 않음"을 한 곳에서 보장한다. */
function bossHitPlayer(){
  if(player.invuln > 0 || bossNoAttack > 0) return false;
  damagePlayer();
  return true;
}

/** 감금 벽 중 살아있는 쪽으로만 좌표를 제한한다 — 벽이 부서진 방향은 그대로 통과된다. */
function boundX(x){
  if(!cage) return clamp(x, 14, W-14);
  const lo = cage.walls.left.hp  > 0 ? cage.cx-cage.half+10 : 14;
  const hi = cage.walls.right.hp > 0 ? cage.cx+cage.half-10 : W-14;
  return clamp(x, lo, hi);
}
function boundY(y){
  if(!cage) return clamp(y, 14, H-14);
  const lo = cage.walls.top.hp    > 0 ? cage.cy-cage.half+10 : 14;
  const hi = cage.walls.bottom.hp > 0 ? cage.cy+cage.half-10 : H-14;
  return clamp(y, lo, hi);
}

/** true를 반환하면 계속 진행, false면 사망으로 라운드가 끝났다는 뜻(update()가 즉시 return해야 함). */
function updateBossExtras(dt){
  if(bossNoAttack > 0) bossNoAttack = Math.max(0, bossNoAttack - dt);
  for(const z of bossZones) z.life += dt;
  if(player.invuln <= 0){
    for(const z of bossZones){
      if(z.kind === "hurt" && z.life < z.dur && dist(z.x,z.y,player.x,player.y) < z.r + PLAYER_R){
        if(bossHitPlayer()){ shake = Math.max(shake, 8); addText(player.x, player.y-42, "피격", "#E0453A", 20); }
        break;
      }
    }
  }
  bossZones = bossZones.filter(z => z.life < z.dur);
  if(cage && Object.values(cage.walls).every(w => w.hp <= 0)) cage = null;
  return state === "play";
}
function drawBossExtras(){
  for(const z of bossZones){
    const k = 1 - z.life/z.dur;
    ctx.globalAlpha = Math.max(0, k*.7);
    ctx.fillStyle = z.color || "#8B1E3F";
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if(cage){
    ctx.lineWidth = 5;
    for(const k in cage.walls){
      const w = cage.walls[k];
      if(w.hp <= 0) continue;
      ctx.globalAlpha = Math.max(.35, w.hp/w.maxHp);
      ctx.strokeStyle = "rgba(232,184,75,.9)";
      ctx.beginPath(); ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
/** 대시 경로가 감금 벽에 닿았는지 검사 — 맞으면 그 벽만 깎이고 플레이어는 피해 없음. */
function dashHitsCage(nx, ny){
  if(!cage) return false;
  for(const k in cage.walls){
    const w = cage.walls[k];
    if(w.hp <= 0) continue;
    if(segDist(w.x1,w.y1,w.x2,w.y2, nx,ny) < 20){
      w.hp--;
      burst((w.x1+w.x2)/2, (w.y1+w.y2)/2, "#E8B84B", 10, 260);
      sfx.block();
      return true;
    }
  }
  return false;
}
function drawBoss(e, R){
  const type = BOSS_TYPES[e.type];
  if(type && type.draw){ type.draw(e, R); return; }
  ctx.fillStyle = e.color;
  ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
  ctx.strokeStyle = "rgba(232,184,75,.85)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0,0,R+6,0,6.283); ctx.stroke();
}
