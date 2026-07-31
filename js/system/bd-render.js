"use strict";
// 렌더링 — 배경·검격 잔상·적·파티클·플레이어·떠오르는 숫자를 매 프레임 캔버스에 그린다(draw). 상태를 바꾸지 않고 읽기만 한다.
function draw(){
  ctx.clearRect(0,0,W,H);
  const sx = shake ? rnd(-shake,shake)*.4 : 0, sy = shake ? rnd(-shake,shake)*.4 : 0;
  ctx.save(); ctx.translate(sx,sy);

  // 배경: 먹 번짐 + 한지 결
  const g = ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,Math.max(W,H)*.75);
  g.addColorStop(0,"#171C2B"); g.addColorStop(1,"#0A0B11");
  ctx.fillStyle = g; ctx.fillRect(-20,-20,W+40,H+40);
  ctx.strokeStyle = "rgba(237,228,211,.045)"; ctx.lineWidth = 1;
  for(let i=0;i<H;i+=44){ ctx.beginPath(); ctx.moveTo(0,i+.5); ctx.lineTo(W,i+.5); ctx.stroke(); }
  // 원형 붓 자국
  ctx.strokeStyle = "rgba(237,228,211,.05)"; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.arc(W/2,H/2,Math.min(W,H)*.36,.5,5.1); ctx.stroke();

  if(flash > 0){ ctx.fillStyle = "rgba(232,184,75,"+(flash*.20).toFixed(3)+")"; ctx.fillRect(0,0,W,H); }

  // 검격 잔상
  for(const s of slashes){
    const k = 1 - s.life/s.dur;
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.a);
    ctx.globalAlpha = k*.85;
    ctx.fillStyle = s.ult ? "#E8B84B" : "#DCE9F2";
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
    } else if(e.key === "healer"){
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
      ctx.fillStyle = "#0B0C12";
      ctx.fillRect(-R*.12,-R*.5,R*.24,R);
      ctx.fillRect(-R*.5,-R*.12,R,R*.24);
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
    ctx.restore(); ctx.globalAlpha = 1;
    if(e.evo){
      // 진화개체 표식 — 회전 영향 없는 고정 X 마크
      ctx.save(); ctx.translate(e.x, e.y-e.r-14);
      ctx.strokeStyle = "#E8B84B"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-5,-5); ctx.lineTo(5,5); ctx.moveTo(5,-5); ctx.lineTo(-5,5); ctx.stroke();
      ctx.restore();
    }
    if(e.key === "guardian" && e.slamWind > 0){
      // 내려찍기 예비동작 경고 — 실제 타격 범위를 처음부터 고정으로 보여주고 점멸
      const pulse = .55 + .35*Math.sin(e.slamWind*22);
      ctx.strokeStyle = "rgba(224,69,58,"+pulse.toFixed(2)+")"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r+PLAYER_R+EVO_GUARDIAN_RANGE, 0, 6.283); ctx.stroke();
    }
  }

  drawHazards();
  drawSwords();
  drawBossExtras();

  // 파티클
  for(const p of parts){
    const k = 1 - p.life/p.dur;
    if(p.ring){
      ctx.strokeStyle = "rgba(232,184,75,"+(k*.8).toFixed(3)+")";
      ctx.lineWidth = 4*k+1;
      ctx.beginPath(); ctx.arc(p.x,p.y,118*(1-k*k),0,6.283); ctx.stroke();
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
    ctx.globalAlpha = blink ? .35 : 1;
    ctx.rotate(player.facing);
    ctx.fillStyle = charges>=MAX_CHARGE ? "#E8B84B" : "#DCE9F2";
    ctx.shadowColor = charges>=MAX_CHARGE ? "rgba(232,184,75,.8)" : "rgba(220,233,242,.65)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(PLAYER_R*1.45,0); ctx.lineTo(-PLAYER_R*.75, PLAYER_R*.8);
    ctx.lineTo(-PLAYER_R*.2,0);  ctx.lineTo(-PLAYER_R*.75,-PLAYER_R*.8);
    ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // 질풍참 스택 표시 — 쌓인 스택 수만큼 플레이어 옆에 소형 검이 추가된다
    for(let i=0;i<charges;i++){
      ctx.save(); ctx.translate(player.x+PLAYER_R+11, player.y-PLAYER_R-5-i*14); ctx.rotate(-.6);
      ctx.fillStyle = "#E8B84B";
      ctx.fillRect(-1.4,-9,2.8,13); ctx.fillRect(-4.5,3,9,2.6);
      ctx.beginPath(); ctx.moveTo(-1.4,-9); ctx.lineTo(1.4,-9); ctx.lineTo(0,-13); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
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
  ctx.restore();
}
