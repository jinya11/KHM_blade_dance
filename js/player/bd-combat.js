"use strict";
// 전투 판정 — 처치·연격·점수·질풍검 충전 계산, 폭발/방패 방어 처리, 대시 종료(endDash) 쿨타임 결정.
function addText(x,y,s,color,size){ texts.push({x,y,s,color,size:size||18,life:0,dur:.85}); }
function burst(x,y,color,n,pow){
  for(let i=0;i<n;i++){
    const a = rnd(0,6.283), sp = rnd(60,pow);
    parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(1.5,4.5),color,life:0,dur:rnd(.3,.72)});
  }
}
function killEnemy(e, chain, noCharge, soundKind){
  if(!e.alive) return;
  e.alive = false; kills++;
  evadeStreak = 0; stamina = Math.min(MAX_STAMINA, stamina + MAX_STAMINA*STAMINA_RESTORE_PCT);
  combo++; comboTimer = COMBO_WINDOW;
  maxCombo = Math.max(maxCombo, combo);
  const mult = 1 + (combo-1)*.15;
  const gain = Math.round(e.score * mult);
  score += gain;
  player.killed = true;
  burst(e.x, e.y, e.color, chain?10:14, chain?230:300);
  addText(e.x, e.y-e.r-6, "+"+gain, combo>=8?"#E8B84B":"#EDE4D3", combo>=8?21:17);
  if(soundKind === "gale") sfx.galeKill();
  else if(soundKind === "kwi") sfx.kwiKill();
  else sfx.kill(combo);
  if(!noCharge && combo % CHARGE_STEP === 0 && charges < MAX_CHARGE){
    charges++; flash = Math.max(flash,.3);
    addText(player.x, player.y-40, "질풍검", "#E8B84B", 22);
  }
  if(e.key === "bomber") explode(e.x, e.y);
  if(e.key === "healer") dropHeal(e.x, e.y);
  if(e.key === "charger"){ chargerCd = CHARGER_RESPAWN_DELAY; beams = []; }
  syncHud();
}
/** 접촉/탄환 등 어떤 피격원이든 공통으로 처리하는 피해 적용. */
function damagePlayer(){
  player.hp--; player.invuln = 1.55;
  combo = 0; comboTimer = 0; shake = 14; sfx.hurt();
  addText(player.x, player.y-42, "피격", "#E0453A", 20);
  burst(player.x, player.y, "#E0453A", 12, 260);
  for(const o of enemies){
    if(!o.alive) continue;
    const d = dist(o.x,o.y,player.x,player.y);
    if(d < 190){ o.kb = 780; o.kx = (o.x-player.x)/(d||1); o.ky = (o.y-player.y)/(d||1); o.atk = Math.max(o.atk,.5); }
  }
  syncHud();
  if(player.hp <= 0) gameOver("체력 소진");
}
function explode(x,y){
  sfx.boom(); shake = Math.max(shake, 8);
  parts.push({ring:true,x,y,r:8,color:"#E8B84B",life:0,dur:.42});
  burst(x,y,"#E8B84B",18,420);
  for(const o of enemies){
    if(o.alive && dist(x,y,o.x,o.y) < 118){ player.hitSet && player.hitSet.add(o); killEnemy(o, true); }
  }
}
function blockedBy(e){
  // 정면 방어: 적이 돌진해오는 방향을 바라보고 있으면 막힌다
  const incoming = Math.atan2(-player.dy, -player.dx);
  return e.stagger <= 0 && Math.abs(angDiff(e.facing, incoming)) < 1.32;
}
function endDash(penalty){
  player.dashing = false;
  if(player.killed){ player.cd = 0; hitDashes++; }
  else if(player.isReposition && !penalty){ player.cd = 0; } // 빈 공간 이동은 쿨타임 없음
  else player.cd = penalty ? BLOCK_CD : DASH_CD;
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
      player.x -= player.dx * 46; player.y -= player.dy * 46;
      player.x = clamp(player.x,14,W-14); player.y = clamp(player.y,14,H-14);
      player.invuln = Math.max(player.invuln, .45);
      player.quickRecover = BLOCK_RECOVER_WINDOW;
      player.blocked = true; // 막힌 동안은 마우스 추적 이동도 멈춘다
      endDash(true); syncHud();
      return true;
    }
    if(e.key === "guardian") addText(e.x, e.y-e.r-10, "약점!", "#E8B84B", 19);
    killEnemy(e, false);
  }
  return false;
}
