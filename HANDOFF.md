# 인수인계 — 박효민 포트폴리오 (2026-10-01 기준)

다음 AI가 바로 이어서 작업할 수 있도록 정리한 문서. 작업 전에 이 문서 → `WORKLOG.md` 마지막 2026-10-01 항목들 → `SCRIPT.md` 순서로 읽는다.

## 저장소·환경
- 저장소: https://github.com/gysld261-png/myportfolio (`main`에 바로 커밋·푸시. 혼자 쓰는 저장소, 브랜치 없음)
- 위치: Mac `~/Desktop/portfolio`, Windows `C:\Users\EZEN\Desktop\portfolio`. 작업 전 항상 `git pull`.
- 실행: `npm install` → `npm run dev` (Vite, http://localhost:5173). 확인은 `npm run build`.
- 스택: React 18 + Vite + Three.js. 디자인 토큰 `src/styles/tokens.css`(배경 #0B0D0E, 포인트 민트 #9DDED7, CONTACT 주황 #F2B27A, 엔딩 바탕 #050708). 글꼴: Instrument Serif + 마루부리(한글), Pretendard Variable.

## 사용자와 일하는 방식 (중요)
- 답변은 한국어. 사용자가 요청한 범위만 수정한다.
- **커밋·푸시는 사용자가 말할 때만.** "수정만 하고 커밋 푸시는 하지 마"라고 하는 경우가 있다.
- 억지로 멋 부린 문장, 대구·말장난, 둥근 카드·캡슐 같은 템플릿 UI는 "AI 같다"며 싫어한다. 담백하고 사실 위주로.
- 시안은 말보다 화면으로. 수정 후 실제 화면을 캡처해 보여 주면 좋다(사용자가 이동 중일 때 캡처를 요청한 적이 있음).
- 사실 확인: ODIT는 **Figma 프로토타입까지만**(프론트엔드 구현 안 함). TCHAIKIM은 **5인** 팀, 이 프로젝트로 부트캠프 최우수상. 왈가왈봇은 5인, 2026.08.26–09.18. 부트캠프 2026.10 수료.

## 오늘 바뀐 구조 (자세한 건 WORKLOG)
- CONTACT: `src/sections/Contact.jsx`, `contact.css`, 온도 훅 `src/lib/useWarmth.js`, 네비 `Nav.jsx`.
- 엔딩 전환: `src/lib/workIceScene.js`(승화 + 가루 `createSublimationDust`, `setEnd`), `src/sections/WorkScroll.jsx`(END_WHEEL·END_GLIDE·END_OMEGA), `src/App.jsx`(applyIris의 `--freeze`·`--lights`, `endingDrawn`), `src/sections/ending.css`, `src/components/EndFreeze.jsx`.
- 엔딩: `src/sections/Ending.jsx`(정거장 STOPS, 자동 넘김, onDrawn, 마지막 장면 SplashCursor), 가루 배치 공유 `src/lib/endingScene.js`(`createGrainField`, `projectEndingGrains`).
- 프로젝트 데이터·문구: `src/data/cases.js`, `src/data/specimens.js`. About 문구·이미지: `src/sections/About.jsx`.

## 남은 일 / 확인 필요
- `PRESENTATION.md`의 엔딩·CONTACT 설명 일부가 예전 구현 기준(서리가 덮임, 스크롤로 진행 등)이다. 현재 구현에 맞게 갱신 필요.
- `SCRIPT.md`는 사용자가 메모장에서 첨삭 중일 수 있다. 첨삭본을 받으면 그대로 반영하고, 시간(목표 9분 30초, 공지 설명 추가로 약 9분 50초)을 확인한다.
- `s02-dev-notes.webp`는 원본 캡처 해상도가 낮다. 더 큰 노션 캡처를 받으면 같은 구성(크림 배경, DEV NOTES, 카드 2장, 팀원 이름 제외)으로 다시 만든다.
- 엔딩 마지막 장면에서 실제 End 키가 미리보기 브라우저에서 안 먹었다(스크립트 키는 정상). 실제 브라우저에서 확인 필요.
- 왈가왈봇 상세 보드 이미지 02에 설문 결과가 이미지로 들어 있다(코드로 못 바꿈, Figma에서 수정 필요할 수 있음).
- 모바일 배치는 계속 손보는 중.
