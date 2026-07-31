"use strict";
// 첫 번째 보스 "묵귀" — 전용 패턴 3종(위치 돌진 / 튕기는 잔상 이동 / 감금).
// 스탯과 패턴 상태머신만 여기 있고, 체력·보상·잔상/벽 판정 같은 공통 부분은 bd-boss.js가 처리한다.
const REAVER_STATS = {r:46, spd:34, hp:24, color:"#8B1E3F", name:"묵귀"};
const REAVER_IDLE_MIN = 2.2, REAVER_IDLE_MAX = 3.6; // 다음 패턴 선택까지 대기

const DASH_TELEGRAPH  = 0.55, DASH_SPEED2 = 1500, DASH_HIT_R = 30;
const BOUNCE_TELEGRAPH = 0.45, BOUNCE_DURATION = 2.2, BOUNCE_SPEED = 900;
const BOUNCE_TRAIL_INTERVAL = 0.08, BOUNCE_TRAIL_R = 30, BOUNCE_TRAIL_LIFE = 1.1;
const CAGE_TELEGRAPH = 0.6, CAGE_HALF = 150, CAGE_WALL_HP = 3;

function reaverStartPattern(e){
  const pick = ["dash","bounce","cage"][Math.floor(Math.random()*3)];
  if(pick === "dash"){
    e.pattern = "dashTelegraph"; e.patternT = DASH_TELEGRAPH;
    e.dashTarget = {x:player.x, y:player.y}; // 지금 있는 곳을 노린다(그 순간 위치로 고정)
  } else if(pick === "bounce"){
    e.pattern = "bounceTelegraph"; e.patternT = BOUNCE_TELEGRAPH;
    const a = rnd(0,6.283);
    e.bounceVX = Math.cos(a)*BOUNCE_SPEED; e.bounceVY = Math.sin(a)*BOUNCE_SPEED;
    e.bounceT = 0; e.trailT = 0;
  } else {
    e.pattern = "cageTelegraph"; e.patternT = CAGE_TELEGRAPH;
    e.cageAt = {x:(e.x+player.x)/2, y:(e.y+player.y)/2};
  }
}
function reaverChase(e, dt){
  const a = Math.atan2(player.y-e.y, player.x-e.x);
  e.facing = a;
  let sp = e.spd; if(e.born < .3) sp *= .25;
  e.x = boundX(e.x + Math.cos(a)*sp*dt);
  e.y = boundY(e.y + Math.sin(a)*sp*dt);
  if(e.atk <= 0 && dist(e.x,e.y,player.x,player.y) < e.r+PLAYER_R+2){
    if(bossHitPlayer()) e.atk = 1.2;
  }
  e.patternT -= dt;
  if(e.patternT <= 0) reaverStartPattern(e);
}
function reaverDashTelegraph(e, dt){
  e.facing = Math.atan2(player.y-e.y, player.x-e.x);
  e.patternT -= dt;
  if(e.patternT <= 0){
    e.pattern = "dashing";
    e.dashFrom = {x:e.x, y:e.y};
    const d = Math.max(1, dist(e.x,e.y,e.dashTarget.x,e.dashTarget.y));
    e.dashDur = clamp(d/DASH_SPEED2, .12, .4);
    e.dashElapsed = 0;
    e.facing = Math.atan2(e.dashTarget.y-e.y, e.dashTarget.x-e.x);
  }
}
function reaverDashing(e, dt){
  e.dashElapsed += dt;
  const p = Math.min(1, e.dashElapsed/e.dashDur), k = 1-(1-p)*(1-p);
  const prevX = e.x, prevY = e.y;
  e.x = e.dashFrom.x + (e.dashTarget.x-e.dashFrom.x)*k;
  e.y = e.dashFrom.y + (e.dashTarget.y-e.dashFrom.y)*k;
  if(e.atk <= 0 && segDist(prevX,prevY,e.x,e.y, player.x,player.y) < DASH_HIT_R+PLAYER_R){
    if(bossHitPlayer()) e.atk = 1.0;
  }
  if(p >= 1){ e.pattern = "chase"; e.patternT = rnd(REAVER_IDLE_MIN, REAVER_IDLE_MAX); }
}
function reaverBounceTelegraph(e, dt){
  e.patternT -= dt;
  if(e.patternT <= 0) e.pattern = "bouncing";
}
function reaverBouncing(e, dt){
  e.bounceT += dt; e.trailT -= dt;
  e.x += e.bounceVX*dt; e.y += e.bounceVY*dt;
  if(e.x < e.r || e.x > W-e.r){ e.bounceVX *= -1; e.x = clamp(e.x, e.r, W-e.r); }
  if(e.y < e.r || e.y > H-e.r){ e.bounceVY *= -1; e.y = clamp(e.y, e.r, H-e.r); }
  e.facing = Math.atan2(e.bounceVY, e.bounceVX);
  if(e.trailT <= 0){
    bossZones.push({kind:"hurt", x:e.x, y:e.y, r:BOUNCE_TRAIL_R, life:0, dur:BOUNCE_TRAIL_LIFE, color:e.color});
    e.trailT = BOUNCE_TRAIL_INTERVAL;
  }
  if(e.atk <= 0 && dist(e.x,e.y,player.x,player.y) < e.r+PLAYER_R){
    if(bossHitPlayer()) e.atk = .6;
  }
  if(e.bounceT >= BOUNCE_DURATION){ e.pattern = "chase"; e.patternT = rnd(REAVER_IDLE_MIN, REAVER_IDLE_MAX); }
}
function reaverCageTelegraph(e, dt){
  e.facing = Math.atan2(player.y-e.y, player.x-e.x);
  e.patternT -= dt;
  if(e.patternT <= 0){
    const cx = clamp(e.cageAt.x, CAGE_HALF+20, W-CAGE_HALF-20);
    const cy = clamp(e.cageAt.y, CAGE_HALF+20, H-CAGE_HALF-20);
    cage = { cx, cy, half: CAGE_HALF, walls: {
      top:    {x1:cx-CAGE_HALF, y1:cy-CAGE_HALF, x2:cx+CAGE_HALF, y2:cy-CAGE_HALF, hp:CAGE_WALL_HP, maxHp:CAGE_WALL_HP},
      bottom: {x1:cx-CAGE_HALF, y1:cy+CAGE_HALF, x2:cx+CAGE_HALF, y2:cy+CAGE_HALF, hp:CAGE_WALL_HP, maxHp:CAGE_WALL_HP},
      left:   {x1:cx-CAGE_HALF, y1:cy-CAGE_HALF, x2:cx-CAGE_HALF, y2:cy+CAGE_HALF, hp:CAGE_WALL_HP, maxHp:CAGE_WALL_HP},
      right:  {x1:cx+CAGE_HALF, y1:cy-CAGE_HALF, x2:cx+CAGE_HALF, y2:cy+CAGE_HALF, hp:CAGE_WALL_HP, maxHp:CAGE_WALL_HP}
    }};
    player.x = boundX(player.x); player.y = boundY(player.y);
    e.x = boundX(e.x); e.y = boundY(e.y);
    e.pattern = "caged";
    sfx.block();
  }
}
function reaverCaged(e, dt){
  const a = Math.atan2(player.y-e.y, player.x-e.x);
  e.facing = a;
  e.x = boundX(e.x + Math.cos(a)*e.spd*1.3*dt);
  e.y = boundY(e.y + Math.sin(a)*e.spd*1.3*dt);
  if(e.atk <= 0 && dist(e.x,e.y,player.x,player.y) < e.r+PLAYER_R+2){
    if(bossHitPlayer()) e.atk = 1.0;
  }
  if(!cage){ e.pattern = "chase"; e.patternT = rnd(REAVER_IDLE_MIN, REAVER_IDLE_MAX); } // 벽이 전부 파괴되어 해제됨
}
function reaverDraw(e, R){
  const telegraphing = e.pattern.indexOf("Telegraph") >= 0;
  ctx.rotate(e.facing);
  ctx.fillStyle = e.color;
  ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
  ctx.strokeStyle = telegraphing ? "rgba(232,184,75,.95)" : "rgba(232,184,75,.5)";
  ctx.lineWidth = telegraphing ? 6 : 3;
  ctx.beginPath(); ctx.arc(0,0,R + (telegraphing ? 8+Math.sin(performance.now()/60)*3 : 6), 0, 6.283); ctx.stroke();
  ctx.fillStyle = "#0B0C12";
  ctx.beginPath(); ctx.arc(R*.3,-R*.15,4.5,0,6.283); ctx.arc(R*.3,R*.15,4.5,0,6.283); ctx.fill();
}

BOSS_TYPES.reaver = {
  stats: REAVER_STATS,
  onSpawn(e){ e.pattern = "chase"; e.patternT = rnd(REAVER_IDLE_MIN, REAVER_IDLE_MAX); },
  update(e, dt){
    switch(e.pattern){
      case "chase": reaverChase(e, dt); break;
      case "dashTelegraph": reaverDashTelegraph(e, dt); break;
      case "dashing": reaverDashing(e, dt); break;
      case "bounceTelegraph": reaverBounceTelegraph(e, dt); break;
      case "bouncing": reaverBouncing(e, dt); break;
      case "cageTelegraph": reaverCageTelegraph(e, dt); break;
      case "caged": reaverCaged(e, dt); break;
    }
  },
  draw: reaverDraw
};
