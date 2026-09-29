/**
 * 방 안 바닥 연기 — 드라이아이스에서 나온 기체처럼 바닥에 낮게 깔려 옆으로 흐른다.
 * 마우스가 지나간 자국을 따라 연기가 걷힌다 — 손으로 연기를 가르듯. 걷힌 가장자리는 흐트러지며
 * 번지고, 시간이 지나면 주변 연기가 흘러들어 천천히 다시 메워진다.
 *
 * 자국은 최근 마우스 자리 몇 개(TRAIL)를 나이와 함께 넘겨 셰이더가 직접 계산한다.
 *
 * smokeVeil 과 같은 방식(three 없이 전체 화면 사각형 하나)이고, 연기라 해상도를 낮춰 그린다.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const TRAIL = 28;          // 기억하는 마우스 자리 수
export const TRAIL_LIFE = 2.6;    // 걷힌 자리가 다시 메워지는 시간 (s)

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uTrail[${TRAIL}];  // 마우스가 지나간 자리 (x, y: 0~1 아래가 0, z: 지난 시간 s, 음수면 비어 있음)
uniform float uAmount;   // 전체 짙기 (나타나고 사라질 때)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += noise(p) * a; p = r * p * 2.02 + 7.3; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // 옆으로 천천히 흐르는 결
  vec2 q = p * vec2(1.6, 2.6) + vec2(-uTime * 0.035, 0.0);
  vec2 w = vec2(fbm(q * 1.2 + uTime * 0.02), fbm(q * 1.2 - uTime * 0.018 + 5.2));
  float n = fbm(q + w * 1.3 + vec2(0.0, -uTime * 0.03));

  // 걷힌 자국 — 갓 지나간 자리는 좁고 깨끗하게 비고, 시간이 지나며 넓게 번지면서 옅게 메워진다.
  // 경계는 연기 결(n)로 흔들어 매끈한 원이 아니라 찢긴 가장자리가 되게 한다
  float clearing = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec3 t = uTrail[i];
    if (t.z < 0.0) continue;
    float life = clamp(t.z / ${TRAIL_LIFE.toFixed(1)}, 0.0, 1.0);
    vec2 c = vec2(t.x * aspect, t.y);
    float r = 0.045 + life * 0.09;
    float d = length(p - c) / r;
    d += (n - 0.5) * 0.9;
    clearing = max(clearing, (1.0 - smoothstep(0.35, 1.0, d)) * (1.0 - smoothstep(0.0, 1.0, life)));
  }

  // 바닥에 가장 짙고 위로 갈수록 옅다
  float h = uv.y;
  float floorBand = 1.0 - smoothstep(0.0, 0.26 + n * 0.14, h);
  float a = floorBand * smoothstep(0.32, 0.78, n + (0.2 - h) * 0.7);
  a *= (1.0 - clearing * 0.92) * 0.62 * uAmount;

  vec3 lit = vec3(0.9, 0.925, 0.93);
  vec3 shade = vec3(0.62, 0.66, 0.68);
  vec3 color = mix(shade, lit, smoothstep(0.35, 0.85, n));
  gl_FragColor = vec4(color * a, a);
}
`;

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
export function createRoomFog(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
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
  const u = (name) => gl.getUniformLocation(program, name);
  const uRes = u('uRes'); const uTime = u('uTime'); const uTrail = u('uTrail'); const uAmount = u('uAmount');
  const trailData = new Float32Array(TRAIL * 3);

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 1) * 0.5;
    canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
    canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);

  return {
    /** trail: [{ x, y, age }] — x·y 는 0~1(아래가 0), age 는 지난 시간(s) */
    draw({ time, trail, amount }) {
      for (let i = 0; i < TRAIL; i += 1) {
        const t = trail[i];
        trailData[i * 3] = t ? t.x : 0;
        trailData[i * 3 + 1] = t ? t.y : 0;
        trailData[i * 3 + 2] = t ? t.age : -1;
      }
      gl.uniform1f(uTime, time);
      gl.uniform3fv(uTrail, trailData);
      gl.uniform1f(uAmount, amount);
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
