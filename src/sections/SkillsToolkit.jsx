import { useEffect, useState } from 'react';
import './skills-toolkit.css';

/**
 * SKILLS — 네 가지 역량.
 * 네 줄 모두 펼쳐 두고, 가리킨 줄에서만 오른쪽에 그 역량을 직접 해 보이는 작은 장면이 돈다.
 * 방에 들어오면 줄이 하나씩 올라오고, 설명 → 도구가 차례로 뜬다(한꺼번에 '띡' 나오지 않게)
 *       UX/UI     와이어프레임 → 채워진 화면, 프로토타입 연결선
 *       FRONTEND  HTML 로 CONTACT 버튼이 쳐지고, 그려진 버튼이 눌리며 체온 색으로 바뀐다
 *       VISUAL    흑백 사진에 색이 입혀지고, 색을 뽑는다
 *       WORKFLOW  브랜치가 갈라졌다가 main 으로 합쳐진다
 * 가리키거나(키보드 포커스 포함) 누른 줄이 밝아지며 장면이 나타나고, 목록에서 손을 떼면 사라진다.
 */
const ADOBE = { photoshop: 'Ps', illustrator: 'Ai', indesign: 'Id' };
const DEMOS = ['ux', 'front', 'visual', 'flow'];
/* 방에 들어와 줄·도구가 다 올라올 때까지(마지막 도구 ≈ 1.83s) — 그동안은 목록이 잠깐 아래로 넘쳐도 스크롤바를 띄우지 않는다 */
const SETTLE_MS = 2100;

function ToolIcon({ icon }) {
  if (ADOBE[icon]) {
    return <span className={`skills-tool__adobe skills-tool__adobe--${icon}`} aria-hidden="true">{ADOBE[icon]}</span>;
  }

  if (icon === 'prototype') {
    return (
      <svg className="skills-tool__prototype" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="8" height="11" rx="1.5" />
        <rect x="14" y="10" width="8" height="11" rx="1.5" />
        <path d="M6 14v4h5m-2-2 2 2-2 2M10 7h8v3" />
      </svg>
    );
  }

  return <img className={`skills-tool__icon skills-tool__icon--${icon}`} src={`/about/skills/${icon}.svg`} width="22" height="22" alt="" aria-hidden="true" draggable="false" />;
}

/* 역량마다 직접 해 보이는 작은 장면 — 방이 켜져 있는 동안 계속 돈다 */
function SkillDemo({ kind }) {
  if (kind === 'ux') {
    return (
      <svg className="sdemo sdemo--ux" viewBox="0 0 170 112" aria-hidden="true">
        <g className="sdemo-ux__wire">
          <rect className="sdemo-frame" x="6" y="6" width="54" height="100" rx="7" />
          <rect x="12" y="15" width="42" height="5" rx="2" />
          <rect x="12" y="25" width="42" height="30" rx="3" />
          <rect x="12" y="61" width="30" height="4" rx="2" />
          <rect x="12" y="69" width="38" height="4" rx="2" />
          <rect className="sdemo-ux__hot" x="12" y="85" width="26" height="10" rx="5" />
        </g>
        <path className="sdemo-ux__noodle" d="M38 90 C 76 90, 72 52, 108 52" />
        <circle className="sdemo-ux__dot" cx="108" cy="52" r="2.6" />
        <g className="sdemo-ux__ui">
          <rect className="sdemo-frame" x="110" y="6" width="54" height="100" rx="7" />
          <rect className="sdemo-ux__fill sdemo-ux__fill--1" x="116" y="15" width="42" height="5" rx="2" />
          <rect className="sdemo-ux__fill sdemo-ux__fill--2" x="116" y="25" width="42" height="30" rx="3" />
          <rect className="sdemo-ux__fill sdemo-ux__fill--3" x="116" y="61" width="30" height="4" rx="2" />
          <rect className="sdemo-ux__fill sdemo-ux__fill--3" x="116" y="69" width="38" height="4" rx="2" />
          <rect className="sdemo-ux__fill sdemo-ux__fill--4" x="116" y="85" width="42" height="10" rx="5" />
        </g>
      </svg>
    );
  }
  if (kind === 'front') {
    return (
      <div className="sdemo sdemo--front" aria-hidden="true">
        <code className="sdemo-front__code">
          <span className="sdemo-front__line sdemo-front__line--1">&lt;button class="contact"&gt;</span>
          <span className="sdemo-front__line sdemo-front__line--2">  Contact</span>
          <span className="sdemo-front__line sdemo-front__line--3">&lt;/button&gt;</span>
        </code>
        {/* 이 사이트의 CONTACT 버튼 — 눌리면 체온 색(주황)으로 */}
        <span className="sdemo-front__button">Contact</span>
      </div>
    );
  }
  if (kind === 'visual') {
    return (
      <div className="sdemo sdemo--visual" aria-hidden="true">
        <span className="sdemo-visual__photo">
          <i className="sdemo-visual__raw" />
          <i className="sdemo-visual__graded" />
          <b className="sdemo-visual__handle" />
        </span>
        <span className="sdemo-visual__swatches"><i /><i /><i /></span>
      </div>
    );
  }
  return (
    <svg className="sdemo sdemo--flow" viewBox="0 0 170 112" aria-hidden="true">
      <path className="sdemo-flow__main" d="M8 74 H 162" />
      <path className="sdemo-flow__branch" d="M38 74 C 50 74, 50 42, 64 42 H 106 C 120 42, 120 74, 132 74" />
      <circle className="sdemo-flow__c sdemo-flow__c--0" cx="24" cy="74" r="4" />
      <circle className="sdemo-flow__c sdemo-flow__c--1" cx="72" cy="42" r="4" />
      <circle className="sdemo-flow__c sdemo-flow__c--2" cx="98" cy="42" r="4" />
      <circle className="sdemo-flow__merge" cx="132" cy="74" r="5" />
      <text className="sdemo-flow__label sdemo-flow__label--branch" x="64" y="30">design-fix</text>
      <text className="sdemo-flow__label sdemo-flow__label--main" x="8" y="94">main</text>
      <text className="sdemo-flow__label sdemo-flow__label--merged" x="120" y="96">merged ✓</text>
    </svg>
  );
}

export default function SkillsToolkit({ groups, title, intro, active }) {
  const [open, setOpen] = useState(null);   // 가리킨 줄 — 없으면 장면도 없다

  const [settling, setSettling] = useState(false);

  // 방을 떠나면 거둔다
  useEffect(() => { if (!active) setOpen(null); }, [active]);

  // 줄이 16px 아래에서 올라오는 동안엔 그만큼 영역을 넘친다 — 낮은 화면에서 스크롤바가 떴다 사라지지 않게 잠깐 잠근다
  useEffect(() => {
    if (!active) return undefined;
    setSettling(true);
    const timer = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <section className={`skills-toolkit ${settling ? 'is-settling' : ''}`} aria-labelledby="skills-toolkit-title" inert={active ? undefined : ''}>
      <header className="skills-toolkit__intro">
        <p className="skills-toolkit__eyebrow sys">ABOUT / SKILLS 02</p>
        <h2 id="skills-toolkit-title">
          {title.split('\n').map(line => <span key={line}>{line}</span>)}
        </h2>
        <p className="skills-toolkit__description">{intro}</p>
        <p className="skills-toolkit__practice sys">DESIGN · DEVELOP · REFINE</p>
      </header>

      <ol className="skills-toolkit__list" aria-label="작업 역량과 사용 도구" onPointerLeave={() => setOpen(null)}>
        {groups.map((group, index) => (
          <li
            className={`skills-toolkit__row ${index === open ? 'is-current' : ''}`}
            key={group.no}
            style={{ '--r': index }}
            tabIndex={0}
            onPointerEnter={() => setOpen(index)}
            onFocus={() => setOpen(index)}
            onBlur={() => setOpen((now) => (now === index ? null : now))}
            onClick={() => setOpen(index)}
          >
            <h3 className="skills-toolkit__heading">
              <span className="skills-toolkit__number sys" aria-hidden="true">{group.no}</span>
              <span className="skills-toolkit__label">{group.label}</span>
            </h3>
            <div className="skills-toolkit__inner">
              <div className="skills-toolkit__body">
                <p className="skills-toolkit__detail">{group.detail}</p>
                {group.extra && <p className="skills-toolkit__detail">{group.extra}</p>}
                {group.scope && <p className="skills-toolkit__scope">{group.scope}</p>}
                <ul className="skills-toolkit__tools" aria-label={`${group.label} 사용 도구`}>
                  {group.items.map((tool, t) => (
                    <li className="skills-tool" key={tool.name} style={{ '--i': t }}>
                      <ToolIcon icon={tool.icon} />
                      <span className="skills-tool__name">{tool.name}</span>
                      {tool.annotation && <small className="skills-tool__annotation">{tool.annotation}</small>}
                      {tool.level && <small className="skills-tool__level">{tool.level}</small>}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="skills-toolkit__stage" aria-hidden="true">
                {active && index === open && <SkillDemo kind={group.demo || DEMOS[index % DEMOS.length]} />}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
