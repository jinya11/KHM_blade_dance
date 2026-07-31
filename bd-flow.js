"use strict";
// 게임 흐름 — 시작/종료/홈 화면 전환과 버튼·키보드 입력을 연결하고, requestAnimationFrame 메인 루프를 구동한다.
function startGame(newMode){
  if(newMode) mode = newMode;
  resize(); reset();
  $("titleVeil").classList.add("hide");
  $("overVeil").classList.add("hide");
  $("pauseVeil").classList.add("hide");
  $("hudPanel").classList.remove("hide");
  state = "play";
  if(ac() && AC.state === "suspended") AC.resume();
}
function gameOver(reason){
  state = "over"; sfx.end();
  shake = 0; flash = 0; // 종료 후에도 draw()가 매 프레임 흔들림을 계속 계산하지 않도록 즉시 정리
  if(mode === "infinite") score += Math.floor(t) * SURVIVAL_SCORE_PER_SEC; // 처치 점수 + 생존 시간
  const grade = mode === "infinite"
    ? (score>=500000?"S":score>=300000?"A":score>=150000?"B":score>=50000?"C":"D")
    : (score>=20000?"S":score>=13000?"A":score>=8000?"B":score>=4000?"C":"D");
  $("overReason").textContent = reason;
  $("gradeTxt").textContent = grade;
  $("finalScore").textContent = score.toLocaleString();
  $("statCombo").textContent = maxCombo;
  $("statKills").textContent = kills;
  $("statAcc").textContent = dashCount ? Math.round(hitDashes/dashCount*100)+"%" : "0%";
  $("overVeil").classList.remove("hide");
  $("hudPanel").classList.add("hide");
  recordScore(mode, score, grade);
}
function goHome(){
  state = "title";
  $("overVeil").classList.add("hide");
  $("hudPanel").classList.add("hide");
  $("titleVeil").classList.remove("hide");
  renderScoreHistory();
}

// 플레이 방법 오버레이 — 처음 방문 시 자동 표시(뒤에 게임 화면), 이후엔 아이콘으로 재열람(뒤에 타이틀)
const HOWTO_KEY = "bladeDance.howtoSeen";
function openHowto(){ $("howtoVeil").classList.remove("hide"); }
function closeHowto(){
  $("howtoVeil").classList.add("hide");
  localStorage.setItem(HOWTO_KEY, "1");
}
$("helpIconBtn").addEventListener("click", openHowto);
$("howtoClose").addEventListener("click", closeHowto);
$("howtoVeil").addEventListener("click", e=>{ if(e.target.id === "howtoVeil") closeHowto(); });

function togglePause(){
  if(state !== "play") return;
  paused = !paused;
  $("pauseVeil").classList.toggle("hide", !paused);
}
$("pauseBtn").addEventListener("click", togglePause);
$("resumeBtn").addEventListener("click", togglePause);
$("pauseRestartBtn").addEventListener("click", ()=>startGame());

$("startNormalBtn").addEventListener("click", ()=>startGame("normal"));
$("startInfiniteBtn").addEventListener("click", ()=>startGame("infinite"));
$("retryBtn").addEventListener("click", ()=>startGame());
$("homeBtn").addEventListener("click", goHome);
window.addEventListener("keydown", e=>{
  if(e.code === "Escape"){ togglePause(); return; }
  if((e.code==="Space"||e.code==="Enter") && state!=="play" && $("howtoVeil").classList.contains("hide")){
    e.preventDefault(); startGame();
  }
});

// Loop
let last = performance.now();
function loop(now){
  const dt = Math.min(.033, (now-last)/1000); last = now;
  if(state === "play" && !paused) update(dt);
  draw();
  requestAnimationFrame(loop);
}
resize();
player.x = W/2; player.y = H/2;
syncHud(); syncTimer();
renderScoreHistory();
if(localStorage.getItem(HOWTO_KEY) !== "1") openHowto();
requestAnimationFrame(loop);
