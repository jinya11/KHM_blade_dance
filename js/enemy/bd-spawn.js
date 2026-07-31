"use strict";
// 적 스폰 — 경과 시간대별 적 종류 추첨, 화면 밖 스폰 위치 선정, 스폰 주기/최대 마릿수 계산.
function pickType(){
  const p = t/ROUND_TIME;
  const weights = p < .2  ? {slime:60, swift:22, gunner:18}
                : p < .48 ? {slime:32, swift:20, guardian:14, bomber:12, gunner:14, healer:8}
                :           {slime:22, swift:18, guardian:17, bomber:15, gunner:16, healer:12};
  if(enemies.reduce((n,o)=>n+(o.alive&&o.key==="gunner"?1:0),0) >= GUNNER_MAX_ALIVE) delete weights.gunner;
  // 산탄총/충전병: 일반 모드는 시간 제한 없이, 무한 모드는 INFINITE_NEW_ENEMY_DELAY 이후부터 등장
  if(mode === "normal" || t >= INFINITE_NEW_ENEMY_DELAY){
    weights.shotgun = 12;
    if(chargerCd <= 0 && !enemies.some(o=>o.alive && o.key==="charger")) weights.charger = 6;
  }
  return weightedPick(weights);
}
function evoAliveCount(key){
  return enemies.reduce((n,o)=>n + (o.alive && o.key===key && o.evo ? 1 : 0), 0);
}
function evoDeficitCategories(){
  return EVO_CATEGORIES.filter(k => evoTarget[k] > evoAliveCount(k));
}
// 진화 목표가 있는데 아직 부족한 범주가 있으면 그중 하나를 즉시 뽑아 등장시킨다(pickType 확률에 안 묻히도록)
function trySpawnEvolved(){
  const deficits = evoDeficitCategories();
  if(deficits.length) spawn(deficits[Math.floor(Math.random()*deficits.length)], true);
}
function spawn(forceKey, forceEvo){
  const key = forceKey || pickType(), d = TYPES[key];
  let x,y,guard=0;
  do{
    const side = Math.floor(Math.random()*4), m = 30;
    if(side===0){x=rnd(m,W-m); y=-20;}
    else if(side===1){x=W+20; y=rnd(m,H-m);}
    else if(side===2){x=rnd(m,W-m); y=H+20;}
    else {x=-20; y=rnd(m,H-m);}
  } while(dist(x,y,player.x,player.y) < 150 && ++guard < 12);
  const evo = forceEvo || (evoTarget[key] > 0 && evoAliveCount(key) < evoTarget[key]);
  enemies.push({key, x, y, r:d.r, spd:d.spd*rnd(.9,1.12), score:d.score, color:d.color,
                alive:true, facing:Math.atan2(player.y-y,player.x-x), atk:.8, born:0,
                stagger:0, wob:rnd(0,6.28), kb:0, kx:0, ky:0,
                shotCd:rnd(.5,1.1), guardDisarmed:false,
                evo, chargeCd:rnd(.3,EVO_SLIME_INTERVAL), charging:false, chargeA:0,
                slamCd:rnd(.5,EVO_GUARDIAN_CD), slamWind:0,
                chargerState:null, chargerT:0});
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
