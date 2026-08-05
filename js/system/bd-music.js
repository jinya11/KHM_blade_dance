"use strict";
// 타이틀 배경음악 — 곡이 끝나면 일정 텀을 두고 다시 재생하고, 볼륨은 슬라이더(0~100)로 조절해 로컬에 저장한다.
const BGM_LOOP_GAP = 5;                 // 곡이 끝난 뒤 다시 재생하기까지 대기 시간(초)
const BGM_VOLUME_KEY = "bladeDance.bgmVolume";
const bgm = $("bgm"), bgmVolumeEl = $("bgmVolume");

function setBgmVolume(v){
  bgm.volume = clamp(v, 0, 100) / 100;
  bgmVolumeEl.value = v;
  localStorage.setItem(BGM_VOLUME_KEY, v);
}
function playBgm(){ bgm.play().catch(()=>{}); }
function stopBgm(){ bgm.pause(); bgm.currentTime = 0; }

const savedVol = localStorage.getItem(BGM_VOLUME_KEY);
setBgmVolume(savedVol !== null ? Number(savedVol) : 30);
bgmVolumeEl.addEventListener("input", ()=>setBgmVolume(Number(bgmVolumeEl.value)));

bgm.addEventListener("ended", ()=>{
  setTimeout(()=>{ if(state === "title") playBgm(); }, BGM_LOOP_GAP*1000);
});
// 브라우저 자동재생 정책상 사용자 입력 전에는 재생이 막히므로, 첫 입력 시점에 타이틀 화면이면 재생을 시작한다
window.addEventListener("pointerdown", ()=>{ if(state === "title") playBgm(); }, {once:true});

// 훈련장 BGM — 플레이에 지장 없도록 조절 불가한 아주 작은 고정 볼륨으로만 튼다
const TRAINING_BGM_VOLUME = 0.12;
const trainingBgm = $("trainingBgm");
trainingBgm.volume = TRAINING_BGM_VOLUME;
function playTrainingBgm(){ trainingBgm.currentTime = 0; trainingBgm.play().catch(()=>{}); }
function stopTrainingBgm(){ trainingBgm.pause(); trainingBgm.currentTime = 0; }
