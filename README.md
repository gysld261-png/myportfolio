# DRY ICE — 박효민 퍼스널 포트폴리오

> 조용하지만 멈춰 있지 않은 사람을 드라이아이스의 상태 변화로 번역한다.

드라이아이스처럼 **생긴** 사이트가 아니라 드라이아이스처럼 **행동하는** 사이트.

## 실행

```bash
npm install
npm run dev
```

## 구조

```
src/
├─ data/specimens.js     SPECIMEN 01–04 폴리곤 + 승화 규칙 + FIELD 배치
├─ lib/field.js          캔버스 인터랙션 엔진 (React 밖, rAF)
├─ styles/tokens.css     Figma 'DRY ICE' 변수와 1:1 대응
├─ components/           Nav · StateReadout · Ticks
└─ sections/             Main · About · Portfolio · ProjectDetail
```

## 상태 머신

| 섹션 | 상태 | 사용자 질문 |
|---|---|---|
| INTRO | NUCLEATION | 어떤 세계로 들어가는가 |
| MAIN | SOLID | 누구인가 |
| ABOUT ME | SUBLIMATION | 어떤 사람인가 |
| PORTFOLIO | FIELD | 무엇을 만들었나 |
| PROJECT DETAIL | SELECTED → READ | 어떻게 만들었나 |

화면은 세로로 이어진 문서가 아니라 한 번에 하나만 렌더링되는 고정 장면이다.
`MAIN → ABOUT`만 휠/스와이프로 전환하고, `PORTFOLIO`는 상단 탭으로 진입한다.
Portfolio 안의 휠은 페이지 이동이 아니라 specimen 탐색에 사용한다.

MAIN의 휠은 즉시 화면을 바꾸지 않는다. 누적 스크롤을 `0–100%` 승화 진행도로
매핑해 thermal boundary, 3D 고체 밀도, 입자 확산, 타이포 해체를 함께 제어한다.
위로 되감으면 다시 응집하고, 100%에 도달한 뒤에만 ABOUT 장면으로 넘어간다.

오브젝트 단위는 3단계만 갖는다 — `SOLID → SUBLIMATING(hover) → DISSOLVE(click)`.

## 인터랙션 규칙

커서를 **환경 변화 요인(HEAT)** 으로 정의한다.

| 입력 | 반응 |
|---|---|
| 320px 밖 | 정지에 가까움 |
| 80~320px | 입자량·표면 명암 점진 증가 |
| 0~80px | 경계 distortion, 메타데이터 reveal |
| click | 짧고 강한 승화 후 Selected |
| leave | 재응집, 기본 상태 복귀 |

커서 **속도**는 TEMP 가 되고, TEMP 는 입자량이 아니라 **복귀 속도**에 매핑된다.
빠르게 움직일수록 승화 상태가 더 오래 유지된다. 값은 `lib/field.js`의 `DEFAULT_SETTINGS`.

## SPECIMEN — 형태만이 아니라 반응 방식까지 다르다

| | 시작 | 잔존 |
|---|---|---|
| 01 ODIT | 바깥 가지 끝 | 중앙 Core 하나만 선명하게 |
| 02 TCHAIKIM | 윤곽선 전체 동시 | 실루엣 그대로, 밀도만 낮아짐 |
| 03 문화누리카드 | 단 한 점 | 덩어리는 그대로, 시작점만 패임 |
| 04 왈가왈봇 | 결정 6개에서 각각 | 조각들이 살짝 벌어진 채 |

## 하지 않을 것

- 상시 재생되는 연무 배경 — 연무는 사용자가 움직이는 순간에만
- 프로젝트 고유 컬러를 Field 오브젝트에 입히는 것 — Detail 에서만 등장
- 기본 커서를 완전히 숨기는 것
- 실제 온도 수치 노출 — `LOW · MID · HIGH` 3단계 라벨만

## 접근성

- 키보드 focus 는 hover 와 동일한 정보 상태를 제공한다
- `prefers-reduced-motion` 에서는 입자·왜곡을 끄고 opacity 전환으로 대체
- LIST 모드는 장식이 아니라 모든 프로젝트 정보에 도달하는 완전한 대체 경로

## TODO

- [ ] 프로젝트 상세 본문 (Overview → Problem → Research → UX → UI → Development → Result)
- [ ] CONTACT 레이어
- [ ] 모바일 첫 tap reveal / 두 번째 tap 진입
- [ ] 프로젝트 이미지 교체
