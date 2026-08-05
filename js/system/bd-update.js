"use strict";
// 매 프레임 갱신 — 타이머·대시 이동·적 AI/피격·겹침 해소·파티클 수명 등 게임 로직 전체가 여기 한 함수(update)에 모여 있다.
function update(dt){
  const realDt = dt;
  if(skillSwapCd > 0) skillSwapCd = Math.max(0, skillSwapCd - realDt);
  if(wheelUiOpen){
    wheelUiTimer -= realDt;
    if(wheelUiTimer <= 0) wheelUiOpen = false;
    dt *= WHEEL_UI_SLOWMO; // 원형 UI가 떠 있는 동안 게임 진행 속도 감소
  }
  updateKwi(dt);
  t += dt;
  if(mode === "normal"){
    timeLeft -= dt;
    if(timeLeft <= 0){ timeLeft = 0; gameOver("시간 종료"); return; }
  } else if(mode === "infinite"){
    evoTimer -= dt;
    if(evoTimer <= 0){
      advanceEvolution();
      evoTimer = rnd(EVO_TIME_MIN, EVO_TIME_MAX);
    }
  }

  if(chargerCd > 0) chargerCd = Math.max(0, chargerCd - dt);
  shake = Math.max(0, shake - dt*34);
  flash = Math.max(0, flash - dt*2.4);
  if(player.invuln > 0) player.invuln -= dt;
  if(player.cd > 0) player.cd = Math.max(0, player.cd - dt);
  if(player.quickRecover > 0) player.quickRecover = Math.max(0, player.quickRecover - dt);
  if(player.marked > 0) player.marked = Math.max(0, player.marked - dt);
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

  // 마우스 추적 이동 — 대시 중이 아니고 기력 잠금·방패 피격 경직이 아니며 원형 UI가 닫혀 있을 때만 커서 방향으로 저속 이동
  // (훈련장에서는 소환 패널 위에 마우스가 있으면 캐릭터가 그쪽으로 딸려가지 않도록 이동을 막는다)
  const blocked = player.cd > 0 && player.cdTotal > DASH_CD;
  const overTrainingUi = mode === "training" && isOverTrainingPanel(mouseX, mouseY);
  if(!player.dashing && staminaLock <= 0 && !blocked && !wheelUiOpen && !overTrainingUi){
    const d = dist(player.x, player.y, mouseX, mouseY);
    if(d > 2){
      const spd = playerSlow > 0 ? FOLLOW_SPEED*.45 : FOLLOW_SPEED;
      const k = Math.min(1, spd*dt/d);
      player.x = clamp(player.x + (mouseX-player.x)*k, PLAYER_R, W-PLAYER_R);
      player.y = clamp(player.y + (mouseY-player.y)*k, PLAYER_R, H-PLAYER_R);
      player.facing = Math.atan2(mouseY-player.y, mouseX-player.x);
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

  // 스폰 (보스전·훈련장 중에는 다른 몬스터를 스폰하지 않는다)
  if(!bossActive && mode !== "training"){
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

    // 폭탄충 3단계: 유도판 — 처치가 확정되면 플레이어 쪽으로 짧게 돌진한 뒤 그 자리에서 터진다(killEnemy가 트리거)
    if(e.key === "bomber" && e.lunging){
      e.lungeT += dt;
      e.x += e.lungeVx*dt; e.y += e.lungeVy*dt;
      if(e.lungeT >= EVO_BOMBER_LUNGE_TIME) killEnemy(e, true);
      continue;
    }
    if(e.hitFlash > 0) e.hitFlash -= dt;

    // 진화: 먹덩이 1/4단계 — 확률적으로 사거리 안에서 짧게 고속 돌진(4단계는 슬로우 트레일 동반)
    if(e.key === "slime" && (e.evoStage===1 || e.evoStage===4)){
      if(e.charging){
        e.chargeCd -= dt;
        if(e.evoStage===4){
          e.trailCd = (e.trailCd||0) - dt;
          if(e.trailCd <= 0){ slowTrails.push({x:e.x,y:e.y,r:EVO_SLIME_SLOW_R,life:0,dur:EVO_SLIME_SLOW_DUR}); e.trailCd = .12; }
        }
        if(e.chargeCd <= 0){ e.charging = false; e.chargeCd = EVO_SLIME_INTERVAL*rnd(.8,1.2); }
      } else {
        e.chargeCd -= dt;
        if(e.chargeCd <= 0){
          if(dist(player.x,player.y,e.x,e.y) < EVO_SLIME_RANGE && Math.random() < EVO_SLIME_CHANCE){
            e.charging = true; e.chargeA = a; e.chargeCd = EVO_SLIME_DUR;
          } else e.chargeCd = EVO_SLIME_INTERVAL*rnd(.8,1.2);
        }
      }
    }
    // 진화: 먹덩이 5단계 — 주기적으로 주변 기본개체를 흡수해 체력을 회복한다
    if(e.key === "slime" && e.evoStage === 5){
      e.acidCd -= dt;
      if(e.acidCd <= 0){
        e.acidCd = EVO_SLIME_ABSORB_CD;
        let target = null, bd = EVO_SLIME_ABSORB_RANGE;
        for(const o of enemies){
          if(!o.alive || o===e || o.evoStage>0 || o.key==="boss") continue;
          const d = dist(e.x,e.y,o.x,o.y);
          if(d < bd){ bd = d; target = o; }
        }
        if(target && e.hp < e.maxHp){
          target.alive = false; e.hp = Math.min(e.maxHp, e.hp+1);
          burst(target.x, target.y, e.color, 10, 220);
          addText(e.x, e.y-e.r-14, "흡수", "#7C8AA8", 16);
        }
      }
    }
    // 진화: 방패병 1/4단계 — 사거리 안이면 예비동작 후 내려찍기(4단계는 직후 회전베기 추가). 파방(방패 소실) 상태에서는 사용 불가
    if(e.key === "guardian" && (e.evoStage===1 || e.evoStage===4) && !e.guardDisarmed){
      if(e.slamWind > 0){
        e.slamWind -= dt;
        if(e.slamWind <= 0){
          e.slamWind = 0;
          if(!player.dashing && player.invuln <= 0 && dist(player.x,player.y,e.x,e.y) < e.r+PLAYER_R+EVO_GUARDIAN_RANGE) damagePlayer();
          if(e.evoStage === 4){ e.spinT = .3; addText(e.x, e.y-e.r-10, "회전베기!", "#E0453A", 18); }
          e.slamCd = EVO_GUARDIAN_CD;
        }
      } else if(e.spinT > 0){
        e.spinT -= dt;
        if(!player.dashing && player.invuln <= 0 && dist(player.x,player.y,e.x,e.y) < e.r+PLAYER_R+EVO_GUARDIAN_SPIN_R){
          damagePlayer(); e.spinT = 0;
        }
      } else {
        e.slamCd -= dt;
        if(e.slamCd <= 0 && dist(player.x,player.y,e.x,e.y) < e.r+PLAYER_R+EVO_GUARDIAN_RANGE){
          e.slamWind = EVO_GUARDIAN_WIND;
          addText(e.x, e.y-e.r-10, "내려찍기!", "#E0453A", 18);
        }
      }
    }
    // 진화: 방패병 3단계 — 플레이어와의 사이에 임시 이동벽 생성. 파방 상태에서는 사용 불가
    if(e.key === "guardian" && e.evoStage === 3 && !e.guardDisarmed){
      e.wallCd -= dt;
      if(e.wallCd <= 0 && dist(player.x,player.y,e.x,e.y) < 300){
        e.wallCd = EVO_GUARDIAN_WALL_CD;
        const perp = a + Math.PI/2, hl = EVO_GUARDIAN_WALL_LEN/2;
        const mx = (e.x+player.x)/2, my = (e.y+player.y)/2;
        guardWalls.push({x1:mx+Math.cos(perp)*hl, y1:my+Math.sin(perp)*hl, x2:mx-Math.cos(perp)*hl, y2:my-Math.sin(perp)*hl, life:0, dur:EVO_GUARDIAN_WALL_DUR});
        addText(e.x, e.y-e.r-10, "차단선!", "#35A88F", 18);
      }
    }
    // 충전병 — 화면에 보이면 충전 시작, 충전 완료 시 빔 발사(계속 반복, 처치 전까지 정지)
    if(e.key === "charger"){
      const onScreen = e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H;
      const chargeTime = e.evoStage === 4 ? CHARGER_CHARGE_TIME*EVO_CHARGER_FAST_CHARGE_MULT : CHARGER_CHARGE_TIME;
      if(!e.chargerState){
        if(onScreen){ e.chargerState = "charge"; e.chargerT = chargeTime; e.trackY = e.y; }
      } else if(e.chargerState === "charge"){
        if(e.evoStage === 3) e.trackY += clamp(player.y-e.trackY, -EVO_CHARGER_TRACK_SPEED*dt, EVO_CHARGER_TRACK_SPEED*dt);
        e.chargerT -= dt;
        if(e.chargerT <= 0){
          e.chargerState = "fire"; e.chargerT = CHARGER_BEAM_DUR;
          if(e.evoStage === 2){ fireBeam(e.y, false); fireBeam(e.x, true); }
          else if(e.evoStage === 3) fireBeam(e.trackY, false);
          else if(e.evoStage === 4){ fireBeam(e.y-EVO_CHARGER_DUAL_GAP/2, false); fireBeam(e.y+EVO_CHARGER_DUAL_GAP/2, false); }
          else fireBeam(e.y, false, e.evoStage===1 ? EVO_CHARGER_WIDE_THICK : undefined);
          if(e.evoStage === 5){
            for(let i=0;i<EVO_CHARGER_RESIDUE_N;i++){
              acidPools.push({x:W*(i+.5)/EVO_CHARGER_RESIDUE_N, y:e.y, r:34, life:0, dur:EVO_CHARGER_RESIDUE_DUR, hitCd:0});
            }
          }
          shake = Math.max(shake, 10); flash = Math.max(flash, .35); sfx.boom();
        }
      } else {
        e.chargerT -= dt;
        if(e.chargerT <= 0){ e.chargerState = "charge"; e.chargerT = chargeTime; e.trackY = e.y; }
      }
    }
    // 산탄총 1/2/3/5단계 — 근접 사거리 안이면 멈춰서 부채꼴 발사, 4단계는 근접도약 후 점사
    if(e.key === "shotgun" && e.evoStage === 4){
      if(e.lunging){
        e.lungeT += dt; e.x += e.lungeVx*dt; e.y += e.lungeVy*dt;
        if(e.lungeT > .35 || dist(player.x,player.y,e.x,e.y) < e.r+PLAYER_R+10){
          e.lunging = false;
          fireBulletSpread(e, 3, SHOTGUN_SPREAD);
          e.shotCd = SHOTGUN_COOLDOWN * rnd(.85,1.15);
        }
      } else {
        e.shotCd -= dt;
        const onScreen = e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H;
        if(e.shotCd <= 0 && onScreen && dist(player.x,player.y,e.x,e.y) <= EVO_SHOTGUN_LUNGE_RANGE){
          e.lunging = true; e.lungeT = 0;
          const a2 = Math.atan2(player.y-e.y, player.x-e.x);
          e.lungeVx = Math.cos(a2)*EVO_SHOTGUN_LUNGE_SPEED; e.lungeVy = Math.sin(a2)*EVO_SHOTGUN_LUNGE_SPEED;
        }
      }
    } else if(e.key === "shotgun"){
      e.shotCd -= dt;
      const onScreen = e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H;
      if(e.shotCd <= 0 && onScreen && dist(player.x,player.y,e.x,e.y) <= SHOTGUN_RANGE){
        const adjacent = e.evoStage===5 && dist(player.x,player.y,e.x,e.y) < e.r+PLAYER_R+EVO_SHOTGUN_ADJACENT_R;
        const spread = e.evoStage===1 ? EVO_SHOTGUN_WIDE_SPREAD : SHOTGUN_SPREAD;
        if(adjacent) fireBulletRing(e, 8);
        else fireBulletSpread(e, 3, spread, e.evoStage===2);
        e.shotCd = SHOTGUN_COOLDOWN * rnd(.85,1.15);
        if(e.evoStage === 3) e.doubleCd = EVO_SHOTGUN_DOUBLE_GAP;
      }
      if(e.doubleCd > 0){
        e.doubleCd -= dt;
        if(e.doubleCd <= 0){ fireBulletSpread(e, 3, SHOTGUN_SPREAD); e.doubleCd = 0; }
      }
    }

    // 저격수 4단계: 근접하면 확률적으로 후퇴
    if(e.key === "gunner" && e.evoStage === 4){
      if(dist(player.x,player.y,e.x,e.y) < EVO_GUNNER_FLEE_RANGE){
        e.fleeCd = (e.fleeCd||0) - dt;
        if(e.fleeCd <= 0){ e.fleeCd = .6; if(Math.random() < EVO_GUNNER_FLEE_CHANCE) e.fleeing = .8; }
      }
      if(e.fleeing > 0) e.fleeing -= dt;
    }

    let sp = e.spd * (e.stagger>0 ? .25 : 1);
    if(e.born < .3) sp *= .25;
    const gunnerRange = e.key==="gunner" ? (e.evoStage===2 ? GUNNER_RANGE*EVO_GUNNER_RANGE2_MULT : e.evoStage===3 ? GUNNER_RANGE*EVO_GUNNER_SNIPE_RANGE_MULT : GUNNER_RANGE) : 0;
    if(e.key === "gunner" && dist(player.x,player.y,e.x,e.y) < gunnerRange*.55) sp = 0; // 사거리 안이면 멈춰서 사격
    if(e.key === "gunner" && e.snipeWind > 0) sp = 0; // 저격샷 예비동작 중엔 정지
    if(e.key === "shotgun" && e.evoStage !== 4 && dist(player.x,player.y,e.x,e.y) <= SHOTGUN_RANGE) sp = 0; // 근접 사거리 안이면 멈춰서 사격
    if(e.key === "shotgun" && e.lunging) sp = 0; // 근접도약 중엔 위쪽 로직이 직접 이동시킨다
    if(e.key === "charger" && e.chargerState) sp = 0; // 충전 시작 후엔 정지
    if(e.key === "guardian" && (e.slamWind > 0 || e.spinT > 0)) sp = 0; // 내려찍기·회전베기 중엔 정지
    e.wob += dt*4;
    let moveA = a, wob = e.key==="swift" ? Math.sin(e.wob)*.5 : 0;
    if(e.key === "slime" && (e.evoStage===1 || e.evoStage===4) && e.charging){ sp = e.spd*EVO_SLIME_SPEED_MULT; moveA = e.chargeA; wob = 0; }
    if(e.key === "gunner" && e.fleeing > 0){ moveA = a + Math.PI; sp = e.spd*1.4; wob = 0; }
    e.x += Math.cos(moveA+wob)*sp*dt + e.kx*e.kb*dt;
    e.y += Math.sin(moveA+wob)*sp*dt + e.ky*e.kb*dt;
    e.kb = Math.max(0, e.kb - dt*900);
    e.x = clamp(e.x, -40, W+40); e.y = clamp(e.y, -40, H+40);

    // 충전병 — 정지 상태라 스스로는 화면 밖으로 못 나가지만, 플레이어 피격 시 넉백에 밀려 나갈 수 있다.
    // 그렇게 화면 밖으로 밀려난 채 3초가 지나면 자동으로 사망 처리(연격 스택 등 보상 없음)
    if(e.key === "charger" && e.chargerState){
      const onScreenNow = e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H;
      if(!onScreenNow){
        e.offscreenT = (e.offscreenT||0) + dt;
        if(e.offscreenT >= 3){ e.alive = false; chargerCd = CHARGER_RESPAWN_DELAY; beams = []; continue; }
      } else e.offscreenT = 0;
    }

    // 저격수 1/2/4/5단계: 사거리 안이면 주기적으로 직선 탄환 발사, 3단계는 예비동작 후 저격샷
    if(e.key === "gunner"){
      e.shotCd -= dt;
      const onScreen = e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H;
      if(e.shotCd <= 0 && onScreen && dist(player.x,player.y,e.x,e.y) <= gunnerRange){
        if(e.evoStage === 3){
          e.snipeWind = EVO_GUNNER_SNIPE_TELEGRAPH; e.snipeA = Math.atan2(player.y-e.y, player.x-e.x);
          e.shotCd = GUNNER_COOLDOWN * 1.6 * rnd(.85,1.15);
        } else {
          fireBullet(e);
          e.shotCd = GUNNER_COOLDOWN * rnd(.85,1.15);
        }
      }
      if(e.snipeWind > 0){
        e.snipeWind -= dt;
        if(e.snipeWind <= 0){
          bullets.push({x:e.x, y:e.y, vx:Math.cos(e.snipeA)*EVO_GUNNER_SNIPE_SPEED, vy:Math.sin(e.snipeA)*EVO_GUNNER_SNIPE_SPEED, life:0, dur:2.2, curve:false});
          sfx.shot();
        }
      }
    }
    // 플레이어 피격(접촉) — 허수아비는 피해 없음, 분열 미니는 체감상 절반 데미지(50% 확률로만 발동)
    if(!player.dashing && player.invuln <= 0 && e.atk <= 0 && e.key !== "dummy" && e.key !== "charger" &&
        dist(e.x,e.y,player.x,player.y) < e.r + PLAYER_R + 2){
      e.atk = 1.9;
      if(!e.mini || Math.random() < EVO_SLIME_SPLIT_HP_MULT) damagePlayer();
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

  // 훈련장 허수아비 리스폰 — 킬 판정 루프가 끝난 뒤에 안전하게 새로 추가한다
  for(const d of dummyRespawns) d.t -= dt;
  dummyRespawns = dummyRespawns.filter(d=>{
    if(d.t > 0) return true;
    spawn("dummy", 0, {x:d.x, y:d.y});
    return false;
  });

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
  for(const w of winds) w.life += dt;
  winds = winds.filter(w=>w.life < w.dur);
  for(const b of evoBanners) b.life += dt;
  evoBanners = evoBanners.filter(b=>b.life < b.dur);

  syncTimer();
}
