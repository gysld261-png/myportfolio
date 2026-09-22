import { lazy, Suspense, useCallback, useState } from 'react';
import Ticks from '../components/Ticks';
import FrostEdge from '../components/FrostEdge';
import './main.css';

const SublimationChamber = lazy(() => import('../components/SublimationChamber'));

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
export default function Main({ onScrollCue, introEntrance = false, transitionProgress = 0 }) {
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
      className={`screen main ${sublimating ? 'is-sublimating' : ''}`}
      id="main"
      style={{
        '--exit': transitionProgress,
        '--exit-opacity': 1 - transitionProgress * 0.9,
        '--exit-shift': `${-transitionProgress * 34}px`,
        '--exit-blur': `${transitionProgress * 7}px`,
        '--ticks-opacity': 0.3 * (1 - transitionProgress),
      }}
    >
      <Ticks />

      <Suspense fallback={<div className="chamber chamber--loading" />}>
        <SublimationChamber
          introEntrance={introEntrance}
          exitProgress={transitionProgress}
          onReadout={updateReadout}
        />
      </Suspense>

      <FrostEdge paused={sublimating} />

      {/* ── 정보층 — 어떤 상태에서도 가려지지 않는다 ── */}
      <div className="main__type">
        <p className="sys main__eyebrow">IDENTITY / SPECIMEN 00</p>
        <h1 className="main__name">PARK HYOMIN.</h1>
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
            <dd>{sublimating ? 'SUBLIMATING' : 'SOLID'}</dd>
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
        MOVE TO ANGLE THE LIGHT · SCROLL TO ENTER THE FISSURE
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
