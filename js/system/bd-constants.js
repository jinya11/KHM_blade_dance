"use strict";
// 상수 · 순수 유틸리티 — 밸런스 수치(적 스탯, 대시 속도 등)와 rnd/clamp/dist/각도 계산처럼
// 다른 모든 bd-*.js 파일이 전역으로 참조하는 값과 함수를 모아둔 파일. 가장 먼저 로드되어야 한다.
const ROUND_TIME   = 75;      // 일반모드- 한 판 길이(초)
const DASH_SPEED   = 1650;    // px/s
const DASH_CD      = 0.70;    // 처치 실패 시 대시 쿨타임
const BLOCK_CD     = 1.4;    // 방패에 막혔을 때 페널티 쿨타임
const BLOCK_RECOVER_WINDOW = 0.1; // 막힌 직후 이 시간 안에 재입력하면 쿨타임 없이 재돌진(히든 시스템)
const COMBO_WINDOW = 1.4;   // 이 시간 안에 다음 처치가 없으면 연격 종료
const HIT_R        = 24;      // 돌진 궤적 판정 반경
const HIT_R_ULT    = 92;      // 질풍검 판정 반경
const CHARGE_STEP  = 12;      // 연격 12회마다 질풍검 1충전
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

// 귀풍참 — 질풍참과 충전(charges)을 공유하는 대체 스킬군. 마우스 휠 클릭으로 원형 UI를 열어 전환한다.
const SKILL_SWAP_CD = 15;       // 스킬군 전환 재사용 대기(초)
const WHEEL_UI_IDLE_CLOSE = 5;  // 원형 UI: 조작 없이 지나면 자동으로 닫히는 시간(초, 실시간 기준)
const WHEEL_UI_SLOWMO = 0.5;    // 원형 UI가 떠 있는 동안 게임 진행 속도 배율
const RECALL_DELAY = 5;         // 귀환식: 마킹 후 순간이동까지 대기(초)
const RECALL_SLAM_R = 70;       // 귀환식 착지 내려찍기 판정 반경
const VORTEX_PULL_R = 220, VORTEX_PULL_DUR = 2.2, VORTEX_PULL_SPEED = 160; // 흡풍식
const VORTEX_PUSH_DUR = 1.6; // 광풍식 — 판정은 시전 즉시 전체 적용, 회오리는 시각 효과 지속시간만 담당

// 저격수(gunner) — 사거리 안이면 멈춰서 직선 탄환 발사
const GUNNER_RANGE    = 1000;
const GUNNER_COOLDOWN = 2.0;
const BULLET_SPEED    = 320;
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

// 무한 모드 진화 — 시간 경과·보스 처치마다 한 범주씩 진화 단계가 1씩 오른다(최대 5단계, 질풍조·회복충 제외)
const EVO_CATEGORIES = ["slime","guardian","bomber","gunner","shotgun","charger"];
const MAX_EVO_STAGE = 5;
const EVO_MAX_STAGE_OVERRIDE = {guardian:4}; // 방패병은 5단계(근위대장) 삭제 — 4단계까지만
const EVO_TIME_MIN = 14, EVO_TIME_MAX = 26; // 시간 경과에 따른 진화 단계 상승 주기(초) — 기존 30~60에서 단축
const EVO_SPAWN_CHANCE = 0.35;  // 해당 범주 스폰 시 진화개체로 나올 확률
const EVO5_HP = {slime:5, bomber:4, gunner:4, shotgun:5, charger:7}; // 5단계(다타형)만 적용되는 피격 횟수 — 방패병은 5단계가 없으므로 제외
const EVO_SLIME_RANGE = 260;    // 이 거리 안이면 돌진 시도
const EVO_SLIME_CHANCE = 0.3;   // 판정 주기마다 돌진할 확률
const EVO_SLIME_INTERVAL = 1.2; // 돌진 판정 주기(초)
const EVO_SLIME_SPEED_MULT = 6; // 돌진 중 속도 배율
const EVO_SLIME_DUR = 0.6;      // 돌진 지속(초)
const EVO_SLIME_ACID_DUR = 4;   // 2단계: 산성웅덩이 지속시간(초)
const EVO_SLIME_ACID_R = 46;    // 2단계: 산성웅덩이 반경
const EVO_SLIME_ACID_START_CD = .5; // 2단계: 생성 직후 첫 피해까지 유예시간(초)
const EVO_SLIME_ACID_TICK = 1.3;    // 2단계: 피해 판정 간격(초) — 기존 0.8은 너무 빨랐음
const EVO_SLIME_SPLIT_HP_MULT = 0.5; // 3단계: 분열 미니의 접촉피해 발동 확률(체감상 "절반 데미지")
const EVO_SLIME_SLOW_DUR = 2.5; // 4단계: 슬로우 트레일 지속시간(초)
const EVO_SLIME_SLOW_R = 32;    // 4단계: 슬로우 트레일 반경
const EVO_SLIME_ABSORB_RANGE = 180; // 5단계: 흡수 범위
const EVO_SLIME_ABSORB_CD = 2.2;    // 5단계: 흡수 판정 주기(초)
const EVO_GUNNER_TURN = 1.3;    // 커브탄 초당 회전량(rad/s) — 기존 2.2보다 유도 성능을 낮췄다
const EVO_GUNNER_RANGE2_MULT = 0.55; // 2단계: 사거리 축소 배율
const EVO_GUNNER_SNIPE_TELEGRAPH = 0.4; // 3단계: 저격샷 레이저 예고 시간(초)
const EVO_GUNNER_SNIPE_RANGE_MULT = 1.6; // 3단계: 사거리 확장 배율
const EVO_GUNNER_SNIPE_SPEED = 620; // 3단계: 저격샷 탄속
const EVO_GUNNER_FLEE_RANGE = 220;  // 4단계: 이 거리 안으로 다가오면 후퇴 판정
const EVO_GUNNER_FLEE_CHANCE = 0.5; // 4단계: 판정 주기마다 후퇴할 확률
const EVO_GUNNER_MARK_DUR = 4;      // 5단계: 표식 지속시간(초)
const EVO_GUARDIAN_RANGE = 60;  // 내려찍기 사거리(방패병 반경 기준 가산)
const EVO_GUARDIAN_WIND = 0.5;  // 내려찍기 예비동작(초)
const EVO_GUARDIAN_CD = 3.0;    // 내려찍기 재사용 대기(초)
const EVO_GUARDIAN_KNOCKBACK = 140; // 2단계: 반격 넉백 거리(px, 기존 46 대비 강화)
const EVO_GUARDIAN_WALL_CD = 6;     // 3단계: 이동벽 재사용 대기(초)
const EVO_GUARDIAN_WALL_DUR = 3;    // 3단계: 이동벽 지속시간(초)
const EVO_GUARDIAN_WALL_LEN = 140;  // 3단계: 이동벽 길이(px)
const EVO_GUARDIAN_SPIN_R = 100;    // 4단계: 회전베기 판정 반경
const EVO_BOMBER_R1 = 150;      // 1단계: 폭발 반경(기존 118 대비 확대)
const EVO_BOMBER_SHRAPNEL = 8;  // 2단계: 파편탄 개수
const EVO_BOMBER_LUNGE_SPEED = 520; // 3단계: 유도판 돌진 속도
const EVO_BOMBER_LUNGE_TIME = 0.3;  // 3단계: 유도판 돌진 시간(초)
const EVO_BOMBER_CHAIN_DELAY = 0.45; // 4단계: 2차 폭발까지 대기(초)
const EVO_BOMBER_NUKE_DELAY = 0.8;   // 5단계: 예고 후 폭발까지 대기(초)
const EVO_BOMBER_NUKE_R = 260;       // 5단계: 초광역 폭발 반경
const GUNNER_MAX_ALIVE = 10;    // 저격수 동시 생존 마릿수 상한

// 산탄총 — 근접 사거리 안이면 멈춰서 3발 부채꼴 발사
const SHOTGUN_RANGE = 160;
const SHOTGUN_COOLDOWN = 1.8;
const SHOTGUN_SPREAD = 0.7;  // 부채꼴 전체 각도(rad)
const EVO_SHOTGUN_WIDE_SPREAD = 1.15; // 1단계: 기존보다 넓게 퍼지는 부채꼴 각도(rad)
const EVO_SHOTGUN_KNOCKBACK = 220; // 2단계: 넉백탄이 밀어내는 거리
const EVO_SHOTGUN_DOUBLE_GAP = 0.18; // 3단계: 이중발사 두 번째 사격까지 간격(초)
const EVO_SHOTGUN_LUNGE_SPEED = 480; // 4단계: 근접도약 속도
const EVO_SHOTGUN_LUNGE_RANGE = 260; // 4단계: 도약을 시작하는 사거리
const EVO_SHOTGUN_ADJACENT_R = 40;   // 5단계: 이 거리 이내면 전방위탄으로 대체 발사

// 충전병 — 필드(화면)에 보이면 충전 시작, 충전 완료 시 가로 빔 발사. 필드에 1마리만, 처치 후 대기 시간 뒤 재등장.
const CHARGER_CHARGE_TIME = 5;   // 충전 시간(초)
const CHARGER_BEAM_DUR = 3;      // 빔 지속 시간(초)
const CHARGER_RESPAWN_DELAY = 20; // 처치 후 재등장까지 대기(초)
const EVO_CHARGER_TRACK_SPEED = 60;  // 3단계: 충전 중 조준 y좌표가 플레이어 쪽으로 이동하는 속도(px/s)
const EVO_CHARGER_DUAL_GAP = 90;     // 4단계: 2갈래 빔 사이 간격(px)
const EVO_CHARGER_FAST_CHARGE_MULT = 0.6; // 4단계: 충전시간 배율
const EVO_CHARGER_RESIDUE_N = 5;     // 5단계: 잔류장 개수
const EVO_CHARGER_RESIDUE_DUR = 1.2; // 5단계: 잔류장 지속시간(초)
const CHARGER_BEAM_THICK = 46;   // 빔 두께(px)
const EVO_CHARGER_WIDE_THICK = 76; // 1단계: 기존보다 넓은 가로빔 두께(px)

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
  charger:  {r:26, spd:50,  score:400, color:"#4FC3F7", name:"충전병"},
  dummy:    {r:20, spd:0,   score:0,   color:"#9C947F", name:"허수아비"}
};
const TRAINING_SPAWNABLE = ["slime","swift","guardian","bomber","gunner","healer","shotgun","charger"];

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
