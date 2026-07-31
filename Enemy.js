import { Entity, DamageInfo, HitResponse } from './Entity.js';
import { AbilityFactory } from './abilities/EnemyAbility.js';
import { clamp, deltaAngle, distance, distancePointToSegment, toAngle, toDirection } from '../core/Utils.js';

/**
 * 모든 적이 공유하는 규칙을 한곳에 모은 클래스.
 * 체력 · 공격 범위 · 접촉 피해 · 점수 · 이동 · 조향 · 넉백 · 겹침 해소 · 사망 처리까지가 공통이고,
 * 종족별 예외는 EnemyAbility로 주입된다(Enemy는 어떤 특수 능력이 있는지 모른다).
 */
export class Enemy extends Entity {
  /**
   * @param {object} definition GameConfig.ENEMY_TYPES 항목
   * @param {object} services { bus, registry, arena, combat, player }
   */
  constructor(definition, services) {
    super({ radius: definition.radius, maxHealth: definition.maxHealth });
    this.definition = definition;
    this.services = services;
    this.abilities = AbilityFactory.create(this, definition, services);

    // ── 이동 상태 (능력이 조절할 수 있게 공개) ──
    this.facingRad = 0;
    /** 0이면 즉시 목표를 바라본다. 값이 있으면 초당 이 라디안만큼만 회전. */
    this.turnRateRad = 0;
    /** 능력이 더하는 좌우 흔들림(라디안). */
    this.lateralOffsetRad = 0;

    this.age = 0;
    this.hitFlash = 0;
    this._attackTimer = 0;
    this._staggerTimer = 0;
    this._knockbackX = 0;
    this._knockbackY = 0;
    this._neighbours = [];
    this._release = null;
  }

  get key() { return this.definition.key; }
  get color() { return this.definition.color; }
  get scoreValue() { return this.definition.scoreValue; }
  get staggered() { return this._staggerTimer > 0; }
  /** 접촉 공격 사거리. 자기 반경 + 상대 반경 + 정의된 여유. */
  get attackRange() {
    const target = this.services.player;
    return this.radius + (target?.radius ?? 0) + this.definition.attackRangePadding;
  }
  /** 0~1 등장 연출 진행도(렌더러가 크기에 사용). */
  get popProgress() { return clamp(this.age / this.definition.spawnPopDuration, 0, 1); }

  /** 스포너가 풀에서 꺼낸 뒤 호출한다. */
  spawn(x, y, releaseCallback) {
    const def = this.definition;
    this.x = x;
    this.y = y;
    this.configureStats(def.maxHealth, def.radius);
    this.age = 0;
    this.hitFlash = 0;
    this._attackTimer = def.spawnAttackDelay;
    this._staggerTimer = 0;
    this._knockbackX = 0;
    this._knockbackY = 0;
    this.turnRateRad = 0;
    this.lateralOffsetRad = 0;
    this._release = releaseCallback;

    const player = this.services.player;
    this.facingRad = toAngle((player?.x ?? x) - x, (player?.y ?? y) - y);

    for (const ability of this.abilities) ability.onSpawn();
    this.services.registry.register(this);
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this._staggerTimer > 0) this._staggerTimer -= dt;

    for (const ability of this.abilities) ability.tick(dt);
    this._move(dt);
    this._tickAttack(dt);
  }

  // ── 이동 ──────────────────────────────────────
  _move(dt) {
    const target = this.services.player;
    if (target) {
      const desired = toAngle(target.x - this.x, target.y - this.y);

      if (this.turnRateRad <= 0) {
        this.facingRad = desired;
      } else {
        const rate = this.turnRateRad * (this.staggered ? 0.25 : 1);
        const diff = deltaAngle(this.facingRad, desired);
        this.facingRad += clamp(diff, -rate * dt, rate * dt);
      }

      // 스폰 직후에는 천천히 들어와 갑자기 덮치지 않게 한다.
      const spawnScale = this.age < 0.3 ? 0.25 : 1;
      const speed = this.definition.moveSpeed * (this.staggered ? 0.25 : 1) * spawnScale;
      const heading = toDirection(desired + this.lateralOffsetRad);
      this.x += heading.x * speed * dt;
      this.y += heading.y * speed * dt;
    }

    if (this._knockbackX !== 0 || this._knockbackY !== 0) {
      this.x += this._knockbackX * dt;
      this.y += this._knockbackY * dt;
      const len = Math.hypot(this._knockbackX, this._knockbackY);
      const k = len > 0 ? Math.max(0, len - 900 * dt) / len : 0;
      this._knockbackX *= k;
      this._knockbackY *= k;
    }

    this._resolveOverlap();
    this.services.arena.clampLoose(this);
  }

  /** 적끼리 완전히 겹쳐 한 덩어리로 보이는 것을 막는다. */
  _resolveOverlap() {
    this.services.registry.queryCircle(this.x, this.y, 70, this._neighbours);
    let pushX = 0;
    let pushY = 0;
    for (const other of this._neighbours) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const d = Math.hypot(dx, dy);
      const min = this.radius + other.radius;
      if (d < 1e-4) { pushX += 0.5; continue; }
      if (d < min) {
        const push = (min - d) * 0.5;
        pushX += (dx / d) * push;
        pushY += (dy / d) * push;
      }
    }
    this.x += pushX;
    this.y += pushY;
  }

  applyKnockback(dirX, dirY, force) {
    const len = Math.hypot(dirX, dirY) || 1;
    this._knockbackX = (dirX / len) * force;
    this._knockbackY = (dirY / len) * force;
  }

  /** 비틀거림. 이동/회전이 크게 느려지고 가드가 풀린다. */
  applyStagger(duration) {
    this._staggerTimer = Math.max(this._staggerTimer, duration);
  }

  // ── 공격 ──────────────────────────────────────
  /** 접촉 공격. 사거리 안에 플레이어가 있고 쿨타임이 끝나면 타격한다. */
  _tickAttack(dt) {
    if (this._attackTimer > 0) {
      this._attackTimer -= dt;
      return;
    }
    const target = this.services.player;
    if (!target || !target.alive) return;
    if (distance(this.x, this.y, target.x, target.y) > this.attackRange) return;

    const response = target.applyDamage(DamageInfo.melee(
      this.definition.contactDamage,
      { x: this.x, y: this.y },
      { x: target.x - this.x, y: target.y - this.y },
    ));

    if (response === HitResponse.IGNORED) return;
    this._attackTimer = this.definition.attackCooldown;
  }

  // ── 피격 ──────────────────────────────────────
  /** 특수 능력에 가드 판정을 위임한다. 하나라도 막으면 BLOCKED. */
  filterDamage(info) {
    if (info.ignoresGuard || info.empowered) return HitResponse.DAMAGED;
    for (const ability of this.abilities) {
      if (ability.allowDamage(info)) continue;
      ability.onBlocked(info);
      return HitResponse.BLOCKED;
    }
    return HitResponse.DAMAGED;
  }

  onDamaged(_info) { this.hitFlash = 0.08; }

  onDeath(info) {
    this.services.registry.unregister(this);
    // 능력 먼저 → 폭발 연쇄가 처치 보고 순서를 지키도록
    for (const ability of this.abilities) ability.onDeath(info);
    this.services.combat.reportKill(this, info);
    this._releaseSelf();
  }

  /** 라운드 초기화 시 스포너가 강제로 정리할 때. */
  forceDespawn() {
    this.services.registry.unregister(this);
    this.hp = 0;
    this._releaseSelf();
  }

  _releaseSelf() {
    const release = this._release;
    this._release = null;
    release?.(this);
  }
}

/**
 * 살아 있는 적의 목록과 공간 질의 담당.
 * 물리 엔진 없이 여기서 원/선분 판정을 처리해 결과를 결정적으로 유지한다.
 */
export class EnemyRegistry {
  constructor() { this._active = []; }

  get active() { return this._active; }
  get count() { return this._active.length; }

  register(enemy) {
    if (!this._active.includes(enemy)) this._active.push(enemy);
  }

  unregister(enemy) {
    const i = this._active.indexOf(enemy);
    if (i >= 0) this._active.splice(i, 1);
  }

  clear() { this._active.length = 0; }

  /** 탭 지점에서 가장 가까운 적. tapRadius는 손가락 오차 보정치. */
  findNearest(x, y, tapRadius) {
    let best = null;
    let bestDist = Infinity;
    for (const e of this._active) {
      if (!e.alive) continue;
      const d = distance(x, y, e.x, e.y);
      if (d > e.radius + tapRadius || d >= bestDist) continue;
      bestDist = d;
      best = e;
    }
    return best;
  }

  /** 선분 AB를 반경 sweepRadius로 스윕했을 때 닿는 적들. */
  querySegment(ax, ay, bx, by, sweepRadius, results = []) {
    results.length = 0;
    for (const e of this._active) {
      if (!e.alive) continue;
      if (distancePointToSegment(ax, ay, bx, by, e.x, e.y) <= e.radius + sweepRadius) results.push(e);
    }
    return results;
  }

  /** 원 범위 안의 적들. 폭발과 넉백에 사용. */
  queryCircle(x, y, range, results = []) {
    results.length = 0;
    for (const e of this._active) {
      if (!e.alive) continue;
      if (distance(x, y, e.x, e.y) <= range + e.radius) results.push(e);
    }
    return results;
  }
}
