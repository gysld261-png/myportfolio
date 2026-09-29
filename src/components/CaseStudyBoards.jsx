import { useEffect, useId, useRef, useState } from 'react';
import './case-study-boards.css';

/** Designed pages keep their full edges and typography, without photo transforms. */
export default function CaseStudyBoards({ blocks, active }) {
  const boards = blocks.filter((block) => block.src);
  const [selected, setSelected] = useState(null);
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const dialogRef = useRef(null);
  const panRef = useRef(null);
  const boardRefs = useRef([]);
  const currentRef = useRef(0);
  const titleId = useId();
  const helpId = useId();
  const isOpen = selected !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (active && isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [active, isOpen]);

  // Jump to the chosen board on open, and keep the same board in view when the zoom changes.
  useEffect(() => {
    if (!isOpen) return;
    const pan = panRef.current;
    const target = boardRefs.current[currentRef.current];
    if (!pan || !target) return;
    pan.scrollTo({ top: target.offsetTop, left: 0, behavior: 'instant' });
  }, [isOpen, selected, expanded]);

  const syncCurrent = () => {
    const pan = panRef.current;
    if (!pan) return;
    const line = pan.scrollTop + pan.clientHeight * 0.35;
    let index = 0;
    boardRefs.current.forEach((el, i) => {
      if (el && el.offsetTop <= line) index = i;
    });
    if (index !== currentRef.current) {
      currentRef.current = index;
      setCurrent(index);
    }
  };

  const open = (index) => {
    currentRef.current = index;
    setCurrent(index);
    setExpanded(true);
    setSelected(index);
  };

  return (
    <section className="case-boards" aria-label="프로젝트 케이스 스터디">
      <p className="case-boards__hint">이미지를 누르면 크게 볼 수 있어요 <span aria-hidden="true">↗</span></p>
      <div className="case-boards__pages">
        {boards.map((item, index) => (
          <button
            type="button"
            className="case-boards__page"
            key={item.src}
            onClick={() => open(index)}
            aria-label={`보드 ${index + 1} 확대 보기`}
            aria-haspopup="dialog"
          >
            <img src={item.src} alt={item.alt || ''} width={item.width} height={item.height} loading="lazy" />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="case-board-viewer"
        aria-labelledby={titleId}
        aria-describedby={helpId}
        onClose={() => setSelected(null)}
        // Keep the detail page's custom wheel handler away from native image panning.
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
      >
        {isOpen && (
          <>
            <header className="case-board-viewer__bar">
              <div className="case-board-viewer__info">
                <p id={titleId} className="case-board-viewer__title" aria-live="polite">
                  보드 {String(current + 1).padStart(2, '0')} / {String(boards.length).padStart(2, '0')}
                </p>
                <p id={helpId} className="case-board-viewer__help">
                  {expanded ? '스크롤하면 다음 보드로 이어져요.' : '확대 보기로 작은 글자를 확인하세요.'}
                </p>
              </div>
              <div className="case-board-viewer__actions">
                <button type="button" onClick={() => setExpanded((value) => !value)}>
                  {expanded ? '전체 보기' : '확대 보기'}
                </button>
                <button type="button" autoFocus onClick={() => dialogRef.current.close()} aria-label="확대 보기 닫기">
                  닫기 <span aria-hidden="true">×</span>
                </button>
              </div>
            </header>
            <div
              ref={panRef}
              className={`case-board-viewer__pan${expanded ? ' is-expanded' : ''}`}
              tabIndex={0}
              role="region"
              aria-label="보드 이미지 스크롤 영역"
              onScroll={syncCurrent}
            >
              {boards.map((item, index) => (
                <img
                  key={item.src}
                  ref={(el) => { boardRefs.current[index] = el; }}
                  src={item.src}
                  alt={item.alt || ''}
                  width={item.width}
                  height={item.height}
                  loading={Math.abs(index - selected) <= 1 ? 'eager' : 'lazy'}
                  draggable={false}
                />
              ))}
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
