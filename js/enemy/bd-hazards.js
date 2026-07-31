"use strict";
// 신규 적 상호작용 — 저격수 탄환 · 회복충 드롭의 생성/이동/충돌/그리기.

function fireBullet(e){
  const a = Math.atan2(player.y-e.y, player.x-e.x);
  bullets.push({x:e.x, y:e.y, vx:Math.cos(a)*BULLET_SPEED, vy:Math.sin(a)*BULLET_SPEED, life:0, dur:1.8, curve:e.evo});
  sfx.shot();
}
function fireBulletSpread(e, n, spread){
  const base = Math.atan2(player.y-e.y, player.x-e.x);
  for(let i=0;i<n;i++){
    const a = base + (i-(n-1)/2)*(spread/(n-1));
    bullets.push({x:e.x, y:e.y, vx:Math.cos(a)*BULLET_SPEED, vy:Math.sin(a)*BULLET_SPEED, life:0, dur:1.8, curve:false});
  }
  sfx.shot();
}
function dropHeal(x,y){
  heals.push({x, y, life:0, dur:HEAL_LIFE, wob:rnd(0,6.28)});
}
function fireBeam(y){
  beams.push({y, life:0, dur:CHARGER_BEAM_DUR});
}

/** true를 반환하면 계속 진행, false면 이번 프레임에 라운드가 끝났다는 뜻(update()가 즉시 return해야 함). */
function updateHazards(dt){
  // 탄환: 이동 + 피격 판정
  for(const b of bullets){
    if(b.curve && !b.reflected){
      const cur = Math.atan2(b.vy,b.vx), tgt = Math.atan2(player.y-b.y, player.x-b.x);
      const na = cur + clamp(angDiff(tgt,cur), -EVO_GUNNER_TURN*dt, EVO_GUNNER_TURN*dt);
      const sp = Math.hypot(b.vx,b.vy);
      b.vx = Math.cos(na)*sp; b.vy = Math.sin(na)*sp;
    }
    b.life += dt; b.x += b.vx*dt; b.y += b.vy*dt;
  }
  // 반사된 탄환(이전 프레임에 반사됨): 적 피격 판정 — 반사 판정보다 먼저 처리해 반사 즉시 소모되지 않게 한다
  for(const b of bullets){
    if(!b.reflected || b.life >= b.dur) continue;
    for(const o of enemies){
      if(!o.alive || dist(b.x,b.y,o.x,o.y) >= o.r + BULLET_R) continue;
      b.life = b.dur;
      addText(o.x, o.y-o.r-10, "자멸", "#E8B84B", 19);
      if(o.key === "boss") hitBoss(o, BOSS_HIT_DMG); else killEnemy(o, true);
      break;
    }
  }
  if(player.invuln <= 0){
    for(const b of bullets){
      const hitR = (player.dashing ? PLAYER_R*DASH_BULLET_R_MULT : PLAYER_R) + BULLET_R;
      if(b.reflected || b.life >= b.dur || dist(b.x,b.y,player.x,player.y) >= hitR) continue;
      if(player.dashing && Math.random() < DASH_PARRY_CHANCE){
        b.vx = -b.vx; b.vy = -b.vy; b.reflected = true;
        addText(player.x, player.y-40, "패링!", "#8B5FBF", 20);
        burst(player.x, player.y, "#8B5FBF", 8, 220);
        sfx.block();
      } else {
        b.life = b.dur;
        damagePlayer();
      }
      break; // 한 프레임에 한 발만 적용
    }
  }
  bullets = bullets.filter(b => b.life < b.dur && b.x > -40 && b.x < W+40 && b.y > -40 && b.y < H+40);
  if(state !== "play") return false;

  // 회복 아이템: 접촉 시 체력 +1
  for(const h of heals){ h.life += dt; h.wob += dt*3; }
  for(const h of heals){
    if(h.life < h.dur && player.hp < MAX_HP && dist(h.x,h.y,player.x,player.y) < HEAL_R + PLAYER_R){
      h.life = h.dur;
      player.hp = Math.min(MAX_HP, player.hp+1);
      addText(player.x, player.y-40, "+1 회복", "#8ED08B", 20);
      burst(h.x, h.y, "#8ED08B", 12, 260);
      sfx.heal();
      syncHud();
    }
  }
  heals = heals.filter(h => h.life < h.dur);

  // 충전병 빔: 두께 범위 안이면 지속 피해(무적시간이 연타 방지)
  for(const b of beams){
    b.life += dt;
    if(player.invuln <= 0 && Math.abs(player.y-b.y) < CHARGER_BEAM_THICK/2 + PLAYER_R) damagePlayer();
  }
  beams = beams.filter(b => b.life < b.dur);
  return true;
}

function drawHazards(){
  // 탄환
  for(const b of bullets){
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = b.reflected ? "#E8B84B" : "#8B5FBF";
    ctx.shadowColor = b.reflected ? "rgba(232,184,75,.85)" : "rgba(139,95,191,.85)"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(0,0, BULLET_R*1.6, BULLET_R*.7, 0, 0, 6.283); ctx.fill();
    ctx.restore(); ctx.shadowBlur = 0;
  }

  // 회복 아이템
  for(const h of heals){
    const k = 1 - h.life/h.dur, bob = Math.sin(h.wob)*3;
    ctx.save(); ctx.translate(h.x, h.y+bob);
    ctx.globalAlpha = Math.min(1, k*2);
    ctx.fillStyle = "#8ED08B";
    ctx.shadowColor = "rgba(142,208,139,.8)"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0,0, HEAL_R*.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#0B0C12";
    ctx.fillRect(-1.6, -HEAL_R*.32, 3.2, HEAL_R*.64);
    ctx.fillRect(-HEAL_R*.32, -1.6, HEAL_R*.64, 3.2);
    ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // 충전병 빔
  for(const b of beams){
    const fade = Math.min(1, b.life/0.15);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(255,90,70,.35)";
    ctx.fillRect(0, b.y-CHARGER_BEAM_THICK/2, W, CHARGER_BEAM_THICK);
    ctx.strokeStyle = "#FF5A46"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0,b.y); ctx.lineTo(W,b.y); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
