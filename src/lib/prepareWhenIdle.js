// 취소된 마운트에서는 장면을 만들지 않고, 생성 후에는 소유자의 자원을 정리한다.
export function prepareWhenIdle(initialize, timeout = 1000) {
  const controller = new AbortController();
  let cleanup;
  const prepare = () => {
    if (!controller.signal.aborted) cleanup = initialize(controller.signal);
  };
  const idle = 'requestIdleCallback' in window;
  const id = idle
    ? window.requestIdleCallback(prepare, { timeout })
    : window.setTimeout(prepare, 0);
  return () => {
    controller.abort();
    if (idle) window.cancelIdleCallback(id);
    else window.clearTimeout(id);
    cleanup?.();
    cleanup = undefined;
  };
}
