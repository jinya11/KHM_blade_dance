"use strict";
// 질풍참(휠 클릭) 효과 — 1스택 검 투사체, 2/3스택은 이동 없이 즉시 발동하는 광역 공격.
const GALE_LINE_THICK = 46;   // 2스택 가로줄 공격 두께
const GALE_GUARD_STUN  = 0.5; // 3스택에 맞은 방패병이 기절하는 시간

/** 1스택: 바라보는 방향 기준 부채꼴로 검 투사체 5발 발사(적을 관통). */
function galeSwords(){
  shake = Math.max(shake, 10); flash = Math.max(flash, .4);
  sfx.ult();
  for(let i=0;i<SWORD_COUNT;i++){
    const a = player.facing + (i-(SWORD_COUNT-1)/2) * (SWORD_SPREAD/(SWORD_COUNT-1));
    swords.push({x:player.x, y:player.y, a, vx:Math.cos(a)*SWORD_SPEED, vy:Math.sin(a)*SWORD_SPEED, life:0, hitSet:new Set()});
  }
}
function updateSwords(dt){
  for(const s of swords){
    s.life += dt; s.x += s.vx*dt; s.y += s.vy*dt;
    for(const e of enemies){
      if(!e.alive || s.hitSet.has(e)) continue;
      if(dist(s.x,s.y,e.x,e.y) > e.r + SWORD_R) continue;
      s.hitSet.add(e);
      if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
      if(e.key === "guardian") addText(e.x, e.y-e.r-10, "약점!", "#E8B84B", 19);
      killEnemy(e, true);
    }
  }
  swords = swords.filter(s => s.life < SWORD_LIFE && s.x>-40 && s.x<W+40 && s.y>-40 && s.y<H+40);
}
function drawSwords(){
  for(const s of swords){
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.a);
    ctx.fillStyle = "#E8B84B";
    ctx.shadowColor = "rgba(232,184,75,.85)"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-6,5); ctx.lineTo(-6,-5); ctx.closePath(); ctx.fill();
    ctx.fillRect(-10,-2,6,4);
    ctx.restore(); ctx.shadowBlur = 0;
  }
}

function galeLine(){
  const y = player.y;
  shake = Math.max(shake, 14); flash = Math.max(flash, .5);
  sfx.ult();
  slashes.push({x:0, y, a:0, len:W, life:0, dur:.35, ult:true});
  for(const e of enemies){
    if(!e.alive || Math.abs(e.y - y) > GALE_LINE_THICK + e.r) continue;
    if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
    if(e.key === "guardian") addText(e.x, e.y-e.r-10, "약점!", "#E8B84B", 19);
    killEnemy(e, true, true);
  }
}
function galeNuke(){
  shake = Math.max(shake, 20); flash = Math.max(flash, .7);
  sfx.ult(); sfx.boom();
  for(const e of enemies){
    if(!e.alive) continue;
    if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
    if(e.key === "guardian" && !e.guardDisarmed){
      e.guardDisarmed = true; e.stagger = GALE_GUARD_STUN;
      addText(e.x, e.y-e.r-10, "파방!", "#E8B84B", 20);
      burst(e.x, e.y, "#35A88F", 12, 260);
      continue;
    }
    killEnemy(e, true, true);
  }
}
