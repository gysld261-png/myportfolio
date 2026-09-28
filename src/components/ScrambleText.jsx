import { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_.:+-';

/* 한글은 한글로, 영문·숫자는 기호로 바꾼다. 글자 폭이 비슷하게 유지돼 줄바꿈이 덜 흔들린다.
   띄어쓰기와 문장부호는 그대로 둬 문장의 윤곽은 남긴다. */
const glyphFor = (ch) => {
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return String.fromCharCode(0xac00 + Math.floor(Math.random() * 11172));
  if (/[A-Za-z0-9]/.test(ch)) return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  return ch;
};
const scramble = (chars) => chars.map(glyphFor).join('');

/**
 * 글자가 무작위 기호로 뒤섞였다 풀린다 — Igloo 의 라벨·상세 문구 전환.
 *
 *   in   전부 기호로 시작해 글자마다 제각각의 순간에 원래 글자로 풀린다.
 *   out  원래 글자가 제각각의 순간에 기호로 깨진다.
 *   onView  화면에 들어온 뒤에야 풀리기 시작한다(스크롤 아래 본문용).
 *
 * 화면 읽기 프로그램에는 원래 문장만 읽히도록 뒤섞인 글자는 숨긴다.
 */
export default function ScrambleText({ text, play, mode = 'in', duration = 700, delay = 0, onView = false }) {
  const holder = useRef(null);
  const [shown, setShown] = useState(text);
  const [seen, setSeen] = useState(!onView);

  useEffect(() => {
    if (!onView || seen) return undefined;
    const el = holder.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [onView, seen]);

  useEffect(() => {
    if (!play || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      return undefined;
    }
    const chars = [...text];
    // 아직 화면 밖이면 뒤섞인 채로 기다렸다가, 들어오는 순간 풀리기 시작한다.
    if (mode === 'in' && !seen) {
      setShown(scramble(chars));
      return undefined;
    }
    const thresholds = chars.map(() => Math.random());
    const start = performance.now() + delay;
    // 들어올 때는 첫 프레임부터 기호로 시작해야 원래 글자가 한 번 번쩍이지 않는다.
    if (mode === 'in') setShown(scramble(chars));
    let frame = 0;
    let last = 0;
    const step = (now) => {
      frame = requestAnimationFrame(step);
      // 기호가 매 프레임 바뀌면 번쩍임으로만 보여서 약 20fps 로 바꾼다.
      if (now - last < 48) return;
      last = now;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setShown(chars.map((ch, i) => {
        const settled = mode === 'in' ? t >= 0.15 + thresholds[i] * 0.85 : t < thresholds[i] * 0.7;
        return settled ? ch : glyphFor(ch);
      }).join(''));
      if (t >= 1 && mode === 'in') cancelAnimationFrame(frame);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, play, mode, duration, delay, seen]);

  return (
    <span ref={holder}>
      <span className="scramble__sr">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
