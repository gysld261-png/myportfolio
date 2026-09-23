import { useEffect, useId, useRef, useState } from 'react';
import './case-study-boards.css';

/** Designed pages keep their full edges and typography, without photo transforms. */
export default function CaseStudyBoards({ blocks, active }) {
  const boards = blocks.filter((block) => block.src);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const dialogRef = useRef(null);
  const panRef = useRef(null);
  const titleId = useId();
  const helpId = useId();
  const board = selected === null ? null : boards[selected];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (active && selected !== null) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [active, selected]);

  useEffect(() => {
    panRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [selected, expanded]);

  const open = (index) => {
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
        {board && (
          <>
            <header className="case-board-viewer__bar">
              <div className="case-board-viewer__info">
                <p id={titleId} className="case-board-viewer__title">보드 {String(selected + 1).padStart(2, '0')} / {String(boards.length).padStart(2, '0')}</p>
                <p id={helpId} className="case-board-viewer__help">
                  {expanded ? '가로세로로 스크롤해 살펴보세요.' : '확대 보기로 작은 글자를 확인하세요.'}
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
            <div ref={panRef} className="case-board-viewer__pan" tabIndex={0} role="region" aria-label="보드 이미지 스크롤 영역">
              <img
                className={expanded ? 'is-expanded' : ''}
                src={board.src}
                alt={board.alt || ''}
                width={board.width}
                height={board.height}
                draggable={false}
              />
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
