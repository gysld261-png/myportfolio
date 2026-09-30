/**
 * 전체 화면 연기 — MAIN 에서 차오르는 연기(SmokeVeil)와 ABOUT 으로 빠져나오는 연기(SmokePassage)가
 * 같은 셰이더·같은 시계를 쓴다. 그래서 MAIN 의 마지막 장면(gather=1)과 ABOUT 의 첫 장면(progress=0)이
 * 픽셀 단위로 같고, 화면이 바뀌는 순간이 보이지 않는다.
 *
 * three 를 불러오지 않는다 — 전체 화면 사각형 하나라 WebGL 원시 호출로 충분하다.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uOrigin;
uniform float uTime, uProgress, uGather;

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
  // 빠져나오기(uProgress) — 넘어오자마자 움직이기 시작하되, 급하지 않게 끝까지 고르게 스르르 걷힌다.
  // (smoothstep 은 출발이 느려 멈춰 보였고, 지수 2.4 는 초반에 확 걷혀 빨랐다)
  float e = 1.0 - pow(1.0 - uProgress, 1.15);
  // 차오르기(uGather) — 1 이면 빠져나오기의 첫 장면과 같다
  float g = uGather * uGather * (3.0 - 2.0 * uGather);
  float rest = 1.0 - g;

  // 앞으로 살짝 나아가면서 무거운 연기는 아래로 가라앉는다.
  // 차오르는 동안에는 결이 아래에서 위로 밀려 올라온다.
  float zoom = 1.0 + e * 0.7;
  vec2 q = p / zoom + vec2(0.0, e * 0.85) - vec2(0.0, rest * 0.55);
  vec2 drift = vec2(uTime * 0.03, uTime * 0.04);

  vec2 w1 = vec2(fbm(q * 1.5 + drift), fbm(q * 1.5 - drift + 3.1));
  vec2 w2 = vec2(fbm(q * 2.0 + w1 * 1.6 + 1.7), fbm(q * 2.0 + w1 * 1.6 + 9.2));
  float n = fbm(q * 2.2 + w2 * 1.4 + drift * 2.0);
  float wisp = fbm(q * 7.0 + w2 * 2.5 - drift * 2.0);
  float d = n * 0.9 + wisp * 0.1;

  // 찢어지지 않고 옅어진다: 경계 폭을 넓게 잡아 얇은 곳부터 천천히 투명해지고,
  // 위쪽이 먼저 맑아져 연기가 아래로 흘러내려 빠지는 것처럼 보인다
  // 여유분(0.55) 때문에 한참 짙은 채로 버티다 옅어졌다("멈췄다가 스르륵").
  // sqrt(e) 항이 그 여유분을 초반에 먼저 녹여 곧바로 얇은 곳이 비치기 시작하고,
  // 그 뒤로는 e 항이 느린 속도로 고르게 걷어 낸다. 둘 다 e=0 에서 0 이라 MAIN 의 마지막 장면과 이어진다.
  // (GLSL 은 float 에 정수를 곱할 수 없다 — 계수는 꼭 1.0 처럼 소수로 쓴다)
  float cover = d + 0.55 - sqrt(e) * 0.35 - e * 0.55 - (p.y + 0.2) * 0.4 * e;
  // 차오르기: 얼음 자리와 바닥에서 먼저 피어올라 위로, 가장자리로 번진다
  float bloom = 1.0 - length((p - uOrigin) * vec2(0.8, 1.0)) * 1.3;
  cover -= rest * 1.75;
  cover += rest * (bloom * 0.7 + (-p.y - 0.15) * 0.9);
  // 걷히는 동안 경계 폭을 넓힌다 — 한 덩어리가 한꺼번에 빠지지 않고 연기 전체가 조금씩 반투명해져
  // 처음부터 끝까지 고르게 스르르 옅어진다. e=0 에서는 0.6 그대로라 MAIN 과 이어진다.
  float alpha = smoothstep(0.0, 0.6 + sqrt(e) * 0.9, cover);
  alpha *= 1.0 - smoothstep(0.82, 1.0, uProgress);

  // 어둠 속에서 빛을 받은 연기 — 바탕은 페이지보다 조금 밝은 차콜이고, 두꺼운 결만 은빛으로 떠오른다.
  // (예전엔 0.72~0.92 의 흰 연기라, 화면을 다 덮는 순간 어두운 사이트가 흰 벽으로 바뀌어 눈이 부셨다)
  // 얇은 곳까지 결이 차도록 밝아지는 구간을 넓게 잡는다 — 너무 좁으면 두꺼운 덩어리만 남아 듬성듬성 비어 보인다
  vec3 lit = vec3(0.6, 0.64, 0.66);
  vec3 shade = vec3(0.19, 0.21, 0.225);
  float body = smoothstep(0.2, 0.8, d);
  vec3 color = mix(shade, lit, body);
  // 가장 두꺼운 결에만 옅은 아이스 민트를 얹어 사이트 포인트 색과 잇는다
  color += vec3(0.02, 0.06, 0.055) * smoothstep(0.7, 0.95, d);
  color *= mix(0.82, 1.0, alpha);

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

// 두 연기가 같은 결을 그리도록 시계를 하나로 둔다
export const smokeTime = () => (performance.now() / 1000) % 600;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

/** WebGL 을 못 쓰면 null */
export function createSmokeRenderer(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  // GPU 컨텍스트가 부족하거나 셰이더를 지원하지 않는 환경에서는 연기만 생략한다.
  // null 셰이더를 attach 하면 React 트리 전체가 중단되므로 여기서 조용히 폴백한다.
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, 'uRes');
  const uOrigin = gl.getUniformLocation(program, 'uOrigin');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uProgress = gl.getUniformLocation(program, 'uProgress');
  const uGather = gl.getUniformLocation(program, 'uGather');

  // 연기는 원래 흐릿하다 — 해상도를 낮춰도 티가 안 나고 fbm 6옥타브가 가벼워진다.
  // 하나의 캔버스를 왕복 재사용한다. 큰 모니터에서도 노이즈 연산량이 폭증하지 않게 제한한다.
  const resize = () => {
    const scale = Math.min(0.5, Math.sqrt(450000 / (window.innerWidth * window.innerHeight)));
    canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
    canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);
  gl.uniform2f(uOrigin, -0.12, -0.1);

  return {
    draw({ progress = 0, gather = 1, origin = null } = {}) {
      if (origin) gl.uniform2f(uOrigin, origin[0], origin[1]);
      gl.uniform1f(uTime, smokeTime());
      gl.uniform1f(uProgress, progress);
      gl.uniform1f(uGather, gather);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    clear() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
