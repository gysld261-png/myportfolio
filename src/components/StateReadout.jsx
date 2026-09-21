/**
 * STATE / TEMP 는 추상적인 인터랙션 지표다.
 * 실제 온도 수치(-78.5°C)는 쓰지 않는다 — 과학 테마로 빠지는 지점.
 */
export default function StateReadout({ state = 'SOLID', temp = 'LOW', level = 0, side = 'left' }) {
  return (
    <div className={`readout readout--${side} sys`}>
      <span>STATE</span>
      <b>{state}</b>
      <span>TEMP</span>
      <b>{temp}</b>
      <span className="readout__track">
        <span className="readout__level" style={{ width: `${Math.round(level * 100)}%` }} />
      </span>
    </div>
  );
}
