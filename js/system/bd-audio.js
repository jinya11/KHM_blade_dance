"use strict";
// 오디오 — 음원 파일 없이 WebAudio 오실레이터로 실시간 합성한 효과음(sfx) 모음.
let AC = null;
function ac(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function tone(freq, dur, type, vol, slideTo){
  const a = ac(); if(!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || "sine"; o.frequency.value = freq;
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30,slideTo), a.currentTime + dur);
  g.gain.value = vol || .12;
  g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
/** 백색 잡음을 대역통과 필터로 걸러 만드는 바람 소리. toFreq를 주면 필터 주파수가 그쪽으로 휩쓴다. */
function noise(dur, vol, freq, toFreq){
  const a = ac(); if(!a) return;
  const buf = a.createBuffer(1, a.sampleRate*dur, a.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
  const src = a.createBufferSource(); src.buffer = buf;
  const filt = a.createBiquadFilter(); filt.type = "bandpass"; filt.frequency.value = freq;
  if(toFreq) filt.frequency.exponentialRampToValueAtTime(toFreq, a.currentTime + dur);
  const g = a.createGain(); g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + dur);
  src.connect(filt).connect(g).connect(a.destination); src.start(); src.stop(a.currentTime + dur);
}
const sfx = {
  dash:  ()=>noise(.14, .1, 2000, 500),
  kill:  (n)=>{ noise(.09, .2, 3400); tone(1500 + Math.min(n,24)*30, .08, "triangle", .05, 650); },
  galeKill: ()=>noise(.18, .09, 1800, 600), // 질풍검 처치 — 스쳐 지나가는 듯한 작은 바람 소리
  kwiKill:  ()=>{ noise(.26, .16, 500, 2200); tone(300, .22, "sine", .06, 700); }, // 귀풍검 처치 — 모여드는 듯한 중간 크기 바람 소리
  ult:   ()=>{tone(180,.34,"sawtooth",.09,900); tone(1200,.22,"triangle",.05,300);},
  block: ()=>tone(120, .20, "sawtooth", .12, 60),
  hurt:  ()=>tone(210, .34, "sine", .14, 70),
  boom:  ()=>tone(90, .30, "sawtooth", .11, 40),
  shot:  ()=>tone(560, .10, "sawtooth", .06, 260),
  heal:  ()=>{tone(520,.14,"sine",.08,760); tone(760,.16,"triangle",.05,1020);},
  end:   ()=>{tone(520,.5,"sine",.09,140);}
};
