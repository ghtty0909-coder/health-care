# 렙체크 AI 빌드·출시 안내서

이 문서만 따라 하면 내 폰에 앱을 설치하고 원스토어에 제출할 수 있어요. 막히는 단계가 있으면 **화면 캡처나 오류 메시지 전체**를 보내주세요.

---

## 0. 전체 흐름 한눈에 보기

| 단계 | 할 일 | 예상 시간 |
|---|---|---|
| 1 | 프로그램 설치 (Node.js, Git, Android Studio) | 40분~1시간 (대부분 다운로드 대기) |
| 2 | 코드 받고 준비 명령 실행 | 10분 |
| 3 | Android Studio로 열고 내 폰에 설치 | 30분~1시간 (첫 Gradle 동기화가 오래 걸림) |
| 4 | 헬스장 영상으로 테스트 | 1~2시간 × 2번 |
| 5 | 서명된 릴리스 APK 만들기 | 20분 |
| 6 | 원스토어 가입·등록·제출 | 1~2시간 |

---

## 1. 프로그램 설치 (처음 한 번만)

1. **Node.js LTS** (22 버전 이상): https://nodejs.org → LTS 버튼 → 설치 (옵션은 기본값 그대로)
2. **Git**: https://git-scm.com/downloads → 설치 (기본값 그대로)
3. **Android Studio** (최신 버전): https://developer.android.com/studio → 설치
   - 처음 실행하면 "Standard" 설치를 고르고 SDK 다운로드가 끝날 때까지 기다려요.
   - Android Studio 안에 Java(JDK 21)가 들어 있어서 따로 설치할 필요 없어요.

설치 확인: 명령 프롬프트(cmd) 또는 PowerShell을 새로 열고

```
node -v
git --version
```

버전 숫자가 나오면 성공이에요.

---

## 2. 코드 받기와 준비

```
git clone https://github.com/ghtty0909-coder/health-care.git
cd health-care
npm install
npx cap sync android
```

- `npm install`이 끝나면 MediaPipe 라이브러리와 AI 모델이 `www/` 안으로 자동 복사돼요. ("MediaPipe 라이브러리 복사 완료"가 보이면 정상)
- GitHub 대신 압축 파일(zip)을 받았다면 압축을 풀고 그 폴더에서 `npm install`부터 하면 돼요.

### (선택) PC 브라우저에서 먼저 확인하기

```
npm run serve
```

크롬에서 http://localhost:8080 을 열면 앱 화면을 볼 수 있어요. 안드로이드 빌드 전에 분석이 되는지 빠르게 확인할 때 좋아요. (끝낼 때는 Ctrl+C)

---

## 3. 내 폰에 설치해서 실행하기

1. `npx cap open android` 실행 (또는 Android Studio → Open → `health-care/android` 폴더 선택)
2. 오른쪽 아래에 **Gradle sync** 진행 표시가 끝날 때까지 기다려요. 처음엔 5~15분 걸릴 수 있어요.
3. 폰 준비:
   - 설정 → 휴대전화 정보 → 소프트웨어 정보 → **빌드 번호를 7번** 탭 → 개발자 모드 켜짐
   - 설정 → 개발자 옵션 → **USB 디버깅** 켜기
   - USB로 PC와 연결하고 폰에 뜨는 "USB 디버깅 허용"에서 허용
4. Android Studio 위쪽 기기 목록에 내 폰 이름이 보이면 초록색 ▶(Run) 버튼을 눌러요.
5. 폰에 **렙체크 AI**가 설치되고 바로 실행돼요.

> **코드를 고친 뒤에는** 항상 `npx cap sync android`를 한 번 실행하고 ▶를 다시 눌러야 바뀐 내용이 들어가요.

### 자주 나오는 문제

| 증상 | 해결 |
|---|---|
| `SDK location not found` | Android Studio → File → Project Structure → SDK Location 확인 후 다시 sync |
| `Incompatible Gradle JVM version` / `Unsupported class file major version` | 오류 창의 **Apply compatible Gradle JDK configuration and sync** 클릭. 안 되면 Settings → Build Tools → Gradle → Gradle JDK를 **21**(없으면 Download JDK → 21, Eclipse Temurin)로 선택 후 다시 Sync |
| 폰이 목록에 안 보임 | USB 케이블을 데이터 전송용으로 바꾸고, 폰 알림에서 USB 모드를 "파일 전송"으로 |
| "Play 프로텍트에서 차단" 팝업 | 구글 플레이에 없는 새 앱이라 뜨는 경고예요. **세부정보 → 무시하고 설치** |
| 분석이 너무 느림 | 1분 이내 영상으로 잘라서 올리기. 4K 대신 1080p로 촬영 |

---

## 4. 헬스장 테스트 (기준값 조정용)

종목별로 **실제 횟수를 세면서** 촬영해 주세요. 이 영상들은 최종보고서의 "횟수 정확도 95%, 자세 판정 80%" 검증 자료로도 그대로 쓸 수 있어요.

| 종목 | 촬영 방향 | 찍을 영상 |
|---|---|---|
| 스쿼트 | 측면 | 정상 8회 1세트, 일부러 얕게 앉는 반복 섞은 1세트 |
| 데드리프트 | 측면 | 정상 5회, 엉덩이 먼저 드는 동작 섞은 1세트 |
| 바벨 로우 | 측면 | 정상 8회, 상체 반동 쓰는 1세트 |
| 오버헤드 프레스 | 정면 1세트 + 측면 1세트 | 각 6~8회 |
| 덤벨 컬 | 정면 | 정상 10회, 반동·팔꿈치 들림 섞은 1세트 |
| 사이드 레터럴 레이즈 | 정면 | 정상 12회, 한쪽만 덜 올리는 1세트 |

촬영 팁: 폰을 고정하고(바닥·거치대), 전신이 화면에 다 들어오게, 밝은 곳에서, 다른 사람이 크게 나오지 않게.

결과가 이상하면 **"종목 / 실제 횟수 / 앱이 센 횟수 / 이상한 경고"**를 알려주세요. 기준값을 조정해 드릴게요.

---

## 5. 서명된 릴리스 APK 만들기 (스토어 제출용)

1. `android/app/build.gradle`에서 버전 확인: 첫 제출은 `versionCode 1`, `versionName "1.0"` 그대로 두면 돼요.
   업데이트를 올릴 때마다 `versionCode`를 1씩 올려야 해요 (2, 3, …).
2. Android Studio 메뉴 **Build → Generate Signed App Bundle or APK…**
3. **APK** 선택 → Next
4. Key store path 옆 **Create new…**
   - Key store path: 예) `C:\keys\repcheck.jks` (**프로젝트 폴더 밖, GitHub에 올라가지 않는 곳**)
   - Password: 비밀번호 정하기
   - Alias: `repcheck`, 같은 비밀번호, Validity: **30년**
   - Certificate: First and Last Name에 이름만 넣어도 돼요
5. Next → **release** 선택 → Create
6. 완료 알림의 **locate**를 누르면 `android/app/release/app-release.apk`가 보여요. 이 파일을 원스토어에 올려요.

> ⚠️ **키 파일(.jks)과 비밀번호를 잃어버리면 앱을 영원히 업데이트할 수 없어요.** USB나 클라우드 드라이브에 꼭 백업해 두세요. GitHub에는 올리지 마세요 (`.gitignore`에 이미 막아 뒀어요).

> APK로 먼저 등록하는 걸 추천해요. 원스토어는 APK → AAB 전환은 되지만 AAB → APK는 안 돼요.

---

## 6. 개인정보처리방침 공개 주소 만들기 (GitHub Pages)

1. GitHub 저장소 → **Settings → Pages**
2. Source: **Deploy from a branch**, Branch: **main**, 폴더: **/docs** → Save
3. 1~2분 뒤 `https://ghtty0909-coder.github.io/health-care/privacy.html` 이 열리면 성공
4. 이 주소를 원스토어 등록 화면의 개인정보처리방침 칸(있을 경우)과 판매자 웹사이트 칸에 넣어요.

---

## 7. 원스토어 등록·제출

### 7-1. 개발자 가입 (ONEconsole)
1. https://dev.onestore.co.kr/ 접속 → 회원가입 (만 14세 이상)
2. 국가 **대한민국**, 회원구분 **개인개발자**
3. 이름, 영문 이름, 휴대폰, 이메일, 주소, 생년월일 입력 → 이메일 인증 메일에서 인증

### 7-2. 앱 등록
1. ONEconsole → **앱 등록** (Android)
2. **서비스 구분: 정식 출시** 선택 (⚠️ 베타는 나중에 바꿀 수 없고, 같은 패키지명으로 정식 전환이 안 돼요)
3. 패키지명: `com.repcheck.ai` (APK 안의 값과 같아야 해요)

### 7-3. 앱 정보 입력 (`store/listing.md`의 문구를 복사해서 사용)
| 항목 | 규격 | 준비된 파일 |
|---|---|---|
| 상품제목 | 50자 이내 | listing.md |
| 한줄설명 | 100자 이내 | listing.md |
| 상품설명 | 1,300자 이내 | listing.md |
| 대표 아이콘 | 512×512 PNG | `store/icon-512.png` |
| 그래픽 이미지 | 1024×578 PNG | `store/feature-1024x578.png` |
| 스크린샷 | 2~8장, 장당 1MB 이하, 세로 720×1280 권장 | `store/screenshots/` (실제 폰 캡처로 바꾸면 더 좋아요) |
| 키워드 | 1~10개 | listing.md |
| 판매자 정보 | 이메일, 전화번호, 웹사이트 | 웹사이트에 GitHub Pages 주소 |
| 가격 | 무료 | |

### 7-4. 연령등급
- 콘텐츠 평가 설문(IARC)에서 폭력·선정성·도박·사용자 간 소통·개인정보 공유 질문은 모두 **아니요**
- 원스토어 앱 연령등급은 **전체 이용가**

### 7-5. 바이너리 등록
1. **APK** 선택 → `app-release.apk` 업로드
2. 앱 서명: "직접 서명한 APK" 그대로 등록 (또는 원스토어 안내에 따라 선택)
3. 지원 단말: 기본값(전체) 유지
4. **검증 요청** 클릭 → 상태가 "검증 중"으로 바뀌면 제출 완료

### 7-6. 검증 결과
- 원스토어 문서에 정해진 검수 기간은 없어요. 반려되면 이메일로 결과서가 오니, **받은 내용을 그대로 보내주세요.** 고쳐서 다시 올리면 돼요.
- 승인되면 상태가 "승인"으로 바뀌고 판매(배포)가 시작돼요. 스토어 상품 페이지 캡처를 보고서용으로 꼭 저장해 두세요.

---

## 8. 출시 뒤 할 일 (보고서·발표용)
- 지인 10명 이상 설치·사용 후 설문 (편의성, 결과 유용성 5점 척도)
- 4번 테스트 영상으로 정확도 표 만들기 (실제 횟수 vs 앱 횟수, 정상/비정상 판정)
- 1분 영상 분석 시간 측정 (리포트 상단 정보 참고)
- 원스토어 상품 페이지 캡처, 다운로드 수 캡처

---

## 9. 웹 버전 (아이폰·PC 브라우저용)

- 주소: https://ghtty0909-coder.github.io/health-care/app/ (루트 주소로 들어가도 자동 이동)
- 앱 코드를 고친 뒤 웹 버전도 바꾸려면:
  ```
  npm run build:web
  git add docs/app
  git commit -m "웹 버전 갱신"
  git push
  ```
  1~2분 뒤 GitHub Pages에 반영돼요.
