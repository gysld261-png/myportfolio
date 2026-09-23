import { useEffect, useRef } from 'react';

/**
 * 연기 통과 — MAIN 의 스크롤 끝(연기로 덮인 화면)에서 ABOUT 으로 빠져나오는 순간.
 *
 * 둥근 구멍이 열리거나 찢어지는 게 아니다. 짙은 연기 속을 앞으로 걸어 나가면
 * 무거운 연기가 아래로 스르륵 가라앉으며 얇은 곳부터 옅어지고,
 * 그 너머의 ABOUT 이 드러난다.
 *
 * three 를 불러오지 않는다 — 전체 화면 사각형 하나라 WebGL 원시 호출로 충분하고,
 * App 에 붙는 컴포넌트라 three 를 끌어오면 첫 로드가 무거워진다.
 */
const DURATION = 2700;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uProgress;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) { v += noise(p) * a; p = r * p * 2.02 + 7.3; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  // 끊기지 않게 — 시작과 끝 모두 느리게
  float e = uProgress * uProgress * (3.0 - 2.0 * uProgress);

  // 앞으로 살짝 나아가면서(결이 조금 커진다) 무거운 연기는 아래로 스르륵 가라앉는다
  float zoom = 1.0 + e * 0.7;
  vec2 q = p / zoom + vec2(0.0, e * 0.85);
  vec2 drift = vec2(uTime * 0.03, uTime * 0.04);

  vec2 w1 = vec2(fbm(q * 1.5 + drift), fbm(q * 1.5 - drift + 3.1));
  vec2 w2 = vec2(fbm(q * 2.0 + w1 * 1.6 + 1.7), fbm(q * 2.0 + w1 * 1.6 + 9.2));
  float n = fbm(q * 2.2 + w2 * 1.4 + drift * 2.0);
  float wisp = fbm(q * 7.0 + w2 * 2.5 - drift * 2.0);
  float d = n * 0.9 + wisp * 0.1;

  // 찢어지지 않고 옅어진다: 경계 폭을 넓게 잡아 얇은 곳부터 천천히 투명해지고,
  // 위쪽이 먼저 맑아져 연기가 아래로 흘러내려 빠지는 것처럼 보인다
  float cover = d + 0.55 - e * 1.35 - (p.y + 0.2) * 0.4 * e;
  float alpha = smoothstep(0.0, 0.6, cover);
  alpha *= 1.0 - smoothstep(0.82, 1.0, uProgress);

  // 빛을 머금은 연기 — 두꺼운 곳은 밝고, 옅어지는 가장자리는 살짝 그늘진다
  vec3 lit = vec3(0.92, 0.945, 0.955);
  vec3 shade = vec3(0.72, 0.77, 0.79);
  vec3 color = mix(shade, lit, smoothstep(0.25, 0.8, d));
  color *= mix(0.82, 1.0, alpha);

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

export default function SmokePassage({ onDone }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = !reduced && canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
    // WebGL 이 없거나 모션 축소면 CSS 페이드(.smoke-passage--plain)로 대신한다
    if (!gl) {
      canvas.parentElement.classList.add('smoke-passage--plain');
      const t = window.setTimeout(() => doneRef.current?.(), 480);
      return () => window.clearTimeout(t);
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uProgress = gl.getUniformLocation(program, 'uProgress');

    // 연기는 원래 흐릿하다 — 해상도를 낮춰도 티가 안 나고 fbm 6옥타브가 가벼워진다
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1) * 0.6;
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let start = 0;
    let finished = false;
    const frame = (now) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / DURATION);
      gl.uniform1f(uTime, 4 + (now - start) / 1000);
      gl.uniform1f(uProgress, progress);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (progress < 1) raf = requestAnimationFrame(frame);
      else if (!finished) {
        finished = true;
        doneRef.current?.();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div className="smoke-passage" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
