/**
 * 부트스트랩: 모든 시스템을 생성하고 배선한다.
 * 시스템끼리 서로를 '찾아오는' 코드는 없다 — 의존성은 전부 이 파일에서 주입된다.
 */
import { ROUND, PLAYER, COMBAT, DIFFICULTY, ENEMY_TYPES, SPAWN_TABLE } from './GameConfig.js';
import { EventBus, Clock, GameLoop, ArenaBounds } from './core/Framework.js';
import { EnemyRegistry } from './entities/Enemy.js';
import { Player } from './entities/Player.js';
import { GameManager, RoundEndReason } from './systems/GameManager.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { FXSystem } from './systems/FXSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { UISystem } from './systems/UISystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { InputSystem } from './systems/InputSystem.js';
// 특수 능력은 import만 해도 AbilityFactory에 자기 자신을 등록한다.
import './entities/abilities/FrontGuardAbility.js';
import './entities/abilities/ExplodeOnDeathAbility.js';
import './entities/abilities/ErraticFlightAbility.js';

const $ = (id) => document.getElementById(id);
const all = (selector) => Array.from(document.querySelectorAll(selector));

function bootstrap() {
  const canvas = $('game');

  // ── 뼈대 ─────────────────────────────
  const bus = new EventBus();
  const clock = new Clock();
  const arena = new ArenaBounds(canvas.clientWidth, canvas.clientHeight);
  const registry = new EnemyRegistry();
  const combat = new CombatSystem(bus, COMBAT);

  // 게임플레이 객체가 받는 의존성 묶음
  const services = { bus, arena, registry, combat, player: null, onPlayerDown: null };

  // ── 게임플레이 ───────────────────────
  const player = new Player(services, PLAYER);
  services.player = player;

  const spawner = new SpawnSystem(services, {
    difficulty: DIFFICULTY,
    spawnTable: SPAWN_TABLE,
    enemyTypes: ENEMY_TYPES,
  });

  const game = new GameManager(
    { bus, clock, arena, registry, combat, spawner, player },
    { roundDuration: ROUND.duration },
  );
  services.onPlayerDown = () => game.endRound(RoundEndReason.PLAYER_DOWN);

  // ── 표현 ─────────────────────────────
  const fx = new FXSystem(bus, { getPlayer: () => player, highComboThreshold: COMBAT.comboStageTwo });
  const renderer = new RenderSystem(canvas, { arena, spawner, player, fx, bus });
  const audio = new AudioSystem(bus);

  new UISystem(bus, {
    score: $('scoreValue'),
    timerFill: $('timerFill'),
    timerLabel: $('timerValue'),
    lifeIcons: all('#lifeBar .life-blade'),
    chargeIcons: all('#chargeBar .charge-gem'),
    comboPillar: $('comboPillar'),
    comboNumber: $('comboNumber'),
    comboWord: $('comboWord'),
    titlePanel: $('titlePanel'),
    hudPanel: $('hudPanel'),
    resultPanel: $('resultPanel'),
    startButton: $('startButton'),
    retryButton: $('retryButton'),
    resultReason: $('resultReason'),
    resultGrade: $('resultGrade'),
    resultScore: $('resultScore'),
    resultMaxCombo: $('resultMaxCombo'),
    resultKills: $('resultKills'),
    resultAccuracy: $('resultAccuracy'),
  }, {
    onStart: () => {
      audio.unlock();
      game.startRound();
    },
  }, {
    comboStageTwo: COMBAT.comboStageTwo,
    comboStageThree: COMBAT.comboStageThree,
  });

  // ── 입력 & 루프 ──────────────────────
  new InputSystem(canvas, { player, clock }).attach();
  renderer.attach();

  const loop = new GameLoop(clock, (dt) => game.update(dt), (dt) => renderer.render(dt));
  game.boot();
  loop.start();
}

document.addEventListener('DOMContentLoaded', bootstrap);
