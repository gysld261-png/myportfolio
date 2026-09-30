/**
 * 엔딩으로 들어가는 길 — 마지막 얼음이 승화한다.
 * 인트로에서 얼음을 깨고 들어왔으니, 다 보고 나면 마지막 얼음이 기체(가루)로 풀리며 끝나고,
 * 그 가루가 가운데 모여 엔딩의 눈 가루 덩어리가 된다 — 암전 없이 같은 공간에서 이어진다.
 * 승화·가루는 workIceScene 이 그리고, 여기는 가장자리의 옅은 어둠만 맡는다.
 *   --freeze  0 → 1   가장자리가 잠기고, 둘레의 글자·버튼이 물러난다(ending.css)
 */
export default function EndFreeze() {
  return (
    <div className="end-freeze" aria-hidden="true">
      <div className="end-freeze__vignette" />
    </div>
  );
}
