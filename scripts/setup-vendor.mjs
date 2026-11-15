// MediaPipe 라이브러리·wasm·모델을 www/ 안으로 복사/다운로드 (앱이 오프라인으로 동작하도록)
import { copyFileSync, mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mp = join(root, 'node_modules/@mediapipe/tasks-vision');
const vendor = join(root, 'www/vendor');
mkdirSync(join(vendor, 'wasm'), { recursive: true });
copyFileSync(join(mp, 'vision_bundle.mjs'), join(vendor, 'vision_bundle.mjs'));
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) copyFileSync(join(mp, 'wasm', f), join(vendor, 'wasm', f));
console.log('MediaPipe 라이브러리 복사 완료');

const model = join(root, 'www/models/pose_landmarker_full.task');
if (existsSync(model) && statSync(model).size > 1e6) {
  console.log('포즈 모델 이미 있음');
} else {
  mkdirSync(dirname(model), { recursive: true });
  const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
  console.log('포즈 모델 다운로드 중…');
  const res = await fetch(url);
  if (!res.ok) throw new Error('모델 다운로드 실패: ' + res.status);
  writeFileSync(model, Buffer.from(await res.arrayBuffer()));
  console.log('포즈 모델 다운로드 완료');
}
