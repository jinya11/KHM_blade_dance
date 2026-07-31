"use strict";
// 첫 번째 보스 "묵귀" — 전용 패턴 3종(위치 돌진 / 튕기는 잔상 이동 / 은신 기습).
// 스탯과 패턴 상태머신만 여기 있고, 체력·보상·잔상/벽 판정 같은 공통 부분은 bd-boss.js가 처리한다.
const REAVER_STATS = {r:46, spd:34, hp:24, color:"#8B1E3F", name:"묵귀"};
const REAVER_IDLE_MIN = 2.2, REAVER_IDLE_MAX = 3.6; // 다음 패턴 선택까지 대기

const DASH_TELEGRAPH  = 0.55, DASH_SPEED2 = 1500, DASH_HIT_R = 30;
const BOUNCE_TELEGRAPH = 0.45, BOUNCE_DURATION = 2.2, BOUNCE_SPEED = 900;
const BOUNCE_TRAIL_INTERVAL = 0.08, BOUNCE_TRAIL_R = 30, BOUNCE_TRAIL_LIFE = 1.1;
const HIDE_TELEGRAPH = 0.4;      // 사라지기 전 짧은 예비동작
const HIDE_DURATION = 1.1;       // 숨어서 공격받지 않는 시간
const REAPPEAR_TELEGRAPH = 0.6;  // 재등장 지점 예고 시간
const REAPPEAR_HIT_R = 90;       // 재등장 기습 타격 판정 반경

function reaverStartPattern(e){
  const pick = ["dash","bounce","hide"][Math.floor(Math.random()*3)];
  if(pick === "dash"){
    e.pattern = "dashTelegraph"; e.patternT = DASH_TELEGRAPH;
    e.dashTarget = {x:player.x, y:player.y}; // 지금 있는 곳을 노린다(그 순간 위치로 고정)
  } else if(pick === "bounce"){
    e.pattern = "bounceTelegraph"; e.patternT = BOUNCE_TELEGRAPH;
    const a = rnd(0,6.283);
    e.bounceVX = Math.cos(a)*BOUNCE_SPEED; e.bounceVY = Math.sin(a)*BOUNCE_SPEED;
    e.bounceT = 0; e.trailT = 0;
  } else {
    e.pattern = "hideTelegraph"; e.patternT = HIDE_TELEGRAPH;
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
function reaverHideTelegraph(e, dt){
  e.facing = Math.atan2(player.y-e.y, player.x-e.x);
  e.patternT -= dt;
  if(e.patternT <= 0){
    e.pattern = "hidden"; e.patternT = HIDE_DURATION; e.hidden = true;
  }
}
function reaverHidden(e, dt){
  e.patternT -= dt;
  if(e.patternT <= 0){
    // 플레이어 근처 임의 위치를 재등장 지점으로 선정
    const a = rnd(0,6.283), d = rnd(120,220);
    e.x = clamp(player.x+Math.cos(a)*d, e.r+20, W-e.r-20);
    e.y = clamp(player.y+Math.sin(a)*d, e.r+20, H-e.r-20);
    e.pattern = "reappearTelegraph"; e.patternT = REAPPEAR_TELEGRAPH;
  }
}
function reaverReappearTelegraph(e, dt){
  e.patternT -= dt;
  if(e.patternT <= 0){
    e.hidden = false;
    shake = Math.max(shake, 10); flash = Math.max(flash, .4);
    sfx.boom(); burst(e.x, e.y, e.color, 20, 320);
    if(e.atk <= 0 && dist(e.x,e.y,player.x,player.y) < REAPPEAR_HIT_R){
      if(bossHitPlayer()) e.atk = 1.0;
    }
    e.pattern = "chase"; e.patternT = rnd(REAVER_IDLE_MIN, REAVER_IDLE_MAX);
  }
}
function reaverDraw(e, R){
  if(e.pattern === "hidden") return; // 완전히 숨어 아무것도 그리지 않음
  if(e.pattern === "reappearTelegraph"){
    const pulse = .55 + .4*Math.sin(performance.now()/50);
    ctx.strokeStyle = "rgba(224,69,58,"+pulse.toFixed(2)+")"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0,0,REAPPEAR_HIT_R,0,6.283); ctx.stroke();
    return;
  }
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
      case "hideTelegraph": reaverHideTelegraph(e, dt); break;
      case "hidden": reaverHidden(e, dt); break;
      case "reappearTelegraph": reaverReappearTelegraph(e, dt); break;
    }
  },
  draw: reaverDraw
};
