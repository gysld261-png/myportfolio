/** 보일 듯 말 듯한 좌표. 정확한 그리드 위에 불안정한 드라이아이스가 놓인다. */
export default function Ticks({ count = 12 }) {
  return (
    <div className="ticks" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
