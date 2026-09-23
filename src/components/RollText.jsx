/**
 * ROLL TEXT — 한 글자씩 시차를 두고 굴러간다.
 *
 * 단어를 통째로 굴리면 11~13px 글씨에선 이동 거리가 12px 남짓이라 눈에 안 띈다.
 * 글자마다 조금씩 늦게 출발시키면 단어를 가로지르는 물결이 생겨서,
 * 같은 이동 거리인데도 "움직였다"가 분명하게 읽힌다.
 *
 * 접근성: 쪼갠 글자는 전부 aria-hidden 이고 링크 이름은 바깥에서 준다.
 * 안 그러면 스크린리더가 "브이 아이 에스 아이 티" 로 한 자씩 읽는다.
 *
 *   <a aria-label="VISIT SITE"><RollText text="VISIT SITE" /></a>
 */
export default function RollText({ text, step = 24 }) {
  return (
    <span className="rt" aria-hidden="true">
      {Array.from(text).map((ch, i) => (
        // 공백도 칸을 차지해야 단어 간격이 유지된다
        <span key={i} className="rt__c" style={{ '--i': i, '--step': `${step}ms` }}>
          <span className="rt__a">{ch === ' ' ? ' ' : ch}</span>
          <span className="rt__b">{ch === ' ' ? ' ' : ch}</span>
        </span>
      ))}
    </span>
  );
}
