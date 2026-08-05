"use strict";
// 게임 흐름 — 시작/종료/홈 화면 전환과 버튼·키보드 입력을 연결하고, requestAnimationFrame 메인 루프를 구동한다.
function startGame(newMode){
  if(newMode) mode = newMode;
  resize(); reset();
  $("titleVeil").classList.add("hide");
  $("overVeil").classList.add("hide");
  $("pauseVeil").classList.add("hide");
  $("trainingPanel").classList.add("hide");
  $("hudPanel").classList.remove("hide");
  state = "play";
  if(ac() && AC.state === "suspended") AC.resume();
  stopBgm();
}
/** 훈련장 — 자동 스폰·타이머 없이 허수아비 3마리를 두고 적 소환·스택 조절로 자유롭게 연습한다. */
function enterTraining(){
  mode = "training";
  resize(); reset();
  spawnDummies();
  $("titleVeil").classList.add("hide");
  $("hudPanel").classList.remove("hide");
  $("trainingPanel").classList.remove("hide");
  updateTrainingLabels();
  updateTrainSpawnStageOptions();
  state = "play";
  if(ac() && AC.state === "suspended") AC.resume();
  stopBgm();
  playTrainingBgm();
}
function exitTraining(){
  $("trainingPanel").classList.add("hide");
  stopTrainingBgm();
  goHome();
}
function updateTrainingLabels(){
  $("trainComboVal").textContent = combo;
  $("trainChargeVal").textContent = charges;
}
for(const k of TRAINING_SPAWNABLE){
  const opt = document.createElement("option");
  opt.value = k; opt.textContent = TYPES[k].name;
  $("trainSpawnKey").appendChild(opt);
}
// 진화 단계가 없는 적(질풍조·회복충)은 단계 선택 UI 자체를 숨기고, 있는 적은 실제 최대 단계까지만 보여준다(방패병은 4단계까지)
function updateTrainSpawnStageOptions(){
  const key = $("trainSpawnKey").value, sel = $("trainSpawnStage");
  const has = EVO_CATEGORIES.includes(key);
  sel.classList.toggle("hide", !has);
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "0"; opt0.textContent = "기본";
  sel.appendChild(opt0);
  if(has){
    const max = evoMaxStage(key);
    for(let s=1; s<=max; s++){
      const opt = document.createElement("option");
      opt.value = String(s); opt.textContent = s+"단계";
      sel.appendChild(opt);
    }
  }
}
$("trainSpawnKey").addEventListener("change", updateTrainSpawnStageOptions);
updateTrainSpawnStageOptions();
$("trainingBtn").addEventListener("click", enterTraining);
$("trainExitBtn").addEventListener("click", exitTraining);
$("trainSpawnBtn").addEventListener("click", ()=>{
  const key = $("trainSpawnKey").value;
  const stage = Number($("trainSpawnStage").value);
  const a = rnd(0,6.283), r = 160;
  spawn(key, stage || undefined, {x:clamp(player.x+Math.cos(a)*r,30,W-30), y:clamp(player.y+Math.sin(a)*r,30,H-30)});
});
$("trainComboPlus").addEventListener("click", ()=>{ combo++; comboTimer = COMBO_WINDOW; syncHud(); updateTrainingLabels(); });
$("trainComboMinus").addEventListener("click", ()=>{ combo = Math.max(0, combo-1); syncHud(); updateTrainingLabels(); });
$("trainChargePlus").addEventListener("click", ()=>{ charges = Math.min(MAX_CHARGE, charges+1); syncHud(); updateTrainingLabels(); });
$("trainChargeMinus").addEventListener("click", ()=>{ charges = Math.max(0, charges-1); syncHud(); updateTrainingLabels(); });
const LOADING_DELAY = 900; // 로딩 화면 표시 시간(ms)
function beginLoading(newMode){
  $("titleVeil").classList.add("hide");
  $("overVeil").classList.add("hide");
  $("loadingVeil").classList.remove("hide");
  stopBgm();
  setTimeout(()=>{ $("loadingVeil").classList.add("hide"); startGame(newMode); }, LOADING_DELAY);
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
  playBgm();
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

// 스토리 화면 — 홈페이지 진입 시 가장 먼저 표시, ESC/Enter로 닫으면 원래 진입 절차(하우투→타이틀)로 이어진다
const STORY_LINES = [
  "바람이 지나간 자리엔, 아무것도 남지 않는다.",
  "고향은 어느 밤 흩어졌고, 그는 검 한 자루만 쥔 채 남겨졌다.",
  "이제 그의 눈에 보이는 건 흐릿한 형체뿐 — 사람인지, 바람인지, 그 자신의 미련인지도 알 수 없다.",
  "멈추면 삼켜진다. 그래서 그는 벤다.",
];
const STORY_CHAR_MS = 45, STORY_LINE_GAP_MS = 550;
let storyTimer = null;
function startStory(){
  const el = $("storyText");
  el.innerHTML = "";
  let li = 0, ci = 0, p = null;
  (function tick(){
    if(li >= STORY_LINES.length) return;
    if(!p){ p = document.createElement("p"); el.appendChild(p); }
    const line = STORY_LINES[li];
    if(ci < line.length){
      p.textContent += line[ci]; ci++;
      storyTimer = setTimeout(tick, STORY_CHAR_MS);
    } else {
      li++; ci = 0; p = null;
      storyTimer = setTimeout(tick, STORY_LINE_GAP_MS);
    }
  })();
}
function closeStory(){
  clearTimeout(storyTimer);
  $("storyVeil").classList.add("hide");
  if(localStorage.getItem(HOWTO_KEY) !== "1") openHowto();
}

function togglePause(){
  if(state !== "play" || mode === "training") return; // 훈련장은 재시작할 이유가 없어 일시정지 메뉴 자체를 띄우지 않는다
  paused = !paused;
  $("pauseVeil").classList.toggle("hide", !paused);
}
/** 일시정지 메뉴에서 타이틀로 돌아가기 — 게임 도중 이탈이므로 점수는 기록하지 않는다. */
function quitToTitle(){
  paused = false;
  $("pauseVeil").classList.add("hide");
  goHome();
}
$("pauseBtn").addEventListener("click", togglePause);
$("resumeBtn").addEventListener("click", togglePause);
$("pauseRestartBtn").addEventListener("click", ()=>startGame());
$("pauseTitleBtn").addEventListener("click", quitToTitle);

$("startNormalBtn").addEventListener("click", ()=>beginLoading("normal"));
$("startInfiniteBtn").addEventListener("click", ()=>beginLoading("infinite"));
$("retryBtn").addEventListener("click", ()=>beginLoading());
$("homeBtn").addEventListener("click", goHome);
window.addEventListener("keydown", e=>{
  if(!$("storyVeil").classList.contains("hide")){
    if(e.code === "Escape" || e.code === "Enter"){ e.preventDefault(); closeStory(); }
    return;
  }
  if(e.code === "Escape"){ togglePause(); return; }
  if((e.code==="Space"||e.code==="Enter") && state!=="play" && $("howtoVeil").classList.contains("hide")){
    e.preventDefault(); beginLoading();
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
// 스토리 화면이 항상 가장 먼저 뜨고, 닫힐 때(closeStory) 처음 방문이면 이어서 하우투를 띄운다
startStory();
playBgm(); // 타이틀 화면 진입 시 바로 재생 시도(브라우저 자동재생 정책상 실제 소리는 첫 입력 시 시작됨)
requestAnimationFrame(loop);
