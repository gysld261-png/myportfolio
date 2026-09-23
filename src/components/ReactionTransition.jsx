import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createReactionScene, prepareReactionAssets, REACTION_COVER, REACTION_END, reactionAt } from '../lib/reactionScene';
import './reaction.css';

const study = import.meta.env.DEV && new URLSearchParams(window.location.search).has('reaction-study');
export { prepareReactionAssets as warmReaction };

export default function ReactionTransition({ spec, onCovered, onFinish, onCancel }) {
  const hostRef=useRef(null),canvasRef=useRef(null),skipRef=useRef(null),sceneRef=useRef(null);
  const callbacks=useRef({onCovered,onFinish,onCancel});
  callbacks.current={onCovered,onFinish,onCancel};
  const [ready,setReady]=useState(false),[phase,setPhase]=useState('inspect');
  const [studyTime,setStudyTime]=useState(0),[paused,setPaused]=useState(false);
  const control=useRef({phase,paused,time:studyTime});control.current={phase,paused,time:studyTime};
  const covered=useRef(false);
  const complete=()=>{
    if(!covered.current){covered.current=true;callbacks.current.onCovered();}
    callbacks.current.onFinish();
  };
  const completeRef=useRef(complete);completeRef.current=complete;
  const start=()=>{
    if(!ready||phase!=='inspect')return;
    skipRef.current?.focus({preventScroll:true});
    setPaused(false);setStudyTime(0);setPhase('running');
  };

  useEffect(()=>{
    const previousFocus=document.activeElement;
    const root=document.getElementById('root'),previousInert=root?.inert;
    if(root)root.inert=true;
    skipRef.current?.focus({preventScroll:true});
    const onKey=e=>{
      if(e.key==='Escape'){
        e.preventDefault();e.stopImmediatePropagation();
        if(covered.current)completeRef.current();else callbacks.current.onCancel();
      }
      if(e.key==='Tab'){
        const targets=[...hostRef.current.querySelectorAll('button:not(:disabled),input,canvas[tabindex]')];
        const index=targets.indexOf(document.activeElement);
        e.preventDefault();targets[(index+(e.shiftKey?-1:1)+targets.length)%targets.length]?.focus();
      }
    };
    const onPop=()=>callbacks.current.onCancel();
    window.addEventListener('keydown',onKey,true);window.addEventListener('popstate',onPop);
    return()=>{
      window.removeEventListener('keydown',onKey,true);window.removeEventListener('popstate',onPop);
      if(root)root.inert=previousInert;
      requestAnimationFrame(()=>{
        if(covered.current)document.querySelector('.detail.is-open .dhero__title')?.focus({preventScroll:true});
        else if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});
      });
    };
  },[]);

  useEffect(()=>{
    let scene,raf=0,elapsed=null,last=0,clock=0,disposed=false;
    covered.current=false;
    const canvas=canvasRef.current;
    const onVisibility=()=>{last=0;};
    const onUnavailable=()=>completeRef.current();
    document.addEventListener('visibilitychange',onVisibility);
    canvas.addEventListener('reaction-unavailable',onUnavailable);
    const frame=now=>{
      if(disposed)return;
      const dt=last&&!document.hidden?(now-last)/1000:0;last=now;clock+=dt;
      if(control.current.phase==='inspect')elapsed=null;
      else if(control.current.paused)elapsed=control.current.time;
      else elapsed=(elapsed??0)+dt;
      const s=reactionAt(elapsed);
      hostRef.current.style.setProperty('--reaction-out',String(1-s.clear));
      hostRef.current.style.setProperty('--reaction-cover',String(s.cover));
      hostRef.current.dataset.phase=elapsed===null?'inspect':elapsed<.78?'drop':elapsed<2.65?'sublimate':'enter';
      if(study)hostRef.current.dataset.time=(elapsed??0).toFixed(2);
      scene.render(elapsed,dt,clock);
      if(elapsed!==null&&!control.current.paused&&elapsed>=REACTION_COVER&&!covered.current){covered.current=true;callbacks.current.onCovered();}
      if(elapsed!==null&&!control.current.paused&&elapsed>=REACTION_END){callbacks.current.onFinish();return;}
      raf=requestAnimationFrame(frame);
    };
    try {
      scene=createReactionScene(canvas);sceneRef.current=scene;
      // Compile and draw before enabling interaction, rather than revealing a blank frame.
      scene.render(null);setReady(true);raf=requestAnimationFrame(frame);
    } catch(error) {
      console.warn('3D scene unavailable; opening the project.',error);completeRef.current();
    }
    return()=>{
      disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',onVisibility);
      canvas.removeEventListener('reaction-unavailable',onUnavailable);sceneRef.current=null;scene?.destroy();
    };
  },[spec.id]);

  return createPortal(
    <div ref={hostRef} className={`reaction${ready?' is-ready':''}`} role="dialog" aria-modal="true" aria-label={`${spec.ko} 프로젝트 열기`}>
      <canvas key="spatial-glass-v1" ref={canvasRef} className="reaction__canvas" tabIndex={0} role="img"
        aria-label="입체 유리컵과 드라이아이스. 드래그 또는 좌우 방향키로 둘러볼 수 있습니다."
        onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();sceneRef.current?.rotate(e.key==='ArrowLeft'?-1:1);}}}/>
      <div className="reaction__veil" aria-hidden="true" />
      <div className="reaction__top">
        <span className="reaction__identity">{spec.no} / {spec.ko}</span>
        <button ref={skipRef} type="button" onClick={complete}>프로젝트 바로 보기 <span aria-hidden="true">↗</span></button>
      </div>
      <div className={`reaction__controls${phase==='running'?' is-running':''}`}>
        <p>{ready?'드래그하여 둘러보기':'장면 준비 중'}</p>
        <div className="reaction__actions">
          <button type="button" className="reaction__orbit" aria-label="왼쪽으로 회전" disabled={!ready||phase==='running'} onClick={()=>sceneRef.current?.rotate(-1)}>←</button>
          <button type="button" className="reaction__drop" disabled={!ready||phase==='running'} onClick={start}>얼음 넣기 <span aria-hidden="true">↓</span></button>
          <button type="button" className="reaction__orbit" aria-label="오른쪽으로 회전" disabled={!ready||phase==='running'} onClick={()=>sceneRef.current?.rotate(1)}>→</button>
        </div>
        <button className="reaction__reset" type="button" disabled={!ready||phase==='running'} onClick={()=>sceneRef.current?.resetView()}>시점 초기화</button>
      </div>
      <button className="reaction__cancel" type="button" onClick={()=>covered.current?complete():callbacks.current.onCancel()}>돌아가기 <span>ESC</span></button>
      {study&&<div className="reaction__study">
        <label>장면 시간 <input aria-label="장면 시간" type="number" min="0" max={REACTION_END} step="0.1" value={studyTime} onChange={e=>{setPhase('running');setPaused(true);setStudyTime(Math.max(0,Math.min(REACTION_END,Number(e.target.value)||0)));}}/></label>
        <button type="button" onClick={()=>{setPhase('running');setPaused(v=>!v);}}>{paused?'재생':'정지'}</button>
      </div>}
    </div>,document.body,
  );
}
