"use strict";
// 게임 상태 — 점수·연격·타이머·플레이어·적 배열 등 런타임 전역 변수와 라운드 초기화(reset())를 담당.
let state = "title";         // title | play | over
let mode = "normal";         // normal | infinite — startGame()이 설정, reset()은 건드리지 않는다
let t = 0, timeLeft = ROUND_TIME;
let score = 0, combo = 0, maxCombo = 0, kills = 0, dashCount = 0, hitDashes = 0;
let charges = 0, comboTimer = 0, shake = 0, slowmo = 0, flash = 0, paused = false;
const player = {x:0,y:0,hp:MAX_HP,invuln:0,cd:0,dashing:false,t:0,dur:0,fx:0,fy:0,tx:0,ty:0,dx:1,dy:0,
                killed:false, isReposition:false, ult:false, facing:0, hitSet:null, quickRecover:0};
let enemies = [], parts = [], texts = [], slashes = [], trail = [];
let bullets = [], heals = []; // 저격수 탄환 · 회복충 드롭
let beams = []; // 충전병이 발사하는 가로 빔
let chargerCd = 0; // 충전병 처치 후 재등장까지 남은 시간
let swords = []; // 질풍참 1스택 검 투사체
let spawnTimer = 0;
let bossActive = false, bossTimer = 0; // 무한 모드: 다음 보스 등장까지 남은 시간
let bossZones = []; // 보스 패턴이 만드는 잔상 등 범용 위험지대(공통 시스템이 갱신/판정)
let cage = null;     // 활성화된 감금 벽: {cx,cy,half,walls:{top,bottom,left,right}}
let bossNoAttack = 0; // 보스가 피격당한 직후: 이 시간 동안은 어떤 패턴의 공격도 성립하지 않는다
let stamina = MAX_STAMINA, staminaLock = 0, evadeStreak = 0; // 기력 · 이동 불가 타이머 · 처치 없는 연속 회피 횟수
let idleTime = 0; // 대시하지 않고 가만히 있은 시간(기력 자동 회복 조건)
let evoTarget = {slime:0, gunner:0, guardian:0}; // 무한 모드: 누적되는 진화개체 목표 마릿수
let evoTimer = 0; // 다음 시간 기반 진화 등장까지 남은 시간

function reset(){
  t = 0; timeLeft = ROUND_TIME;
  score = combo = maxCombo = kills = dashCount = hitDashes = 0;
  charges = 0; comboTimer = 0; shake = 0; slowmo = 0; flash = 0; paused = false;
  enemies = []; parts = []; texts = []; slashes = []; trail = [];
  bullets = []; heals = []; swords = []; beams = []; chargerCd = 0;
  spawnTimer = .35;
  bossActive = false; bossTimer = rnd(BOSS_INTERVAL_MIN, BOSS_INTERVAL_MAX);
  bossZones = []; cage = null; bossNoAttack = 0;
  stamina = MAX_STAMINA; staminaLock = 0; evadeStreak = 0; idleTime = 0;
  evoTarget = {slime:0, gunner:0, guardian:0};
  evoTimer = rnd(EVO_TIME_MIN, EVO_TIME_MAX);
  Object.assign(player,{x:W/2,y:H/2,hp:MAX_HP,invuln:0,cd:0,dashing:false,killed:false,isReposition:false,ult:false,facing:0,quickRecover:0});
  syncHud();
}
