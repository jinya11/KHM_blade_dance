import { Entity, DamageInfo, HitResponse } from './Entity.js';
import { EVT } from '../core/Framework.js';
import { clamp, lerp, toAngle } from '../core/Utils.js';

/**
 * 플레이어와 관련된 모든 것을 담은 클래스.
 * 입력 해석 → 목표 탐색 → 돌진 → 관통 판정 → 피격/무적 까지가 한 덩어리로 묶여 있다.
 * (이 흐름은 서로를 매 프레임 참조하므로 쪼개면 오히려 응집도가 떨어진다)
 *
 * ★ 이 게임의 정체성: 처치에 성공한 돌진은 재사용 대기시간이 0으로 초기화된다.
 */
export class Player extends Entity {
  /**
   * @param {object} services { bus, arena, registry, combat, onPlayerDown }
   * @param {object} config GameConfig.PLAYER
   */
  constructor(services, config) {
    super({ radius: config.radius, maxHealth: config.maxHealth });
    this.services = services;
    this.config = config;

    // ── 돌진 상태 ──
    this.isDashing = false;
    this.empowered = false;
    this.facingRad = 0;
    this.cooldown = 0;
    /** 렌더러가 잔상을 그리기 위해 읽는 최근 위치들. */
    this.trail = [];

    // ── 생존 상태 ──
    this.invulnerabilityTimer = 0;

    // ── 라운드 결산용 통계 ──
    this.dashCount = 0;
    this.successfulDashes = 0;

    this._from = { x: 0, y: 0 };
    this._to = { x: 0, y: 0 };
    this._direction = { x: 1, y: 0 };
    this._elapsed = 0;
    this._duration = 0;
    this._killedThisDash = false;
    this._hitThisDash = new Set();
    this._sweepBuffer = [];
    this._knockbackBuffer = [];
  }

  get canDash() { return !this.isDashing && this.cooldown <= 0; }
  get cooldownNormalized() { return clamp(this.cooldown / this.config.dashCooldownOnMiss, 0, 1); }
  get invulnerable() { return this.invulnerabilityTimer > 0; }
  get accuracy() {
    return this.dashCount > 0 ? Math.round((this.successfulDashes / this.dashCount) * 100) : 0;
  }

  resetForRound(x, y) {
    this.x = x;
    this.y = y;
    this.configureStats(this.config.maxHealth, this.config.radius);
    this.isDashing = false;
    this.empowered = false;
    this.cooldown = 0;
    this._elapsed = 0;
    this._killedThisDash = false;
    this._hitThisDash.clear();
    this.trail.length = 0;
    this.invulnerabilityTimer = 0;
    this.dashCount = 0;
    this.successfulDashes = 0;
    this.services.combat.setComboTimerPaused(false);
    this._emitHealth();
  }

  update(dt) {
    if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer -= dt;

    if (!this.isDashing) {
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
      this._decayTrail(dt);
      return;
    }
    this._advanceDash(dt);
  }

  // ── 입력 처리 ────────────────────────────────
  /**
   * 탭 한 번에 대한 처리.
   * 근처에 적이 있으면 그 적에게 돌진하고, 없으면 그 방향으로 짧게 이동한다.
   */
  handleTap(point) {
    if (!this.canDash) return false;
    const target = this.services.registry.findNearest(point.x, point.y, this.config.tapRadius);
    return this._startDash(point, target);
  }

  // ── 돌진 ─────────────────────────────────────
  _startDash(point, target) {
    const cfg = this.config;
    const origin = { x: this.x, y: this.y };

    let destination;
    if (target) {
      destination = { x: target.x, y: target.y };
    } else {
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;
      const raw = Math.hypot(dx, dy);
      if (raw < 4) return false;
      const length = Math.min(cfg.repositionDistance, raw);
      destination = { x: origin.x + (dx / raw) * length, y: origin.y + (dy / raw) * length };
    }

    destination = this.services.arena.clamp(destination);
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return false;

    this._from = origin;
    this._to = destination;
    this._direction = { x: dx / dist, y: dy / dist };
    this.facingRad = toAngle(dx, dy);
    this._duration = clamp(dist / cfg.dashSpeed, cfg.minDashDuration, cfg.maxDashDuration);
    this._elapsed = 0;
    this._killedThisDash = false;
    this._hitThisDash.clear();
    this.isDashing = true;
    this.dashCount += 1;

    // 목표가 있는 돌진만 질풍검을 소모한다(빈 공간 이동으로 낭비되지 않게).
    this.empowered = !!target && this.services.combat.tryConsumeCharge();

    // 돌진 중에는 연격 타이머를 멈춰 이동 시간이 연격을 깎지 않게 한다.
    this.services.combat.setComboTimerPaused(true);
    this.services.bus.emit(EVT.DASH_STARTED, {
      from: { ...origin }, to: { ...destination }, empowered: this.empowered,
    });
    return true;
  }

  _advanceDash(dt) {
    const prevX = this.x;
    const prevY = this.y;
    this._elapsed += dt;

    const k = this._duration <= 0 ? 1 : clamp(this._elapsed / this._duration, 0, 1);
    const eased = 1 - (1 - k) * (1 - k); // easeOutQuad
    this.x = lerp(this._from.x, this._to.x, eased);
    this.y = lerp(this._from.y, this._to.y, eased);
    this.trail.push({ x: this.x, y: this.y, life: 0, empowered: this.empowered });

    // 이동한 선분 전체를 훑어 관통 판정을 낸다.
    if (this._resolveSweep(prevX, prevY, this.x, this.y)) return;
    if (k >= 1) this._finishDash(false);
    this._decayTrail(dt);
  }

  /** 궤적 위의 적을 처리한다. 방어당해 돌진이 끝났으면 true. */
  _resolveSweep(ax, ay, bx, by) {
    const sweep = this.empowered ? this.config.empoweredHitRadius : this.config.hitRadius;
    this.services.registry.querySegment(ax, ay, bx, by, sweep, this._sweepBuffer);

    for (const enemy of this._sweepBuffer) {
      if (!enemy.alive || this._hitThisDash.has(enemy)) continue;
      this._hitThisDash.add(enemy);

      const response = enemy.applyDamage(DamageInfo.melee(999, this._from, this._direction, {
        empowered: this.empowered,
        ignoresGuard: this.empowered,
      }));

      if (response === HitResponse.BLOCKED) {
        this._reactToBlock();
        return true;
      }
      if (response === HitResponse.KILLED) this._killedThisDash = true;
    }
    return false;
  }

  /** 방패에 막힘: 튕겨나고 연격이 끊기며 대기시간 페널티를 받는다. */
  _reactToBlock() {
    const cfg = this.config;
    const pushed = this.services.arena.clamp({
      x: this.x - this._direction.x * cfg.blockPushback,
      y: this.y - this._direction.y * cfg.blockPushback,
    });
    this.x = pushed.x;
    this.y = pushed.y;

    this.services.combat.breakCombo();
    this.grantInvulnerability(cfg.blockRecoveryInvulnerability);
    this._finishDash(true);
  }

  _finishDash(blocked) {
    this.isDashing = false;
    this.services.combat.setComboTimerPaused(false);

    if (blocked) {
      this.cooldown = this.config.dashCooldownOnBlock;
    } else if (this._killedThisDash) {
      this.cooldown = 0;            // ★ 처치 성공 → 즉시 다시 돌진 가능
      this.successfulDashes += 1;
    } else {
      this.cooldown = this.config.dashCooldownOnMiss;
    }
    this.empowered = false;
  }

  _decayTrail(dt) {
    for (const p of this.trail) p.life += dt;
    while (this.trail.length && this.trail[0].life > this.config.trailLifetime) this.trail.shift();
  }

  // ── 생존 ─────────────────────────────────────
  grantInvulnerability(duration) {
    this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer, duration);
  }

  /** 돌진 중에는 무적. "계속 이어가는 것이 최선의 방어"라는 설계의 핵심. */
  filterDamage(_info) {
    if (this.isDashing || this.invulnerable) return HitResponse.IGNORED;
    return HitResponse.DAMAGED;
  }

  onDamaged(_info) {
    this._reactToHit();
    this._emitHealth();
  }

  onDeath(_info) {
    this._reactToHit();
    this._emitHealth();
    this.services.onPlayerDown?.();
  }

  /** 연격 초기화 + 무적 부여 + 주변 적 밀어내기(포위 상태에서 즉사 방지). */
  _reactToHit() {
    const cfg = this.config;
    this.invulnerabilityTimer = cfg.invulnerabilityDuration;
    this.services.combat.breakCombo();
    this.services.bus.emit(EVT.PLAYER_DAMAGED, { x: this.x, y: this.y });

    this.services.registry.queryCircle(this.x, this.y, cfg.knockbackRadius, this._knockbackBuffer);
    for (const enemy of this._knockbackBuffer) {
      let dx = enemy.x - this.x;
      let dy = enemy.y - this.y;
      if (dx * dx + dy * dy < 1e-4) { dx = 1; dy = 0; }
      enemy.applyKnockback(dx, dy, cfg.knockbackForce);
    }
  }

  _emitHealth() {
    this.services.bus.emit(EVT.HEALTH_CHANGED, { current: this.hp, max: this.maxHealth });
  }
}
