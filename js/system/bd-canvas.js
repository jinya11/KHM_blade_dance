"use strict";
// 캔버스 — canvas/context 참조와 리사이즈(DPR 대응)만 담당. 다른 모든 파일이 쓰는 cv/ctx/W/H를 여기서 만든다.
const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
let W = 800, H = 600, DPR = 1;
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resize);
