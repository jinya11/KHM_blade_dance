"use strict";
// 전투 판정 — 처치·연격·점수·질풍검 충전 계산, 폭발/방패 방어 처리, 대시 종료(endDash) 쿨타임 결정.
function addText(x,y,s,color,size){ texts.push({x,y,s,color,size:size||18,life:0,dur:.85}); }
function burst(x,y,color,n,pow){
  for(let i=0;i<n;i++){
    const a = rnd(0,6.283), sp = rnd(60,pow);
    parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(1.5,4.5),color,life:0,dur:rnd(.3,.72)});
  }
}
/** 처치 성공 시 공통 보상(연격/기력) 적용 — hitOrKill 명중, killEnemy 둘 다 사용. */
function onSuccessfulHit(){
  evadeStreak = 0; stamina = Math.min(MAX_STAMINA, stamina + MAX_STAMINA*STAMINA_RESTORE_PCT);
  combo++; comboTimer = COMBO_WINDOW; maxCombo = Math.max(maxCombo, combo);
}
/** 처치 효과음 — soundKind로 질풍참/귀풍참/기본 중 하나를 고른다. */
function playKillSound(soundKind){
  if(soundKind === "gale") sfx.galeKill();
  else if(soundKind === "kwi") sfx.kwiKill();
  else sfx.kill(combo);
}
/** 연격 8회마다 질풍검 1충전(최대 3) — noCharge면 건너뛴다. */
function tryGainCharge(noCharge){
  if(noCharge || combo % CHARGE_STEP !== 0 || charges >= MAX_CHARGE) return;
  charges++; flash = Math.max(flash,.3);
  addText(player.x, player.y-40, "질풍검", "#E8B84B", 22);
}
/** 다타형(5단계 진화) 적에게 사용하는 공용 피격 진입점 — 처치 조건 안 되면 타격만 처리하고 살려둔다. */
function hitOrKill(e, chain, noCharge, soundKind, dmg){
  if(!e.alive) return false;
  dmg = dmg || 1;
  if(e.hp > dmg){
    e.hp -= dmg; e.hitFlash = .15;
    player.killed = true; hitDashes++; // 처치는 아니어도 "명중"으로 취급 — 쿨타임 페널티 없음
    onSuccessfulHit();
    burst(e.x, e.y, e.color, 6, 160);
    playKillSound(soundKind);
    tryGainCharge(noCharge);
    syncHud();
    return false;
  }
  killEnemy(e, chain, noCharge, soundKind);
  return true;
}
function killEnemy(e, chain, noCharge, soundKind){
  if(!e.alive) return;
  if(e.key === "bomber" && e.evoStage === 3 && !e.lunging){
    // 3단계 유도판: 즉시 죽지 않고 플레이어 쪽으로 짧게 돌진한 뒤 그 자리에서 터진다
    e.lunging = true; e.lungeT = 0;
    const a = Math.atan2(player.y-e.y, player.x-e.x);
    e.lungeVx = Math.cos(a)*EVO_BOMBER_LUNGE_SPEED; e.lungeVy = Math.sin(a)*EVO_BOMBER_LUNGE_SPEED;
    return;
  }
  e.alive = false; kills++;
  onSuccessfulHit();
  const mult = 1 + (combo-1)*.15;
  const gain = Math.round(e.score * mult);
  score += gain;
  player.killed = true;
  burst(e.x, e.y, e.color, chain?10:14, chain?230:300);
  addText(e.x, e.y-e.r-6, "+"+gain, combo>=8?"#E8B84B":"#EDE4D3", combo>=8?21:17);
  playKillSound(soundKind);
  tryGainCharge(noCharge);
  if(e.key === "bomber"){
    if(e.evoStage === 5){
      delayedBlasts.push({x:e.x, y:e.y, t:EVO_BOMBER_NUKE_DELAY, dur:EVO_BOMBER_NUKE_DELAY, radius:EVO_BOMBER_NUKE_R, big:true});
    } else {
      const radius = e.evoStage >= 1 ? EVO_BOMBER_R1 : 118;
      explode(e.x, e.y, radius, e.evoStage === 2 ? EVO_BOMBER_SHRAPNEL : 0); // 파편탄은 2단계 전용(3/4단계엔 안 나옴)
      if(e.evoStage === 4) delayedBlasts.push({x:e.x, y:e.y, t:EVO_BOMBER_CHAIN_DELAY, dur:EVO_BOMBER_CHAIN_DELAY, radius});
    }
  }
  if(e.key === "slime" && e.evoStage === 2) acidPools.push({x:e.x, y:e.y, r:EVO_SLIME_ACID_R, life:0, dur:EVO_SLIME_ACID_DUR, hitCd:EVO_SLIME_ACID_START_CD});
  if(e.key === "slime" && e.evoStage === 3){
    for(let i=0;i<2;i++){
      const a = rnd(0,6.283), mx = e.x+Math.cos(a)*14, my = e.y+Math.sin(a)*14;
      enemies.push({key:"slime", x:mx, y:my, r:e.r*.6, spd:e.spd*1.25, score:Math.round(e.score*.35), color:e.color,
                    alive:true, facing:0, atk:.4, born:0, stagger:0, wob:rnd(0,6.28), kb:0, kx:0, ky:0,
                    shotCd:9, guardDisarmed:false, evoStage:0, hp:1, maxHp:1, hitFlash:0,
                    chargeCd:9, charging:false, chargeA:0, acidCd:9, slamCd:9, slamWind:0, spinT:0, wallCd:9,
                    lunging:false, lungeT:0, lungeVx:0, lungeVy:0, mini:true, chargerState:null, chargerT:0});
    }
  }
  if(e.key === "healer") dropHeal(e.x, e.y);
  if(e.key === "charger"){ chargerCd = CHARGER_RESPAWN_DELAY; beams = []; }
  if(e.key === "dummy") dummyRespawns.push({x:e.x, y:e.y, t:.2}); // 훈련장 허수아비 — 잠깐 뒤 같은 자리에 리스폰(같은 대시 판정에 바로 다시 잡혀 무한루프 나는 것 방지)
  syncHud();
}
/** 접촉/탄환 등 어떤 피격원이든 공통으로 처리하는 피해 적용. */
function damagePlayer(){
  if(player.overheal > 0) player.overheal--; else player.hp--; // 오버힐이 있으면 그것부터 깎인다
  player.hp = Math.max(0, player.hp);
  player.invuln = 1.55;
  combo = 0; comboTimer = 0; shake = 14; sfx.hurt();
  addText(player.x, player.y-42, "피격", "#E0453A", 20);
  burst(player.x, player.y, "#E0453A", 12, 260);
  for(const o of enemies){
    if(!o.alive || o.key === "dummy") continue;
    const d = dist(o.x,o.y,player.x,player.y);
    if(d < 190){ o.kb = 780; o.kx = (o.x-player.x)/(d||1); o.ky = (o.y-player.y)/(d||1); o.atk = Math.max(o.atk,.5); }
  }
  syncHud();
  if(player.hp <= 0 && mode !== "training") gameOver("체력 소진"); // 훈련장에서는 죽지 않는다
}
function explode(x, y, radius, shrapnel){
  radius = radius || 118;
  const big = radius > 200;
  sfx.boom(); shake = Math.max(shake, big?18:8);
  parts.push({ring:true,x,y,r: big?16:8,color:"#E8B84B",life:0,dur: big?.6:.42,radius});
  burst(x,y,"#E8B84B",big?32:18,big?520:420);
  for(const o of enemies){
    if(o.alive && dist(x,y,o.x,o.y) < radius){ player.hitSet && player.hitSet.add(o); hitOrKill(o, true, false, undefined, 2); }
  }
  if(shrapnel) fireShrapnel(x, y, shrapnel);
}
function fireShrapnel(x, y, n){
  // 폭탄충 파편탄은 다른 적을 끌어들이는 연쇄용이지 플레이어를 노리는 게 아니라서 플레이어에게는 무해하다
  for(let i=0;i<n;i++){
    const a = i/n*6.283 + rnd(-.15,.15);
    bullets.push({x, y, vx:Math.cos(a)*260, vy:Math.sin(a)*260, life:0, dur:1.1, curve:false, noPlayerHit:true, shrapnel:true});
  }
}
/** 질풍참/귀풍참 광역기 공용 — pred(e)를 만족하는 적마다 보스 분기 후 hitOrKill(dmg2). 방패병 파방 없이 그냥 맞는 계열(검식/참식)용. */
function hitAreaSimple(pred, soundKind){
  for(const e of enemies){
    if(!e.alive || e.hidden || !pred(e)) continue;
    if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
    if(e.key === "guardian") addText(e.x, e.y-e.r-10, "약점!", "#E8B84B", 19);
    hitOrKill(e, true, true, soundKind, 2);
  }
}
/** 위와 동일하되, 방패병이 아직 파방 전이면 이번 판정으론 방패만 깨고 넘어간다(멸식/귀환식용). */
function hitAreaDisarm(pred, soundKind, burstOnDisarm){
  for(const e of enemies){
    if(!e.alive || e.hidden || !pred(e)) continue;
    if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
    if(e.key === "guardian" && !e.guardDisarmed){
      e.guardDisarmed = true; e.stagger = GALE_GUARD_STUN;
      e.slamWind = 0; e.spinT = 0; // 파방 순간 진행 중이던 내려찍기/회전베기 예비동작 취소
      addText(e.x, e.y-e.r-10, "파방!", "#E8B84B", 20);
      if(burstOnDisarm) burst(e.x, e.y, "#35A88F", 12, 260);
      continue;
    }
    hitOrKill(e, true, true, soundKind, 2);
  }
}
function blockedBy(e){
  // 정면 방어: 적이 돌진해오는 방향을 바라보고 있으면 막힌다
  const incoming = Math.atan2(-player.dy, -player.dx);
  return e.stagger <= 0 && Math.abs(angDiff(e.facing, incoming)) < 1.32;
}
function endDash(penalty){
  player.dashing = false;
  if(player.killed){ player.cd = 0; player.cdTotal = 0; hitDashes++; }
  else if(player.isReposition && !penalty){ player.cd = 0; player.cdTotal = 0; } // 빈 공간 이동은 쿨타임 없음
  else { player.cd = penalty ? BLOCK_CD : DASH_CD; player.cdTotal = player.cd; }
}
function dashHits(px,py,nx,ny){
  if(dashHitsCage(nx,ny)){ endDash(false); return true; } // 감금 벽: 벽만 깎이고 플레이어는 피해 없음
  const R = player.ult ? HIT_R_ULT : HIT_R;
  for(const e of enemies){
    if(!e.alive || player.hitSet.has(e) || e.hidden) continue;
    if(segDist(px,py,nx,ny,e.x,e.y) > e.r + R) continue;
    player.hitSet.add(e);
    if(e.key === "boss"){ hitBoss(e, player.ult ? BOSS_ULT_DMG : BOSS_HIT_DMG); continue; }
    if(e.key === "guardian" && !e.guardDisarmed && !player.ult && blockedBy(e)){
      // 막힘
      e.stagger = .55; combo = 0; comboTimer = 0;
      shake = Math.max(shake, 11); sfx.block();
      addText(e.x, e.y-e.r-10, "막힘!", "#35A88F", 20);
      burst(e.x, e.y, "#35A88F", 9, 200);
      const kb = e.evoStage === 2 ? EVO_GUARDIAN_KNOCKBACK : 46; // 2단계: 반격 — 넉백만 크게(데미지 없음)
      player.x -= player.dx * kb; player.y -= player.dy * kb;
      player.x = clamp(player.x,14,W-14); player.y = clamp(player.y,14,H-14);
      player.invuln = Math.max(player.invuln, .45);
      player.quickRecover = BLOCK_RECOVER_WINDOW;
      endDash(true); syncHud();
      return true;
    }
    if(e.key === "guardian") addText(e.x, e.y-e.r-10, "약점!", "#E8B84B", 19);
    hitOrKill(e, false);
  }
  return false;
}
