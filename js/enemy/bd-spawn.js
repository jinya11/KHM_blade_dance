"use strict";
// 적 스폰 — 경과 시간대별 적 종류 추첨, 화면 밖 스폰 위치 선정, 스폰 주기/최대 마릿수 계산, 진화 단계 관리.
function pickType(){
  const p = t/ROUND_TIME;
  const weights = p < .2  ? {slime:60, swift:22, gunner:11}
                : p < .48 ? {slime:32, swift:20, guardian:9, bomber:12, gunner:9, healer:8}
                :           {slime:22, swift:18, guardian:11, bomber:15, gunner:10, healer:12};
  if(enemies.reduce((n,o)=>n+(o.alive&&o.key==="gunner"?1:0),0) >= GUNNER_MAX_ALIVE) delete weights.gunner;
  // 산탄총/충전병: 일반 모드는 시간 제한 없이, 무한 모드는 INFINITE_NEW_ENEMY_DELAY 이후부터 등장
  if(mode === "normal" || t >= INFINITE_NEW_ENEMY_DELAY){
    weights.shotgun = 12;
    if(chargerCd <= 0 && !enemies.some(o=>o.alive && o.key==="charger")) weights.charger = 6;
  }
  // 폭탄충은 진화가 진행될수록(고단계 해금될수록) 후반부 등장 비중을 살짝 낮춘다
  if(weights.bomber && evoTarget.bomber >= 3) weights.bomber = Math.max(4, weights.bomber - evoTarget.bomber*2);
  return weightedPick(weights);
}
function evoAliveCount(key){
  return enemies.reduce((n,o)=>n + (o.alive && o.key===key && o.evoStage>0 ? 1 : 0), 0);
}
function evoDeficitCategories(){
  return EVO_CATEGORIES.filter(k => evoTarget[k] > 0 && evoAliveCount(k) === 0);
}
// 1~maxStage 중 하나를 뽑되 낮은 단계일수록 자주 나오도록 가중치를 준다(희귀도 곡선)
function pickEvoStage(maxStage){
  const weights = {};
  for(let s=1;s<=maxStage;s++) weights[s] = 1/s;
  return Number(weightedPick(weights));
}
// 진화 목표가 있는데 아직 부족한 범주가 있으면 그중 하나를 즉시 뽑아 등장시킨다(pickType 확률에 안 묻히도록)
function trySpawnEvolved(){
  const deficits = evoDeficitCategories();
  if(deficits.length){
    const key = deficits[Math.floor(Math.random()*deficits.length)];
    spawn(key, pickEvoStage(evoTarget[key]));
  }
}
// 범주 하나의 진화 단계를 1 올린다(최대 MAX_EVO_STAGE). 오를 자리가 없으면 아무것도 하지 않는다.
function evoMaxStage(key){ return EVO_MAX_STAGE_OVERRIDE[key] || MAX_EVO_STAGE; }
function advanceEvolution(){
  const avail = EVO_CATEGORIES.filter(k => evoTarget[k] < evoMaxStage(k));
  if(!avail.length) return;
  const k = avail[Math.floor(Math.random()*avail.length)];
  evoTarget[k]++;
  evoBanners.push({text: TYPES[k].name+" "+evoTarget[k]+"단계로 진화!", life:0, dur:4.5});
  trySpawnEvolved();
}
function spawn(forceKey, forceStage, pos){
  const key = forceKey || pickType(), d = TYPES[key];
  let x,y;
  if(pos){ x = pos.x; y = pos.y; }
  else{
    let guard=0;
    do{
      const side = Math.floor(Math.random()*4), m = 30;
      if(side===0){x=rnd(m,W-m); y=-20;}
      else if(side===1){x=W+20; y=rnd(m,H-m);}
      else if(side===2){x=rnd(m,W-m); y=H+20;}
      else {x=-20; y=rnd(m,H-m);}
    } while(dist(x,y,player.x,player.y) < 150 && ++guard < 12);
  }
  let evoStage = forceStage || 0;
  if(!forceStage && EVO_CATEGORIES.includes(key) && evoTarget[key] > 0 && Math.random() < EVO_SPAWN_CHANCE){
    evoStage = pickEvoStage(evoTarget[key]);
  }
  const hp = evoStage === MAX_EVO_STAGE ? (EVO5_HP[key] || 1) : 1;
  enemies.push({key, x, y, r:d.r, spd:d.spd*rnd(.9,1.12), score:d.score, color:d.color,
                alive:true, facing:Math.atan2(player.y-y,player.x-x), atk:.8, born:0,
                stagger:0, wob:rnd(0,6.28), kb:0, kx:0, ky:0,
                shotCd:rnd(.5,1.1), guardDisarmed:false,
                evoStage, hp, maxHp:hp, hitFlash:0,
                chargeCd:rnd(.3,EVO_SLIME_INTERVAL), charging:false, chargeA:0,
                acidCd:rnd(.3,EVO_SLIME_ABSORB_CD), // 5단계 흡수 판정 타이머(2단계 산성웅덩이와는 무관, 이름만 공유)
                slamCd:rnd(.5,EVO_GUARDIAN_CD), slamWind:0, spinT:0,
                wallCd:rnd(1,EVO_GUARDIAN_WALL_CD),
                lunging:false, lungeT:0, lungeVx:0, lungeVy:0,
                mini:false,
                chargerState:null, chargerT:0});
}
// 훈련장 — 고정된 자리에 허수아비 3마리를 배치한다
function spawnDummies(){
  spawn("dummy", 0, {x:W*.25, y:H*.5});
  spawn("dummy", 0, {x:W*.5,  y:H*.3});
  spawn("dummy", 0, {x:W*.75, y:H*.5});
}
// 넓은(가로형) 화면일수록 같은 밀도를 유지하도록 기준 해상도(800x600) 대비 면적으로 보정
function arenaAreaScale(){ return (W*H) / (800*600); }
function maxEnemies(){
  const scale = clamp(arenaAreaScale(), 1, 1.5);
  return Math.min(70, Math.round((9 + 8*(t/ROUND_TIME)) * scale));
}
function spawnInterval(){
  const scale = clamp(1/arenaAreaScale(), 0.5, 1);
  return Math.max(.30, (1.05 - .68*(t/ROUND_TIME)) * scale);
}
