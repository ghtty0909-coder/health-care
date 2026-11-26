// MediaPipe Pose Landmarker 래퍼 — 모델과 wasm은 앱 안에 포함 (오프라인 동작)
import { FilesetResolver, PoseLandmarker } from '../vendor/vision_bundle.mjs';

let landmarker = null;
let delegateUsed = null;

export async function initPose(onStatus = () => {}) {
  if (landmarker) return landmarker;
  onStatus('AI 모델 불러오는 중…');
  const fileset = await FilesetResolver.forVisionTasks(new URL('../vendor/wasm', import.meta.url).href);
  const base = {
    baseOptions: { modelAssetPath: new URL('../models/pose_landmarker_full.task', import.meta.url).href },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  for (const delegate of ['GPU', 'CPU']) {
    try {
      landmarker = await PoseLandmarker.createFromOptions(fileset, { ...base, baseOptions: { ...base.baseOptions, delegate } });
      delegateUsed = delegate;
      break;
    } catch (e) {
      console.warn('delegate 실패', delegate, e);
    }
  }
  if (!landmarker) throw new Error('AI 모델을 시작하지 못했어요.');
  return landmarker;
}

export function getDelegate() { return delegateUsed; }

function toFrame(result, t, aspect) {
  const lm = result.landmarks && result.landmarks[0];
  if (!lm) return { t, p: null };
  return { t, p: lm.map((q) => ({ x: q.x * aspect, y: q.y, v: q.visibility ?? 1 })) };
}

let lastTs = 0;
function nextTs(ms) { lastTs = Math.max(lastTs + 1, Math.round(ms)); return lastTs; }

// 영상 전체를 훑으며 관절 좌표 추출
// mode: 'play'(재생하며 분석, 빠름) | 'seek'(프레임 단위 이동, 느리지만 정확)
export async function processVideo(video, { onProgress = () => {}, isCancelled = () => false, mode = 'play', fps = 15 } = {}) {
  const lmk = await initPose();
  const aspect = video.videoWidth / video.videoHeight;
  const duration = video.duration;
  const frames = [];

  // 워밍업: 첫 인식은 GPU 초기화로 오래 걸리므로 재생 전에 미리 한 번 실행
  await seekTo(video, 0);
  lmk.detectForVideo(video, nextTs(0));
  lmk.detectForVideo(video, nextTs(0));

  if (mode === 'play' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    try {
      return await playMode(video, lmk, aspect, duration, frames, onProgress, isCancelled);
    } catch (e) {
      console.warn('재생 분석 실패, 프레임 이동 방식으로 전환', e);
      frames.length = 0;
    }
  }

  const step = Math.max(1 / fps, duration / 900);
  video.pause();
  for (let t = 0; t < duration; t += step) {
    if (isCancelled()) throw new Error('cancelled');
    await seekTo(video, t);
    const res = lmk.detectForVideo(video, nextTs(t * 1000 + 1));
    frames.push(toFrame(res, t, aspect));
    onProgress(t / duration);
  }
  onProgress(1);
  return { frames, aspect };
}

function seekTo(video, t) {
  return new Promise((resolve) => {
    const done = () => { video.removeEventListener('seeked', done); resolve(); };
    video.addEventListener('seeked', done);
    video.currentTime = t;
  });
}

function playMode(video, lmk, aspect, duration, frames, onProgress, isCancelled) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.pause();
      onProgress(1);
      resolve({ frames, aspect });
    };
    // 워밍업 때 잰 속도로 시작 속도 결정
    const w0 = performance.now();
    lmk.detectForVideo(video, nextTs(0));
    let ema = performance.now() - w0; // 프레임당 인식 시간(ms) 평균
    video.playbackRate = Math.max(0.1, Math.min(1, 1000 / (ema * 12 * 1.3)));
    const onFrame = (now, meta) => {
      if (finished) return;
      if (isCancelled()) { finished = true; video.pause(); reject(new Error('cancelled')); return; }
      const t = meta.mediaTime;
      const t0 = performance.now();
      const res = lmk.detectForVideo(video, nextTs(t * 1000 + 1));
      ema = ema * 0.8 + (performance.now() - t0) * 0.2;
      // 느린 기기에서도 영상 1초당 약 12프레임은 분석하도록 재생 속도 자동 조절
      const rate = Math.max(0.1, Math.min(1, 1000 / (ema * 12 * 1.3)));
      if (Math.abs(video.playbackRate - rate) > 0.05) video.playbackRate = rate;
      frames.push(toFrame(res, t, aspect));
      onProgress(t / duration);
      if (!video.ended) video.requestVideoFrameCallback(onFrame);
    };
    video.addEventListener('ended', () => setTimeout(finish, 50), { once: true });
    video.muted = true;
    video.requestVideoFrameCallback(onFrame);
    video.play().catch((e) => { finished = true; reject(e); });
    // 너무 적은 프레임이 잡히면(느린 기기) 실패로 간주하지 않고 그대로 사용
  });
}

// 스켈레톤 그리기용 연결선
export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32],
];
