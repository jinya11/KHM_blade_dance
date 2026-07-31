import { EVT } from '../core/Framework.js';
import { clamp } from '../core/Utils.js';

/**
 * 연격 · 점수 · 질풍검을 하나로 묶은 전투 시스템.
 * 세 값이 '처치'라는 단일 사건에서 함께 갱신되고 서로의 결과에 의존하므로
 * (연격 → 배율 → 점수 → 충전) 한 시스템으로 두는 것이 순서 보장에 유리하다.
 */
export class CombatSystem {
  constructor(bus, config) {
    this._bus = bus;
    this._config = config;

    this.combo = 0;
    this.maxCombo = 0;
    this.comboRemaining = 0;
    this.comboTimerPaused = false;
    this.score = 0;
    this.kills = 0;
    this.charges = 0;
    this._lastRewardedCombo = 0;
  }

  /** 현재 연격 배율. 20연격이면 3.85배. */
  get multiplier() {
    return this.combo <= 0 ? 1 : 1 + (this.combo - 1) * this._config.multiplierPerStack;
  }

  get comboRemainingNormalized() {
    return clamp(this.comboRemaining / this._config.comboWindow, 0, 1);
  }

  get hasCharge() { return this.charges > 0; }

  update(dt) {
    if (this.combo <= 0 || this.comboTimerPaused || dt <= 0) return;
    this.comboRemaining -= dt;
    if (this.comboRemaining <= 0) this.breakCombo();
  }

  /** 적이 죽을 때 Enemy가 호출한다. 이 게임의 점수 계산은 전부 이 한 곳을 지난다. */
  reportKill(enemy, _info) {
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.comboRemaining = this._config.comboWindow;

    const gained = Math.round(enemy.scoreValue * Math.max(1, this.multiplier));
    this.score += gained;
    this.kills += 1;
    this._grantChargeIfReached();

    this._bus.emit(EVT.COMBO_CHANGED, { combo: this.combo, multiplier: this.multiplier });
    this._bus.emit(EVT.SCORE_CHANGED, { total: this.score, gained });
    this._bus.emit(EVT.ENEMY_KILLED, {
      x: enemy.x, y: enemy.y, color: enemy.color, gained, combo: this.combo,
    });
  }

  /** 피격 · 방어당함 · 시간 초과로 연격이 끊길 때. */
  breakCombo() {
    if (this.combo <= 0) {
      this.comboRemaining = 0;
      return;
    }
    const broken = this.combo;
    this.combo = 0;
    this.comboRemaining = 0;
    this._bus.emit(EVT.COMBO_BROKEN, { combo: broken });
    this._bus.emit(EVT.COMBO_CHANGED, { combo: 0, multiplier: 1 });
  }

  /** 돌진 시작 시 강화(질풍검) 여부 결정. */
  tryConsumeCharge() {
    if (this.charges <= 0) return false;
    this.charges -= 1;
    this._emitCharge();
    return true;
  }

  setComboTimerPaused(paused) { this.comboTimerPaused = paused; }

  evaluateGrade() {
    for (const row of this._config.grades) {
      if (this.score >= row.min) return row.grade;
    }
    return '-';
  }

  resetForNewRound() {
    this.combo = 0;
    this.maxCombo = 0;
    this.comboRemaining = 0;
    this.comboTimerPaused = false;
    this.score = 0;
    this.kills = 0;
    this.charges = 0;
    this._lastRewardedCombo = 0;
    this._bus.emit(EVT.COMBO_CHANGED, { combo: 0, multiplier: 1 });
    this._bus.emit(EVT.SCORE_CHANGED, { total: 0, gained: 0 });
    this._emitCharge();
  }

  /** 연격이 일정 수에 도달할 때마다 질풍검 1충전. */
  _grantChargeIfReached() {
    const step = this._config.chargePerCombo;
    if (this.combo % step !== 0 || this.combo === this._lastRewardedCombo) return;
    this._lastRewardedCombo = this.combo;
    if (this.charges >= this._config.maxCharges) return;
    this.charges += 1;
    this._emitCharge();
  }

  _emitCharge() {
    this._bus.emit(EVT.CHARGE_CHANGED, { current: this.charges, max: this._config.maxCharges });
  }
}
