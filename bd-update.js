"use strict";
// 매 프레임 갱신 — 타이머·대시 이동·적 AI/피격·겹침 해소·파티클 수명 등 게임 로직 전체가 여기 한 함수(update)에 모여 있다.
function update(dt){
  t += dt;
  if(mode === "normal"){
    timeLeft -= dt;
    if(timeLeft <= 0){ timeLeft = 0; gameOver("시간 종료"); return; }
  } else if(mode === "infinite" && !bossActive){
    bossTimer -= dt;
    if(bossTimer <= 0) spawnBoss();
  }

  shake = Math.max(0, shake - dt*34);
  flash = Math.max(0, flash - dt*2.4);
  if(player.invuln > 0) player.invuln -= dt;
  if(player.cd > 0) player.cd = Math.max(0, player.cd - dt);
  if(player.quickRecover > 0) player.quickRecover = Math.max(0, player.quickRecover - dt);
  if(staminaLock > 0){
    staminaLock = Math.max(0, staminaLock - dt);
    if(staminaLock <= 0){ stamina = MAX_STAMINA*STAMINA_LOCK_RECOVER; evadeStreak = 0; syncHud(); }
  }
  // 정지 상태(대시 중이 아님) 유지 시 기력 자동 회복
  if(player.dashing) idleTime = 0;
  else{
    idleTime += dt;
    if(staminaLock <= 0 && idleTime > STAMINA_IDLE_DELAY && stamina < MAX_STAMINA){
      stamina = Math.min(MAX_STAMINA, stamina + STAMINA_REGEN_PER_SEC*dt);
      syncHud();
    }
  }

  // 연격 유지 타이머 (돌진 중에는 멈춤)
  if(combo > 0 && !player.dashing){
    comboTimer -= dt;
    if(comboTimer <= 0){
      if(combo >= 5) addText(player.x, player.y-46, combo+" 연격 종료", "#9C947F", 15);
      combo = 0; syncHud();
    }
  }

  // 스폰 (보스전 중에는 다른 몬스터를 스폰하지 않는다)
  if(!bossActive){
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      spawnTimer = spawnInterval() * rnd(.8,1.2);
      if(enemies.length < maxEnemies()) spawn();
      if(t > 45 && Math.random() < .24 && enemies.length < maxEnemies()) spawn();
    }
  }

  // 돌진
  if(player.dashing){
    const prevX = player.x, prevY = player.y;
    player.t += dt;
    const p = Math.min(1, player.t/player.dur);
    const e = 1 - (1-p)*(1-p);
    player.x = player.fx + (player.tx-player.fx)*e;
    player.y = player.fy + (player.ty-player.fy)*e;
    trail.push({x:player.x, y:player.y, life:0, ult:player.ult});
    if(!dashHits(prevX, prevY, player.x, player.y) && p >= 1) endDash(false);
  }

  // 적 행동
  for(const e of enemies){
    if(!e.alive) continue;
    e.born += dt;
    if(e.stagger > 0) e.stagger -= dt;
    if(e.atk > 0) e.atk -= dt;

    if(e.key === "boss"){
      const type = BOSS_TYPES[e.type];
      if(type && type.update) type.update(e, dt);
      continue; // 보스는 전용 패턴이 이동·피격까지 전부 처리한다
    }

    const a = Math.atan2(player.y-e.y, player.x-e.x);
    if(e.key === "guardian"){
      const turn = (e.stagger>0 ? .35 : GUARD_TURN) * dt;
      const d = angDiff(a, e.facing);
      e.facing += clamp(d, -turn, turn);
    } else e.facing = a;

    let sp = e.spd * (e.stagger>0 ? .25 : 1);
    if(e.born < .3) sp *= .25;
    if(e.key === "gunner" && dist(player.x,player.y,e.x,e.y) < GUNNER_RANGE*.55) sp = 0; // 사거리 안이면 멈춰서 사격
    e.wob += dt*4;
    const wob = e.key==="swift" ? Math.sin(e.wob)*.5 : 0;
    e.x += Math.cos(a+wob)*sp*dt + e.kx*e.kb*dt;
    e.y += Math.sin(a+wob)*sp*dt + e.ky*e.kb*dt;
    e.kb = Math.max(0, e.kb - dt*900);
    e.x = clamp(e.x, -40, W+40); e.y = clamp(e.y, -40, H+40);

    // 저격수: 사거리 안이면 주기적으로 직선 탄환 발사
    if(e.key === "gunner"){
      e.shotCd -= dt;
      if(e.shotCd <= 0 && dist(player.x,player.y,e.x,e.y) <= GUNNER_RANGE){
        fireBullet(e);
        e.shotCd = GUNNER_COOLDOWN * rnd(.85,1.15);
      }
    }
    // 플레이어 피격(접촉)
    if(!player.dashing && player.invuln <= 0 && e.atk <= 0 &&
        dist(e.x,e.y,player.x,player.y) < e.r + PLAYER_R + 2){
      e.atk = 1.9;
      damagePlayer();
      if(player.hp <= 0) return;
    }
  }
  // 적끼리 겹침 완화
  for(let i=0;i<enemies.length;i++){
    const A = enemies[i]; if(!A.alive) continue;
    for(let j=i+1;j<enemies.length;j++){
      const B = enemies[j]; if(!B.alive) continue;
      const d = dist(A.x,A.y,B.x,B.y), min = A.r+B.r;
      if(d < min && d > .01){
        const push = (min-d)/2, nx=(B.x-A.x)/d, ny=(B.y-A.y)/d;
        A.x -= nx*push; A.y -= ny*push; B.x += nx*push; B.y += ny*push;
      }
    }
  }
  enemies = enemies.filter(e=>e.alive);

  if(!updateBossExtras(dt)) return;
  if(!updateHazards(dt)) return;
  updateSwords(dt);

  // 파티클 / 텍스트 / 궤적
  for(const p of parts){
    p.life += dt;
    if(!p.ring){ p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= .93; p.vy *= .93; }
  }
  parts = parts.filter(p=>p.life < p.dur);
  for(const s of slashes) s.life += dt;
  slashes = slashes.filter(s=>s.life < s.dur);
  for(const x of texts){ x.life += dt; x.y -= dt*26; }
  texts = texts.filter(x=>x.life < x.dur);
  for(const p of trail) p.life += dt;
  trail = trail.filter(p=>p.life < .28);

  syncTimer();
}
