import { lazy, Suspense, useCallback, useState } from 'react';
import StateReadout from '../components/StateReadout';
import Ticks from '../components/Ticks';
import './main.css';

const DryIceScene = lazy(() => import('../components/DryIceScene'));

/**
 * MAIN — SOLID
 * 3초 안에 박효민 · UX/UI + Frontend · 조용한 상태를 각인시킨다.
 * 여기서 사용자는 "가까이 가면 반응한다"는 사이트의 행동 규칙을 배운다.
 */
export default function Main({ onScrollCue, introEntrance = false, transitionProgress = 0 }) {
  const [hud, setHud] = useState({ state: 'SOLID', temp: 'LOW', tempValue: 0 });
  const updateHud = useCallback((next) => setHud(next), []);

  return (
    <section
      className={`screen main ${transitionProgress > 0.01 ? 'is-sublimating' : ''}`}
      id="main"
      style={{
        '--exit': transitionProgress,
        '--exit-opacity': 1 - transitionProgress * 0.9,
        '--exit-shift': `${-transitionProgress * 34}px`,
        '--exit-blur': `${transitionProgress * 7}px`,
        '--ticks-opacity': 0.36 * (1 - transitionProgress),
      }}
    >
      <Ticks />
      <Suspense fallback={<div className="dry-ice-scene dry-ice-scene--loading" />}>
        <DryIceScene
          initialEntrance={introEntrance}
          exitProgress={transitionProgress}
          onState={updateHud}
        />
      </Suspense>

      <div className="main__type" aria-label="박효민 UX/UI 디자이너, 프론트엔드 개발자">
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

      <div className="main__object-note" aria-hidden="true">
        <span className="sys">SOLID / HYOMIN</span>
        <i />
        <small>MOVE TO CHANGE THE STATE</small>
      </div>

      <div
        className="main__thermal"
        style={{ bottom: `${transitionProgress * 100}%` }}
        aria-hidden="true"
      >
        <span className="sys">THERMAL BOUNDARY / {Math.round(transitionProgress * 100)}%</span>
      </div>

      <button type="button" className="main__scroll sys" onClick={onScrollCue}>
        SCROLL TO SUBLIMATE <span className="main__scroll-line" />
      </button>

      <StateReadout
        side="right"
        state={transitionProgress > 0.01 ? 'SUBLIMATING' : hud.state}
        temp={transitionProgress > 0.72 ? 'HIGH' : transitionProgress > 0.25 ? 'MID' : hud.temp}
        level={Math.max(hud.tempValue, transitionProgress)}
      />
    </section>
  );
}
