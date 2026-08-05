"use strict";
// 렌더링 — 배경·검격 잔상·적·파티클·플레이어·떠오르는 숫자를 매 프레임 캔버스에 그린다(draw). 상태를 바꾸지 않고 읽기만 한다.
// 기력 잔량에 따라 흰색(가득)에서 빨강(고갈)으로 변하는 플레이어 색상
function staminaColor(){
  const k = clamp(stamina/MAX_STAMINA, 0, 1);
  const r = Math.round(0xE0 + (0xDC-0xE0)*k), g = Math.round(0x45 + (0xE9-0x45)*k), b = Math.round(0x3A + (0xF2-0x3A)*k);
  return {fill:`rgb(${r},${g},${b})`, shadow:`rgba(${r},${g},${b},.65)`};
}
// 질풍참 바람 줄기 — 곡선으로 휘어지는 짙은 청색 리본, 중심에 밝은 코어를 겹쳐 그린다
function drawWinds(){
  for(const w of winds){
    const k = 1 - w.life/w.dur; if(k <= 0) continue;
    const fade = Math.sin(Math.min(1, w.life/w.dur) * Math.PI);
    const ex = w.x + Math.cos(w.a)*w.len, ey = w.y + Math.sin(w.a)*w.len;
    const nx = -Math.sin(w.a), ny = Math.cos(w.a), bow = w.len*.18;
    const mx = (w.x+ex)/2 + nx*bow, my = (w.y+ey)/2 + ny*bow;
    ctx.save(); ctx.globalAlpha = fade*.85; ctx.lineCap = "round";
    ctx.strokeStyle = "#0D3B66"; ctx.lineWidth = 10*fade;
    ctx.beginPath(); ctx.moveTo(w.x,w.y); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke();
    ctx.strokeStyle = "#3FA9F5"; ctx.lineWidth = 5*fade;
    ctx.shadowColor = "rgba(79,195,247,.9)"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(w.x,w.y); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke();
    ctx.strokeStyle = "#DFF6FF"; ctx.lineWidth = 1.6*fade; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(w.x,w.y); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke();
    ctx.restore(); ctx.shadowBlur = 0;
  }
}
// 충전병 충전 예고 — 빔이 지나갈 경로를 미리 흐리게 표시하고, 머리 위에 펄스 마름모로 충전 진행을 알린다
function drawChargerTelegraphs(){
  for(const e of enemies){
    if(!e.alive || e.key !== "charger" || e.chargerState !== "charge") continue;
    const total = e.evoStage === 4 ? CHARGER_CHARGE_TIME*EVO_CHARGER_FAST_CHARGE_MULT : CHARGER_CHARGE_TIME;
    const k = 1 - e.chargerT/total;
    ctx.save(); ctx.globalAlpha = .12 + .22*k; ctx.fillStyle = "#4FC3F7";
    const row = (pos, vertical, thick) => {
      thick = thick || CHARGER_BEAM_THICK;
      if(vertical) ctx.fillRect(pos-thick/2, 0, thick, H);
      else ctx.fillRect(0, pos-thick/2, W, thick);
    };
    if(e.evoStage === 2){ row(e.y,false); row(e.x,true); }
    else if(e.evoStage === 3) row(e.trackY===undefined ? e.y : e.trackY, false);
    else if(e.evoStage === 4){ row(e.y-EVO_CHARGER_DUAL_GAP/2,false); row(e.y+EVO_CHARGER_DUAL_GAP/2,false); }
    else row(e.y, false, e.evoStage===1 ? EVO_CHARGER_WIDE_THICK : undefined);
    ctx.restore();
    const pulse = .6 + .4*Math.sin(t*10);
    ctx.save(); ctx.translate(e.x, e.y-e.r-20); ctx.rotate(Math.PI/4);
    ctx.fillStyle = "rgba(79,195,247,"+(0.4+0.5*k*pulse).toFixed(2)+")";
    ctx.fillRect(-6,-6,12,12);
    ctx.restore();
  }
}
// 귀환식 마킹 지점 — 펄스링 + 실제 내려찍기 판정 범위 + 순간이동까지 남은 시간을 나타내는 진행 링
function drawRecallMark(){
  if(!recallMark) return;
  const k = 1 - recallMark.t/RECALL_DELAY;
  ctx.save();
  ctx.globalAlpha = .35 + .25*(1-k);
  ctx.strokeStyle = "#39D97A"; ctx.lineWidth = 2; ctx.setLineDash([6,6]);
  ctx.beginPath(); ctx.arc(recallMark.x, recallMark.y, RECALL_SLAM_R, 0, 6.283); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = .55 + .35*Math.sin(recallMark.t*10);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(recallMark.x, recallMark.y, 16+6*Math.sin(recallMark.t*6), 0, 6.283); ctx.stroke();
  ctx.globalAlpha = .8;
  ctx.beginPath(); ctx.arc(recallMark.x, recallMark.y, 26, -1.5708, -1.5708+6.283*k); ctx.stroke();
  ctx.restore();
}
// 흡풍식/광풍식 회오리 — 짙은 초록 바깥 겹 + 밝은 연두 코어를 겹쳐 그려 소용돌이치는 바람을 표현
function drawVortices(){
  for(const v of vortices){
    const k = Math.max(0, 1 - v.life/v.dur);
    ctx.save(); ctx.globalAlpha = k*.85; ctx.lineCap = "round";
    for(let i=0;i<3;i++){
      const rr = v.r * (0.35+i*0.25) * (v.mode === "pull" ? k : (1-k*.4));
      const rot = v.life*(v.mode === "pull" ? 4 : -3) + i*2;
      ctx.strokeStyle = "#0F5C33"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(v.x, v.y, rr, rot, rot+4.5); ctx.stroke();
      ctx.strokeStyle = "#39D97A"; ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(57,217,122,.9)"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(v.x, v.y, rr, rot, rot+4.5); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}
// 스킬군 선택 원형 UI — 마우스 휠 클릭으로 열리며, 좌/우 반원이 질풍참/귀풍참에 대응한다
function drawWheelUi(){
  if(!wheelUiOpen) return;
  const cx = player.x, cy = player.y, R = 90, hoverGale = mouseX < cx;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283);
  ctx.fillStyle = "rgba(10,11,17,.82)"; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(220,233,242,.35)"; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R, Math.PI/2, Math.PI*1.5); ctx.closePath();
  ctx.fillStyle = hoverGale ? "rgba(232,184,75,.3)" : "rgba(232,184,75,.08)"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R, -Math.PI/2, Math.PI/2); ctx.closePath();
  ctx.fillStyle = !hoverGale ? "rgba(79,195,247,.3)" : "rgba(79,195,247,.08)"; ctx.fill();
  ctx.font = "bold 15px 'Nanum Myeongjo',serif"; ctx.textAlign = "center"; ctx.fillStyle = "#EDE4D3";
  ctx.fillText("질풍참", cx-R*.5, cy+5);
  ctx.fillText("귀풍참", cx+R*.5, cy+5);
  ctx.strokeStyle = "#DFF6FF"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx,cy,R+8,-1.5708,-1.5708+6.283*(wheelUiTimer/WHEEL_UI_IDLE_CLOSE)); ctx.stroke();
  ctx.restore();
}
const trainRoomImg = new Image();
trainRoomImg.src = "img/training-room-1920-x-1080-v0-9xp0f8sikrub1.webp";
function draw(){
  ctx.clearRect(0,0,W,H);
  const sx = shake ? rnd(-shake,shake)*.4 : 0, sy = shake ? rnd(-shake,shake)*.4 : 0;
  ctx.save(); ctx.translate(sx,sy);

  if(mode === "training" && trainRoomImg.complete && trainRoomImg.naturalWidth){
    // 훈련장 전용 배경 — 이미지를 화면에 꽉 차게(cover) 그리고, 적/UI 가독성을 위해 살짝 어둡게 톤다운
    const iw = trainRoomImg.naturalWidth, ih = trainRoomImg.naturalHeight;
    const scale = Math.max(W/iw, H/ih), dw = iw*scale, dh = ih*scale;
    ctx.drawImage(trainRoomImg, (W-dw)/2, (H-dh)/2, dw, dh);
    ctx.fillStyle = "rgba(10,11,17,.45)"; ctx.fillRect(-20,-20,W+40,H+40);
  } else {
    // 배경: 먹 번짐 + 한지 결
    const g = ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,Math.max(W,H)*.75);
    g.addColorStop(0,"#171C2B"); g.addColorStop(1,"#0A0B11");
    ctx.fillStyle = g; ctx.fillRect(-20,-20,W+40,H+40);
    ctx.strokeStyle = "rgba(237,228,211,.045)"; ctx.lineWidth = 1;
    for(let i=0;i<H;i+=44){ ctx.beginPath(); ctx.moveTo(0,i+.5); ctx.lineTo(W,i+.5); ctx.stroke(); }
    // 원형 붓 자국
    ctx.strokeStyle = "rgba(237,228,211,.05)"; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.arc(W/2,H/2,Math.min(W,H)*.36,.5,5.1); ctx.stroke();
  }

  if(flash > 0){ ctx.fillStyle = "rgba(232,184,75,"+(flash*.20).toFixed(3)+")"; ctx.fillRect(0,0,W,H); }

  // 검격 잔상
  for(const s of slashes){
    const k = 1 - s.life/s.dur;
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.a);
    ctx.globalAlpha = k*.85;
    ctx.fillStyle = s.ult ? "#2F86D6" : "#DCE9F2";
    const h = (s.ult?16:7) * k;
    ctx.beginPath(); ctx.moveTo(0,-h); ctx.lineTo(s.len,0); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // 대시 궤적
  for(const p of trail){
    const k = 1 - p.life/.28;
    ctx.fillStyle = (p.ult?"rgba(232,184,75,":"rgba(220,233,242,")+(k*.5).toFixed(3)+")";
    ctx.beginPath(); ctx.arc(p.x,p.y,PLAYER_R*k*.95,0,6.283); ctx.fill();
  }

  // 적
  for(const e of enemies){
    const pop = Math.min(1, e.born/.28);
    ctx.save(); ctx.translate(e.x,e.y);
    ctx.globalAlpha = .35 + .65*pop;
    const R = e.r * (0.5 + 0.5*pop);
    if(e.key === "guardian"){
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
      ctx.rotate(e.facing);
      if(!e.guardDisarmed){
        // 정면 방패(질풍참 3스택에 맞으면 사라진다)
        ctx.strokeStyle = e.stagger>0 ? "rgba(232,184,75,.55)" : "#E8B84B";
        ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0,0,R+7,-1.32,1.32); ctx.stroke();
      }
      // 등 뒤 약점
      ctx.fillStyle = "#E0453A";
      ctx.beginPath(); ctx.arc(-R+3,0,3.4,0,6.283); ctx.fill();
    } else if(e.key === "bomber"){
      ctx.rotate(Math.sin(e.wob)*.25);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      for(let i=0;i<8;i++){ const a=i/8*6.283, rr=i%2?R*.62:R; ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0B0C12"; ctx.beginPath(); ctx.arc(0,0,R*.3,0,6.283); ctx.fill();
    } else if(e.key === "swift"){
      ctx.rotate(e.facing);
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.moveTo(R*1.5,0); ctx.lineTo(-R,R*.85); ctx.lineTo(-R*.4,0); ctx.lineTo(-R,-R*.85);
      ctx.closePath(); ctx.fill();
    } else if(e.key === "gunner"){
      ctx.rotate(e.facing);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(R,-R*.55); ctx.lineTo(R*1.6,0); ctx.lineTo(R,R*.55);
      ctx.lineTo(-R*.7,R*.55); ctx.lineTo(-R*.7,-R*.55);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0B0C12"; ctx.beginPath(); ctx.arc(-R*.1,0,R*.28,0,6.283); ctx.fill();
      if(e.snipeWind > 0){
        // 3단계 저격샷 예고 — 조준 방향으로 레이저 라인 표시
        const pulse = .5 + .4*Math.sin(t*30);
        ctx.strokeStyle = "rgba(224,69,58,"+pulse.toFixed(2)+")"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(2000,0); ctx.stroke();
      }
    } else if(e.key === "healer"){
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
      ctx.fillStyle = "#0B0C12";
      ctx.fillRect(-R*.12,-R*.5,R*.24,R);
      ctx.fillRect(-R*.5,-R*.12,R,R*.24);
    } else if(e.key === "shotgun"){
      ctx.rotate(e.facing);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(R*1.4,0); ctx.lineTo(R*.5,R*.7); ctx.lineTo(-R*.8,R*.55);
      ctx.lineTo(-R*.8,-R*.55); ctx.lineTo(R*.5,-R*.7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0B0C12"; ctx.beginPath(); ctx.arc(0,0,R*.3,0,6.283); ctx.fill();
    } else if(e.key === "charger"){
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
      if(e.chargerState === "charge"){
        const k = 1 - e.chargerT/CHARGER_CHARGE_TIME;
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0,0,R+6,-1.5708,-1.5708+6.283*k); ctx.stroke();
      } else if(e.chargerState === "fire"){
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.beginPath(); ctx.arc(0,0,R*.5,0,6.283); ctx.fill();
      }
    } else if(e.key === "boss"){
      drawBoss(e, R);
    } else {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      const sq = 1 + Math.sin(e.wob)*.08;
      ctx.ellipse(0,0,R*sq,R/sq,0,0,6.283); ctx.fill();
      ctx.fillStyle = "rgba(11,12,18,.55)";
      ctx.beginPath(); ctx.arc(-R*.28,-R*.15,2.6,0,6.283); ctx.arc(R*.28,-R*.15,2.6,0,6.283); ctx.fill();
    }
    if(e.hitFlash > 0){
      // 다타형(5단계) 피격 플래시 — 처치는 안 됐지만 맞았다는 즉각적 피드백
      ctx.globalAlpha = Math.min(1, e.hitFlash/.15)*.6;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    if(e.evoStage > 0){
      // 진화 단계 표식 — 단계 수만큼 점으로 표시, 5단계는 아래에 체력바 추가
      ctx.save(); ctx.translate(e.x, e.y-e.r-14);
      ctx.fillStyle = "#E8B84B";
      for(let i=0;i<e.evoStage;i++){ ctx.beginPath(); ctx.arc(-10+i*5, 0, 2.1, 0, 6.283); ctx.fill(); }
      ctx.restore();
      if(e.maxHp > 1){
        ctx.save(); ctx.translate(e.x-14, e.y-e.r-23);
        ctx.fillStyle = "rgba(237,228,211,.2)"; ctx.fillRect(0,0,28,4);
        ctx.fillStyle = "#E0453A"; ctx.fillRect(0,0,28*(e.hp/e.maxHp),4);
        ctx.restore();
      }
    }
    if(e.key === "guardian" && e.slamWind > 0){
      // 내려찍기 예비동작 경고 — 실제 타격 범위를 처음부터 고정으로 보여주고 점멸
      const pulse = .55 + .35*Math.sin(e.slamWind*22);
      ctx.strokeStyle = "rgba(224,69,58,"+pulse.toFixed(2)+")"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r+PLAYER_R+EVO_GUARDIAN_RANGE, 0, 6.283); ctx.stroke();
    }
  }

  drawChargerTelegraphs();
  drawHazards();
  drawWinds();
  drawSwords();
  drawBossExtras();

  // 파티클
  for(const p of parts){
    const k = 1 - p.life/p.dur;
    if(p.ring){
      ctx.strokeStyle = "rgba(232,184,75,"+(k*.8).toFixed(3)+")";
      ctx.lineWidth = 4*k+1;
      ctx.beginPath(); ctx.arc(p.x,p.y,(p.radius||118)*(1-k*k),0,6.283); ctx.stroke();
    }else{
      ctx.globalAlpha = k; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*k,0,6.283); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  // 플레이어
  if(state === "play" || state === "over"){
    const blink = player.invuln > 0 && Math.floor(player.invuln*14)%2 === 0;
    ctx.save(); ctx.translate(player.x, player.y);
    // 쿨타임 링
    if(player.cd > 0 && !player.dashing){
      const k = player.cd / DASH_CD;
      ctx.strokeStyle = "rgba(224,69,58,.75)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0,0,PLAYER_R+9,-1.5708,-1.5708+6.283*(1-Math.min(1,k))); ctx.stroke();
    } else if(!player.dashing){
      ctx.strokeStyle = "rgba(220,233,242,.35)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0,0,PLAYER_R+9,0,6.283); ctx.stroke();
    }
    if(player.marked > 0){
      // 저격수 5단계 표식 — 다음 피격 시 추가 피해
      const pulse = .5 + .4*Math.sin(t*16);
      ctx.strokeStyle = "rgba(139,95,191,"+pulse.toFixed(2)+")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,PLAYER_R+15,0,6.283); ctx.stroke();
    }
    ctx.globalAlpha = blink ? .35 : 1;
    ctx.rotate(player.facing);
    const sc = staminaColor();
    ctx.fillStyle = charges>=MAX_CHARGE ? "#E8B84B" : sc.fill;
    ctx.shadowColor = charges>=MAX_CHARGE ? "rgba(232,184,75,.8)" : sc.shadow;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(PLAYER_R*1.45,0); ctx.lineTo(-PLAYER_R*.75, PLAYER_R*.8);
    ctx.lineTo(-PLAYER_R*.2,0);  ctx.lineTo(-PLAYER_R*.75,-PLAYER_R*.8);
    ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // 스택 표시 — 쌓인 스택 수만큼 플레이어 옆에 소형 검이 추가된다(선택된 스킬군 색상을 따른다)
    for(let i=0;i<charges;i++){
      ctx.save(); ctx.translate(player.x+PLAYER_R+11, player.y-PLAYER_R-5-i*14); ctx.rotate(-.6);
      ctx.fillStyle = skillFamily === "gale" ? "#2F86D6" : "#39D97A";
      ctx.fillRect(-1.4,-9,2.8,13); ctx.fillRect(-4.5,3,9,2.6);
      ctx.beginPath(); ctx.moveTo(-1.4,-9); ctx.lineTo(1.4,-9); ctx.lineTo(0,-13); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    drawVortices();
    drawRecallMark();
  }

  // 떠오르는 숫자
  ctx.textAlign = "center";
  for(const x of texts){
    const k = 1 - x.life/x.dur;
    ctx.globalAlpha = Math.min(1,k*1.7);
    ctx.font = "800 "+x.size+"px 'Nanum Myeongjo',serif";
    ctx.fillStyle = x.color;
    ctx.fillText(x.s, x.x, x.y);
    ctx.globalAlpha = 1;
  }
  drawWheelUi();
  ctx.restore();
  drawEvoBanners();
}
// 진화 알림 테롭 — 화면 중앙 상단(타이머 UI 아래)에 고정 표시(화면 흔들림 영향 안 받음)
function drawEvoBanners(){
  evoBanners.forEach((b, i) => {
    const k = b.life/b.dur;
    const fade = k < .1 ? k/.1 : k > .85 ? (1-k)/.15 : 1;
    const y = 74 + i*34;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.fillStyle = "rgba(10,11,17,.7)";
    ctx.fillRect(W/2-160, y-16, 320, 32);
    ctx.strokeStyle = "#E8B84B"; ctx.lineWidth = 1; ctx.strokeRect(W/2-160, y-16, 320, 32);
    ctx.textAlign = "center";
    ctx.font = "700 16px 'Nanum Myeongjo',serif";
    ctx.fillStyle = "#E8B84B";
    ctx.fillText(b.text, W/2, y+6);
    ctx.restore();
  });
}
