"use strict";
// 신규 적 상호작용 — 저격수 탄환 · 회복충 드롭의 생성/이동/충돌/그리기.

function fireBullet(e){
  const a = Math.atan2(player.y-e.y, player.x-e.x);
  bullets.push({x:e.x, y:e.y, vx:Math.cos(a)*BULLET_SPEED, vy:Math.sin(a)*BULLET_SPEED, life:0, dur:1.8, curve:e.evoStage===1, mark:e.evoStage===5});
  sfx.shot();
}
function fireBulletSpread(e, n, spread, knockback){
  const base = Math.atan2(player.y-e.y, player.x-e.x);
  for(let i=0;i<n;i++){
    const a = base + (i-(n-1)/2)*(spread/(n-1));
    bullets.push({x:e.x, y:e.y, vx:Math.cos(a)*BULLET_SPEED, vy:Math.sin(a)*BULLET_SPEED, life:0, dur:1.8, curve:false, knockback:!!knockback});
  }
  sfx.shot();
}
/** 산탄총 5단계 전방위탄 — 사방으로 고르게 n발 발사 */
function fireBulletRing(e, n){
  for(let i=0;i<n;i++){
    const a = i/n*6.283;
    bullets.push({x:e.x, y:e.y, vx:Math.cos(a)*BULLET_SPEED, vy:Math.sin(a)*BULLET_SPEED, life:0, dur:1.8, curve:false});
  }
  sfx.shot();
}
function dropHeal(x,y){
  heals.push({x, y, life:0, dur:HEAL_LIFE, wob:rnd(0,6.28)});
}
/** pos: 가로 빔이면 y좌표, 세로 빔이면 x좌표. vertical로 구분한다. thick 생략 시 기본 두께. */
function fireBeam(pos, vertical, thick){
  beams.push({pos, vertical: !!vertical, thick: thick || CHARGER_BEAM_THICK, life:0, dur:CHARGER_BEAM_DUR});
}

/** filterFn을 통과하는 탄환이 첫 번째로 닿은 적에게 onHit을 적용하고 그 탄환을 소모한다(탄환 1개당 1적만). */
function bulletHitsEnemy(filterFn, onHit){
  for(const b of bullets){
    if(!filterFn(b) || b.life >= b.dur) continue;
    for(const o of enemies){
      if(!o.alive || dist(b.x,b.y,o.x,o.y) >= o.r + BULLET_R) continue;
      b.life = b.dur;
      onHit(b, o);
      break;
    }
  }
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
  bulletHitsEnemy(b=>b.reflected, (b,o)=>{
    addText(o.x, o.y-o.r-10, "자멸", "#E8B84B", 19);
    if(o.key === "boss") hitBoss(o, BOSS_HIT_DMG); else killEnemy(o, true);
  });
  // 폭탄충 파편탄: 플레이어에겐 무해하지만 다른 적에게 맞으면 처치 판정
  bulletHitsEnemy(b=>b.shrapnel, (b,o)=>{ if(o.key !== "boss") hitOrKill(o, true, false, undefined); });
  if(player.invuln <= 0){
    for(const b of bullets){
      const hitR = (player.dashing ? PLAYER_R*DASH_BULLET_R_MULT : PLAYER_R) + BULLET_R;
      if(b.reflected || b.noPlayerHit || b.life >= b.dur || dist(b.x,b.y,player.x,player.y) >= hitR) continue;
      if(player.dashing && Math.random() < DASH_PARRY_CHANCE){
        b.vx = -b.vx; b.vy = -b.vy; b.reflected = true;
        addText(player.x, player.y-40, "패링!", "#8B5FBF", 20);
        burst(player.x, player.y, "#8B5FBF", 8, 220);
        sfx.block();
      } else {
        b.life = b.dur;
        const bonus = b.mark && player.marked > 0;
        if(bonus) player.marked = 0; else if(b.mark) player.marked = EVO_GUNNER_MARK_DUR;
        damagePlayer();
        if(bonus){
          player.hp = Math.max(0, player.hp-1);
          addText(player.x, player.y-56, "약점 노출! -1", "#E0453A", 18);
          if(player.hp <= 0 && mode !== "training") gameOver("체력 소진"); // 훈련장에서는 죽지 않는다
        } else if(b.mark) addText(player.x, player.y-56, "표식!", "#8B5FBF", 16);
        if(b.knockback){
          const kbA = Math.atan2(b.vy,b.vx);
          player.x = clamp(player.x+Math.cos(kbA)*EVO_SHOTGUN_KNOCKBACK, 14, W-14);
          player.y = clamp(player.y+Math.sin(kbA)*EVO_SHOTGUN_KNOCKBACK, 14, H-14);
        }
      }
      break; // 한 프레임에 한 발만 적용
    }
  }
  bullets = bullets.filter(b => b.life < b.dur && b.x > -40 && b.x < W+40 && b.y > -40 && b.y < H+40);
  if(state !== "play") return false;

  // 회복 아이템: 접촉 시 체력 +1, 풀피면 오버힐(노란 칸)로 흡수
  for(const h of heals){ h.life += dt; h.wob += dt*3; }
  for(const h of heals){
    if(h.life < h.dur && dist(h.x,h.y,player.x,player.y) < HEAL_R + PLAYER_R){
      h.life = h.dur;
      if(player.hp < MAX_HP){
        player.hp = Math.min(MAX_HP, player.hp+1);
        addText(player.x, player.y-40, "+1 회복", "#8ED08B", 20);
      } else {
        player.overheal = Math.min(1, player.overheal+1);
        addText(player.x, player.y-40, "+1 오버힐", "#E8B84B", 20);
      }
      burst(h.x, h.y, "#8ED08B", 12, 260);
      sfx.heal();
      syncHud();
    }
  }
  heals = heals.filter(h => h.life < h.dur);

  // 충전병 빔: 두께 범위 안이면 지속 피해(무적시간이 연타 방지)
  for(const b of beams){
    b.life += dt;
    const hit = b.vertical ? Math.abs(player.x-b.pos) < b.thick/2 + PLAYER_R
                            : Math.abs(player.y-b.pos) < b.thick/2 + PLAYER_R;
    if(player.invuln <= 0 && hit) damagePlayer();
  }
  beams = beams.filter(b => b.life < b.dur);

  // 먹덩이 2단계: 산성웅덩이 — 범위 안이면 주기적으로 피해(생성 직후엔 유예시간)
  for(const p of acidPools){
    p.life += dt; if(p.hitCd > 0) p.hitCd -= dt;
    if(p.hitCd <= 0 && player.invuln <= 0 && dist(p.x,p.y,player.x,player.y) < p.r + PLAYER_R){
      damagePlayer(); p.hitCd = EVO_SLIME_ACID_TICK;
    }
  }
  acidPools = acidPools.filter(p => p.life < p.dur);

  // 먹덩이 4단계: 슬로우 트레일 — 범위 안이면 이동속도 저하 유지
  for(const s of slowTrails) s.life += dt;
  if(slowTrails.some(s => s.life < s.dur && dist(s.x,s.y,player.x,player.y) < s.r + PLAYER_R)) playerSlow = .2;
  else playerSlow = Math.max(0, playerSlow - dt);
  slowTrails = slowTrails.filter(s => s.life < s.dur);

  // 방패병 3단계: 임시 이동벽 — 닿으면 밀어낸다(피해 없음)
  for(const w of guardWalls){
    w.life += dt;
    if(w.life < w.dur){
      const d = segDist(w.x1,w.y1,w.x2,w.y2,player.x,player.y);
      if(d < PLAYER_R+6 && player.invuln <= 0){
        const nx = player.x-(w.x1+w.x2)/2, ny = player.y-(w.y1+w.y2)/2, nl = Math.hypot(nx,ny)||1;
        player.x = clamp(player.x + nx/nl*10, 14, W-14);
        player.y = clamp(player.y + ny/nl*10, 14, H-14);
      }
    }
  }
  guardWalls = guardWalls.filter(w => w.life < w.dur);

  // 폭탄충 4/5단계: 지연 폭발(예고 후 실제 폭발은 explode()가 처리)
  for(const b of delayedBlasts){
    b.t -= dt;
    if(b.t <= 0 && !b.done){ b.done = true; explode(b.x, b.y, b.radius, 0); }
  }
  delayedBlasts = delayedBlasts.filter(b => !b.done);

  return true;
}

function drawHazards(){
  // 탄환
  for(const b of bullets){
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = b.shrapnel ? "#F5D400" : b.reflected ? "#E8B84B" : "#8B5FBF";
    ctx.shadowColor = b.shrapnel ? "rgba(245,212,0,.85)" : b.reflected ? "rgba(232,184,75,.85)" : "rgba(139,95,191,.85)"; ctx.shadowBlur = 10;
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
    if(b.vertical) ctx.fillRect(b.pos-b.thick/2, 0, b.thick, H);
    else ctx.fillRect(0, b.pos-b.thick/2, W, b.thick);
    ctx.strokeStyle = "#FF5A46"; ctx.lineWidth = 3;
    ctx.beginPath();
    if(b.vertical){ ctx.moveTo(b.pos,0); ctx.lineTo(b.pos,H); } else { ctx.moveTo(0,b.pos); ctx.lineTo(W,b.pos); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 먹덩이 2단계: 산성웅덩이
  for(const p of acidPools){
    const k = 1 - p.life/p.dur;
    ctx.globalAlpha = .55*k;
    ctx.fillStyle = "#8ED08B";
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 먹덩이 4단계: 슬로우 트레일
  for(const s of slowTrails){
    const k = 1 - s.life/s.dur;
    ctx.globalAlpha = .4*k;
    ctx.fillStyle = "#7C8AA8";
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 방패병 3단계: 임시 이동벽
  for(const w of guardWalls){
    const k = 1 - w.life/w.dur;
    ctx.globalAlpha = .8*k; ctx.strokeStyle = "#35A88F"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 폭탄충 5단계: 폭발 예고 링
  for(const b of delayedBlasts){
    if(!b.big || b.done) continue;
    const k = 1 - Math.max(0,b.t)/b.dur;
    const pulse = .5 + .4*Math.sin(b.t*24);
    ctx.strokeStyle = "rgba(224,69,58,"+pulse.toFixed(2)+")"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.radius*k,0,6.283); ctx.stroke();
  }
}
