"use strict";
// HUD 갱신 — 점수/타이머/체력/연격 기둥/질풍검 충전 표시를 게임 상태에 맞춰 DOM에 반영(syncHud/syncTimer).
const $ = id=>document.getElementById(id);
const el = {score:$("scoreTxt"), timerFill:$("timerFill"), timerTxt:$("timerTxt"), life:$("lifeBox"),
            combo:$("combo"), comboNum:$("comboNum"), comboWord:$("comboWord"), charges:$("charges"), chargeReady:$("chargeReady"),
            chargeLabel:$("chargeLabel")};
function syncHud(){
  el.score.textContent = score.toLocaleString();
  el.chargeLabel.textContent = skillFamily === "gale" ? "질풍검" : "귀풍검";
  el.charges.classList.toggle("gale", skillFamily === "gale");
  el.charges.classList.toggle("kwi", skillFamily === "kwi");
  const li = el.life.children;
  for(let i=0;i<li.length;i++) li[i].className = i < player.hp ? "" : "off";
  if(combo >= 2){
    el.combo.classList.add("on");
    el.comboNum.textContent = combo;
    el.comboNum.style.fontSize = Math.min(112, 52 + combo*2.6) + "px";
    el.comboNum.style.color = combo>=16 ? "#E8B84B" : combo>=8 ? "#E0453A" : "#EDE4D3";
    el.comboWord.textContent = combo>=16 ? "무 아" : combo>=8 ? "질 풍" : "연 격";
  } else el.combo.classList.remove("on");
  const cb = el.charges.getElementsByTagName("b");
  for(let i=0;i<cb.length;i++) cb[i].className = i < charges ? "on" : "";
  el.chargeReady.classList.toggle("on", charges>0);
}
function syncTimer(){
  if(bossActive) return; // 보스전 중엔 syncBossHp()가 이 자리(hud__timer)를 체력바로 관리한다
  if(mode === "infinite"){
    el.timerFill.style.width = "100%";
    el.timerFill.classList.remove("low");
    const m = Math.floor(t/60), s = Math.floor(t%60);
    el.timerTxt.textContent = m+":"+(s<10?"0":"")+s;
    return;
  }
  const k = timeLeft/ROUND_TIME;
  el.timerFill.style.width = (k*100).toFixed(1)+"%";
  el.timerFill.classList.toggle("low", timeLeft <= 12);
  el.timerTxt.textContent = timeLeft.toFixed(1);
}
