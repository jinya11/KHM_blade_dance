"use strict";
// 귀풍참(원형 UI에서 선택) 효과 — 1스택 귀환식(마킹 후 순간이동), 2스택 흡풍식(끌어당김), 3스택 광풍식(밀쳐내기).
const KWI_COLOR = "#39D97A";

/** 1스택: 현재 위치에 마킹, 일정 시간 뒤 그 자리로 순간이동하며 착지 지점을 내려찍는다. */
function kwiRecall(){
  shake = Math.max(shake, 8); flash = Math.max(flash, .35);
  addText(player.x, player.y-40, "귀풍참 - 귀환식", KWI_COLOR, 22);
  sfx.ult();
  recallMark = {x:player.x, y:player.y, t:0};
}
/** 2스택: 시전 지점에 회오리를 만들어 범위 내 적을 중심으로 끌어당긴다. */
function kwiPull(){
  shake = Math.max(shake, 10); flash = Math.max(flash, .4);
  addText(player.x, player.y-40, "귀풍참 - 흡풍식", KWI_COLOR, 22);
  sfx.ult();
  vortices.push({x:player.x, y:player.y, mode:"pull", r:VORTEX_PULL_R, life:0, dur:VORTEX_PULL_DUR});
}
/** 3스택: 거대 돌풍으로 화면 위 모든 적을 밖으로 밀쳐내며 한 번에 처치한다. */
function kwiPush(){
  shake = Math.max(shake, 18); flash = Math.max(flash, .6);
  addText(player.x, player.y-40, "귀풍참 - 광풍식", KWI_COLOR, 22);
  sfx.ult(); sfx.boom();
  vortices.push({x:player.x, y:player.y, mode:"push", r:Math.hypot(W,H), life:0, dur:VORTEX_PUSH_DUR});
  for(const e of enemies){
    if(!e.alive || e.hidden) continue;
    if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
    const a = Math.atan2(e.y-player.y, e.x-player.x);
    e.x += Math.cos(a)*220; e.y += Math.sin(a)*220;
    killEnemy(e, true, true, "kwi");
  }
}
/** 매 프레임: 귀환식 대기 중인 마킹의 순간이동 판정과 회오리들의 흡입/밀쳐내기를 처리한다. */
function updateKwi(dt){
  if(recallMark){
    recallMark.t += dt;
    if(recallMark.t >= RECALL_DELAY){
      player.x = recallMark.x; player.y = recallMark.y;
      shake = Math.max(shake, 14); flash = Math.max(flash, .5);
      burst(player.x, player.y, KWI_COLOR, 16, 300);
      for(const e of enemies){
        if(!e.alive || e.hidden || dist(player.x,player.y,e.x,e.y) > RECALL_SLAM_R + e.r) continue;
        if(e.key === "boss"){ hitBoss(e, BOSS_ULT_DMG); continue; }
        if(e.key === "guardian" && !e.guardDisarmed){
          e.guardDisarmed = true; e.stagger = GALE_GUARD_STUN;
          addText(e.x, e.y-e.r-10, "파방!", "#E8B84B", 20);
          continue;
        }
        killEnemy(e, true, true, "kwi");
      }
      recallMark = null;
    }
  }
  for(const v of vortices){
    v.life += dt;
    if(v.mode !== "pull") continue; // 광풍식은 시전 즉시 처리되므로 회오리는 시각 효과로만 남는다
    for(const e of enemies){
      if(!e.alive || e.hidden || e.key === "boss") continue;
      const d = dist(v.x,v.y,e.x,e.y);
      if(d > v.r) continue;
      if(d < 26){ killEnemy(e, true, true, "kwi"); continue; } // 중심에 도달하면 즉시 처치
      const nx = (e.x-v.x)/d, ny = (e.y-v.y)/d;
      e.x -= nx*VORTEX_PULL_SPEED*dt; e.y -= ny*VORTEX_PULL_SPEED*dt;
    }
  }
  vortices = vortices.filter(v => v.life < v.dur);
}
