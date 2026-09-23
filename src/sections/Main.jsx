import { lazy, Suspense, useCallback, useState } from 'react';
import Ticks from '../components/Ticks';
import FrostEdge from '../components/FrostEdge';
import './main.css';

const IceCubeHero = lazy(() => import('../components/IceCubeHero'));

/**
 * MAIN — SUBLIMATION CHAMBER
 *
 * 역할 분담:
 *   MAIN    온도와 승화 현상을 관찰하는 공간 (얼음의 일부만 걸린다)
 *   PORTFOLIO  이 공간에서 발견한 네 개의 표본
 *   DETAIL     표본 내부의 작업
 *
 * 규칙: 가려지는 것은 물질이지 정보가 아니다.
 * 이름·직무·한 줄 문장은 로드 즉시 완전한 대비로 읽힌다.
 */
/* 히어로 문장. 이름은 이미 상단 nav 에 있다 — 한 화면에 두 번 쓰지 않는다.
   신입 포폴에서 가운데를 차지해야 하는 건 이름이 아니라 "뭘 하는 사람인가" 다. */
const CLAIM = ['흩어진 결정을', '팀이 함께 쓰는', '기준으로 만듭니다'];

export default function Main({ onScrollCue, introEntrance = false, transitionProgress = 0, rewinding = false }) {
  const [cubeReady, setCubeReady] = useState(false);
  const [readout, setReadout] = useState({
    mass: 100,
    heat: 0,
    temp: 'LOW',
    azimuth: 36,
    lit: false,
  });

  const updateReadout = useCallback((next) => setReadout(next), []);
  const sublimating = transitionProgress > 0.01;

  return (
    <section
      className={`screen main ${cubeReady ? 'is-cube-ready' : ''} ${sublimating ? 'is-sublimating' : ''} ${rewinding ? 'is-rewinding' : ''}`}
      id="main"
      style={{
        '--exit': transitionProgress,
        // 글자는 얼음보다 먼저 사라진다 — 0.42 지점에서 이미 다 빠져 있다
        '--exit-opacity': Math.max(0, 1 - transitionProgress / 0.42),
        // 글자는 화면과 같이 내려가지 않는다. 위로 빠져나간다.
        '--exit-shift': `${-Math.min(1, transitionProgress / 0.42) * 118}px`,
        '--exit-blur': `${Math.min(1, transitionProgress / 0.42) * 9}px`,
        '--ticks-opacity': 0.3 * Math.max(0, 1 - transitionProgress / 0.5),
        // 연기는 중반부터 차오른다
        '--fog': Math.max(0, (transitionProgress - 0.22) / 0.78),
      }}
    >
      <Ticks />

      <Suspense fallback={<div className="ice-cube-hero ice-cube-hero--loading" />}>
        <IceCubeHero
          initialEntrance={introEntrance}
          exitProgress={transitionProgress}
          onReadout={updateReadout}
          onReady={setCubeReady}
        />
      </Suspense>

      <FrostEdge paused={sublimating} />

      {/* 얼음이 커지는 동안 그 자리에서 연기가 차올라 화면을 덮는다 */}
      <div className="main__vapor" aria-hidden="true" />

      {/* ── 정보층 — 어떤 상태에서도 가려지지 않는다 ── */}
      <div className="main__type">
        <p className="sys main__eyebrow">IDENTITY / SPECIMEN 00</p>
        {/* 한 줄씩 아래에서 올라온다 — 마스크 안에서 밀려 올라오는 방식 */}
        <h1 className="main__claim">
          {CLAIM.map((line, i) => (
            <span className="claimline" key={line} style={{ '--i': i }}>
              <i>{line}</i>
            </span>
          ))}
        </h1>
        <p className="sys main__role">
          UX/UI DESIGNER
          <br />
          FRONTEND DEVELOPER
        </p>
        <p className="main__lead">
          조용하지만 멈춰 있지 않은 사람을
          <br />
          드라이아이스의 상태 변화로 번역한다
        </p>
      </div>

      {/* ── 관찰 계기 — 마우스가 없어도 스스로 변한다 ── */}
      <div className="instrument" aria-hidden="true">
        <p className="instrument__head sys">OBSERVATION / CHAMBER 01</p>
        <dl className="instrument__grid sys">
          <div>
            <dt>STATE</dt>
            <dd>{sublimating || readout.heat > 0.16 ? 'SUBLIMATING' : 'SOLID'}</dd>
          </div>
          <div>
            <dt>TEMP</dt>
            <dd>{sublimating ? 'HIGH' : readout.temp}</dd>
          </div>
          <div>
            <dt>MASS</dt>
            <dd>{readout.mass.toFixed(1)}<i>%</i></dd>
          </div>
          <div className={readout.lit ? 'is-live' : ''}>
            <dt>LUMEN AZ</dt>
            <dd>{readout.azimuth > 0 ? '+' : ''}{readout.azimuth}<i>°</i></dd>
          </div>
        </dl>
        <div className="instrument__track">
          <span style={{ width: `${Math.round(Math.max(readout.heat, transitionProgress) * 100)}%` }} />
        </div>
      </div>

      <p className="main__hint sys" aria-hidden="true">
        MOVE TO EXPLORE · DRAG TO TURN · SCROLL TO ENTER
      </p>

      <div
        className="main__thermal"
        style={{ bottom: `${transitionProgress * 100}%` }}
        aria-hidden="true"
      >
        <span className="sys">THERMAL BOUNDARY / {Math.round(transitionProgress * 100)}%</span>
      </div>

      <button type="button" className="main__scroll sys" onClick={onScrollCue}>
        ENTER THE FISSURE <span className="main__scroll-line" />
      </button>
    </section>
  );
}
