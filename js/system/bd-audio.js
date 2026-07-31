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
const sfx = {
  dash:  ()=>tone(680, .16, "triangle", .07, 240),
  kill:  (n)=>tone(420 + Math.min(n,24)*38, .10, "square", .055, null),
  ult:   ()=>{tone(180,.34,"sawtooth",.09,900); tone(1200,.22,"triangle",.05,300);},
  block: ()=>tone(120, .20, "sawtooth", .12, 60),
  hurt:  ()=>tone(210, .34, "sine", .14, 70),
  boom:  ()=>tone(90, .30, "sawtooth", .11, 40),
  shot:  ()=>tone(560, .10, "sawtooth", .06, 260),
  heal:  ()=>{tone(520,.14,"sine",.08,760); tone(760,.16,"triangle",.05,1020);},
  end:   ()=>{tone(520,.5,"sine",.09,140);}
};
