const fs = require('fs');
let s = fs.readFileSync('About.jsx', 'utf8');
const a = `<p className="about-room__eyebrow sys">{item.eyebrow}</p>`;
const b = `<h2>{item.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h2>`;
if (!s.includes(a) || !s.includes(b)) throw new Error('missing');
s = s.replace(a, `<p className="about-room__eyebrow sys">
                <ScrambleText text={item.eyebrow} play={phase === 'reveal' && selected === item.id} duration={620} />
              </p>`.replace(/\n/g, '\r\n'));
// 제목 줄은 아래에서 올라오는 기존 애니메이션을 그대로 두고, 글자만 섞였다 풀린다
s = s.replace(b, `<h2>
                {item.title.split('\n').map((line, i) => (
                  <span key={line}>
                    <ScrambleText text={line} play={phase === 'reveal' && selected === item.id} duration={820} delay={120 + i * 90} />
                  </span>
                ))}
              </h2>`.replace(/\n/g, '\r\n'));
s = s.replace(`import { prefersReduced } from '../lib/smooth';`, `import { prefersReduced } from '../lib/smooth';\r\nimport ScrambleText from '../components/ScrambleText';`);
fs.writeFileSync('About.jsx', s);
