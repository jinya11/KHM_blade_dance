"use strict";
// 상수 · 순수 유틸리티 — 밸런스 수치(적 스탯, 대시 속도 등)와 rnd/clamp/dist/각도 계산처럼
// 다른 모든 bd-*.js 파일이 전역으로 참조하는 값과 함수를 모아둔 파일. 가장 먼저 로드되어야 한다.
const ROUND_TIME   = 75;      // 한 판 길이(초)
const DASH_SPEED   = 1650;    // px/s
const DASH_CD      = 0.70;    // 처치 실패 시 대시 쿨타임
const BLOCK_CD     = 1.4;    // 방패에 막혔을 때 페널티 쿨타임
const BLOCK_RECOVER_WINDOW = 0.1; // 막힌 직후 이 시간 안에 재입력하면 쿨타임 없이 재돌진(히든 시스템)
const COMBO_WINDOW = 1.15;   // 이 시간 안에 다음 처치가 없으면 연격 종료
const HIT_R        = 24;      // 돌진 궤적 판정 반경
const HIT_R_ULT    = 92;      // 질풍검 판정 반경
const CHARGE_STEP  = 15;      // 연격 15회마다 질풍검 1충전
const MAX_CHARGE   = 3;
// 질풍참 1스택 — 바라보는 방향으로 검 투사체 발사
const SWORD_COUNT  = 5;
const SWORD_SPREAD = 0.5;   // 부채꼴 전체 각도(rad)
const SWORD_SPEED  = 1100;
const SWORD_R      = 13;
const SWORD_LIFE   = 0.45;
const PLAYER_R     = 15;
const MAX_HP       = 4;
const GUARD_TURN   = 0.75;     // 방패병 정상 상태 회전 속도(rad/s)
const SURVIVAL_SCORE_PER_SEC = 30; // 무한 모드: 생존 1초당 종료 시 가산되는 점수

// 기력 — 빈 공간(회피) 이동에만 소모, 처치 시 회복
const MAX_STAMINA        = 100;
const STAMINA_COST_BASE  = 7;   // 회피 1회 기본 소모량
const STAMINA_COST_STEP  = 2;    // 처치 없이 연속 회피할 때마다 소모량에 더해지는 가중치
const STAMINA_RESTORE_PCT = 0.25; // 처치 시 회복 비율(최대치 대비)
const STAMINA_LOCK_TIME  = 0.5;  // 기력 완전 소진 시 이동 불가 시간
const STAMINA_LOCK_RECOVER = 0.3; // 이동 불가 해제 시 회복되는 비율
const STAMINA_IDLE_DELAY = 0.8;  // 이 시간 이상 가만히 있으면 기력 자동 회복 시작
const STAMINA_REGEN_PER_SEC = 15; // 정지 상태일 때 초당 기력 회복량
const FOLLOW_SPEED = 220;    // 대시 중이 아닐 때 마우스 방향으로 자동 이동하는 속도(px/s)
const MAX_DASH_RANGE = 420;  // 빈 공간 대시(자유 이동)가 갈 수 있는 최대 거리

// 저격수(gunner) — 사거리 안이면 멈춰서 직선 탄환 발사
const GUNNER_RANGE    = 1000;
const GUNNER_COOLDOWN = 2.0;
const BULLET_SPEED    = 420;
const BULLET_R        = 6;
const DASH_PARRY_CHANCE = 1.0; // 돌진 중 탄환 피격 시 패링(무피해) 확률 (임시 테스트용 100%)
const DASH_BULLET_R_MULT = 0.5; // 돌진 중 탄환 피격 판정 반경 배율(체감 완화)

// 회복충(healer) — 처치 시 회복 아이템 드롭
const HEAL_LIFE = 7;
const HEAL_R    = 20;

// 보스 공통 — 일반 모드는 75초 시점에 1회, 무한 모드는 랜덤 간격으로 등장.
// 보스별 스탯·패턴은 bd-boss-*.js에서 BOSS_TYPES에 등록한다(여긴 모드 공통 수치만).
const BOSS_HIT_DMG   = 1;   // 일반 히트당 피해
const BOSS_ULT_DMG   = 3;   // 질풍검 히트당 피해
const BOSS_HIT_STAMINA_RESTORE = 10; // 보스 타격 1회당 기력 회복량
const BOSS_SCORE_BONUS  = 50000; // 무한 모드: 처치 시 추가 점수
const BOSS_CHARGE_BONUS = 3;     // 무한 모드: 처치 시 추가 질풍검 충전
const BOSS_INTERVAL_MIN = 40; // 무한 모드: 다음 보스까지 최소 대기(초)
const BOSS_INTERVAL_MAX = 90; // 최대 대기(초)

// 무한 모드 진화 — 보스 처치마다 세 범주(먹덩이/저격수/방패병) 중 하나가 랜덤으로 1마리씩 누적된다(체력 강화 없음)
const EVO_CATEGORIES = ["slime","gunner","guardian"];
const EVO_TIME_MIN = 30, EVO_TIME_MAX = 60; // 시간 경과에 따른 진화 개체 등장 주기(초)
const EVO_SLIME_RANGE = 260;    // 이 거리 안이면 돌진 시도
const EVO_SLIME_CHANCE = 0.3;   // 판정 주기마다 돌진할 확률
const EVO_SLIME_INTERVAL = 1.2; // 돌진 판정 주기(초)
const EVO_SLIME_SPEED_MULT = 6; // 돌진 중 속도 배율
const EVO_SLIME_DUR = 0.6;      // 돌진 지속(초)
const EVO_GUNNER_TURN = 2.2;    // 커브탄 초당 회전량(rad/s)
const EVO_GUARDIAN_RANGE = 60;  // 내려찍기 사거리(방패병 반경 기준 가산)
const EVO_GUARDIAN_WIND = 0.5;  // 내려찍기 예비동작(초)
const EVO_GUARDIAN_CD = 3.0;    // 내려찍기 재사용 대기(초)
const GUNNER_MAX_ALIVE = 10;    // 저격수 동시 생존 마릿수 상한

// 산탄총 — 근접 사거리 안이면 멈춰서 3발 부채꼴 발사
const SHOTGUN_RANGE = 160;
const SHOTGUN_COOLDOWN = 1.8;
const SHOTGUN_SPREAD = 0.7;  // 부채꼴 전체 각도(rad)

// 충전병 — 필드(화면)에 보이면 충전 시작, 충전 완료 시 가로 빔 발사. 필드에 1마리만, 처치 후 대기 시간 뒤 재등장.
const CHARGER_CHARGE_TIME = 5;   // 충전 시간(초)
const CHARGER_BEAM_DUR = 3;      // 빔 지속 시간(초)
const CHARGER_RESPAWN_DELAY = 20; // 처치 후 재등장까지 대기(초)
const CHARGER_BEAM_THICK = 46;   // 빔 두께(px)

// 무한 모드: 산탄총/충전병이 등장하기 시작하는 시점(초). 일반 모드는 시간 제한 없이 처음부터 등장.
const INFINITE_NEW_ENEMY_DELAY = 45;

const TYPES = {
  slime:    {r:19, spd:47,  score:100, color:"#7C8AA8", name:"먹덩이"},
  swift:    {r:14, spd:146, score:210, color:"#E0453A", name:"질풍조"},
  guardian: {r:22, spd:40,  score:320, color:"#35A88F", name:"방패병"},
  bomber:   {r:20, spd:66,  score:170, color:"#E8B84B", name:"폭탄충"},
  gunner:   {r:17, spd:34,  score:260, color:"#8B5FBF", name:"저격수"},
  healer:   {r:15, spd:64,  score:140, color:"#8ED08B", name:"회복충"},
  shotgun:  {r:18, spd:60,  score:230, color:"#D97A3D", name:"산탄총"},
  charger:  {r:26, spd:50,  score:400, color:"#4FC3F7", name:"충전병"}
};

const rnd = (a,b)=>a+Math.random()*(b-a);
const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const dist = (ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
function angDiff(a,b){ let d=(a-b+Math.PI)%(Math.PI*2); if(d<0)d+=Math.PI*2; return d-Math.PI; }
function segDist(ax,ay,bx,by,px,py){
  const dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy;
  if(l2 < 1e-6) return dist(ax,ay,px,py);
  let s = ((px-ax)*dx + (py-ay)*dy)/l2; s = clamp(s,0,1);
  return dist(ax+dx*s, ay+dy*s, px, py);
}
// 가중치 기반 추첨 — {key: weight, ...} 중 하나의 key를 무작위로 고른다
function weightedPick(weights){
  let total = 0;
  for(const k in weights) total += weights[k];
  let r = Math.random() * total;
  for(const k in weights){
    r -= weights[k];
    if(r <= 0) return k;
  }
}
