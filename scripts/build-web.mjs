// www/ 를 GitHub Pages용 docs/app/ 으로 복사 (아이폰 등에서 브라우저로 쓰는 웹 버전)
// 사용: npm run build:web  (먼저 npm install 로 www/vendor 가 준비돼 있어야 함)
import fs from 'fs';
import path from 'path';

const src = 'www';
const dst = 'docs/app';
if (!fs.existsSync(path.join(src, 'vendor', 'vision_bundle.mjs'))) {
  console.error('www/vendor 가 없어요. 먼저 npm install 을 실행하세요.');
  process.exit(1);
}
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('웹 버전 복사 완료 →', dst);
