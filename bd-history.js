"use strict";
// 과거 점수 기록 — sessionStorage 기반. 모드별로 분리해 상위 5개까지만 보관/표시한다.
const HISTORY_MAX = 5;
const HISTORY_KEYS = { normal:"bladeDance.scoreHistory.normal", infinite:"bladeDance.scoreHistory.infinite" };
const HISTORY_ELS  = { normal:"scoreHistoryNormal", infinite:"scoreHistoryInfinite" };

function loadScoreHistory(m){
  try{ return JSON.parse(sessionStorage.getItem(HISTORY_KEYS[m])) || []; }
  catch(e){ return []; }
}
function saveScoreHistory(m, list){
  try{ sessionStorage.setItem(HISTORY_KEYS[m], JSON.stringify(list)); }
  catch(e){ /* storage unavailable (private mode, quota) — history just won't persist */ }
}
function recordScore(m, finalScore, grade){
  const list = loadScoreHistory(m);
  list.push({score:finalScore, grade});
  list.sort((a,b)=>b.score-a.score);
  list.length = Math.min(list.length, HISTORY_MAX);
  saveScoreHistory(m, list);
}
function renderScoreHistory(){
  for(const m in HISTORY_ELS){
    const box = $(HISTORY_ELS[m]), list = loadScoreHistory(m);
    if(!box) continue;
    box.innerHTML = list.length ? list.map((r,i)=>
      '<div class="history-row">'
        + '<span class="history-rank">'+(i+1)+'</span>'
        + '<span class="history-grade">'+r.grade+'</span>'
        + '<span class="history-score">'+r.score.toLocaleString()+'</span>'
      + '</div>'
    ).join("") : '<p class="history-empty">아직 기록이 없다</p>';
  }
}
