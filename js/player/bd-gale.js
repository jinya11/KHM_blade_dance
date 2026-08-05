"use strict";
// 질풍참(우클릭) 효과 — 1스택 검 투사체, 2/3스택은 이동 없이 즉시 발동하는 광역 공격.
const GALE_LINE_THICK = 46;   // 2스택 가로줄 공격 두께
const GALE_GUARD_STUN  = 0.5; // 3스택에 맞은 방패병이 기절하는 시간

/** 짙은 청색 '바람' 줄기 하나 생성 — 곡선으로 휘어지며 흐르다 사라진다. */
function spawnWind(x,y,a,len,dur){
  winds.push({x,y,a,len,life:0,dur});
}

/** 1스택: 바라보는 방향 기준 부채꼴로 검 투사체 5발 발사(적을 관통). */
function galeSwords(){
  shake = Math.max(shake, 10); flash = Math.max(flash, .4);
  addText(player.x, player.y-40, "질풍참 - 검식", "#E8B84B", 22);
  sfx.ult();
  for(let i=0;i<SWORD_COUNT;i++){
    const a = player.facing + (i-(SWORD_COUNT-1)/2) * (SWORD_SPREAD/(SWORD_COUNT-1));
    swords.push({x:player.x, y:player.y, a, vx:Math.cos(a)*SWORD_SPEED, vy:Math.sin(a)*SWORD_SPEED, life:0, hitSet:new Set()});
    spawnWind(player.x, player.y, a, rnd(70,100), rnd(.35,.45));
  }
}
function updateSwords(dt){
  for(const s of swords){
    s.life += dt; s.x += s.vx*dt; s.y += s.vy*dt;
    for(const e of enemies){
      if(!e.alive || s.hitSet.has(e) || e.hidden) continue;
      if(dist(s.x,s.y,e.x,e.y) > e.r + SWORD_R) continue;
      s.hitSet.add(e);
      if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
      if(e.key === "guardian") addText(e.x, e.y-e.r-10, "약점!", "#E8B84B", 19);
      hitOrKill(e, true, false, "gale", 2);
    }
  }
  swords = swords.filter(s => s.life < SWORD_LIFE && s.x>-40 && s.x<W+40 && s.y>-40 && s.y<H+40);
}
function drawSwords(){
  for(const s of swords){
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.a);
    ctx.fillStyle = "#2F86D6";
    ctx.shadowColor = "rgba(79,195,247,.85)"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-6,5); ctx.lineTo(-6,-5); ctx.closePath(); ctx.fill();
    ctx.fillRect(-10,-2,6,4);
    ctx.restore(); ctx.shadowBlur = 0;
  }
}

function galeLine(){
  const y = player.y;
  shake = Math.max(shake, 14); flash = Math.max(flash, .5);
  addText(player.x, player.y-40, "질풍참 - 참식", "#E8B84B", 22);
  sfx.ult();
  slashes.push({x:0, y, a:0, len:W, life:0, dur:.35, ult:true});
  for(let i=0;i<12;i++){
    spawnWind(rnd(0,W), y+rnd(-16,16), Math.random()<.5?0:Math.PI, rnd(140,220), rnd(.4,.5));
  }
  hitAreaSimple(e => Math.abs(e.y - y) <= GALE_LINE_THICK + e.r, "gale");
}
function galeNuke(){
  shake = Math.max(shake, 20); flash = Math.max(flash, .7);
  addText(player.x, player.y-40, "질풍참 - 멸식", "#E8B84B", 22);
  sfx.ult(); sfx.boom();
  for(let i=0;i<28;i++){ // 화면 전체에 바람이 몰아치는 느낌 — 무작위 위치·각도로 뿌린다
    spawnWind(rnd(0,W), rnd(0,H), rnd(0,6.283), rnd(90,220), rnd(.5,.75));
  }
  hitAreaDisarm(()=>true, "gale", true);
}
