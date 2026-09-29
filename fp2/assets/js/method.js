/* Automatic method walkthrough. Independent of video/data loading. */
const root = document.querySelector('#method-demo');
if (root) {
  const total = 16000;
  const stageDuration = total / 4;
  const steps = [
    {
      title: 'Keep task-level action generation.',
      description: 'The task-adapted foundation policy predicts an action chunk and contextual tokens. Force is not an input to this model.',
    },
    {
      title: 'Retain context in one compact token.',
      description: 'A learned compressor summarizes the foundation policy’s contextual tokens. This token updates with the foundation policy at 2 Hz and is cached between updates.',
    },
    {
      title: 'Combine intent with fresh physical feedback.',
      description: 'At 50 Hz, the force-control policy uses cached context and recent wrench and proprioceptive histories to predict an interaction frame, force–position selection, and desired wrench.',
    },
    {
      title: 'Execute the original actions with force regulation.',
      description: 'The original action reference and force-control parameters meet at the hybrid force–position controller. The downstream policy does not re-generate actions; low-level control runs at 1 kHz.',
    },
  ];
  const count = root.querySelector('#method-step-count');
  const title = root.querySelector('#method-step-title');
  const description = root.querySelector('#method-step-description');
  const packet = root.querySelector('.context-packet');
  const feedback = root.querySelector('.feedback-dot');
  const tool = root.querySelector('.execution-tool');
  const referencePath = root.querySelector('.reference-path');
  const feedbackPath = root.querySelector('.feedback-line');
  const tokens = [...root.querySelectorAll('.token-sequence > span')];
  const drops = [...root.querySelectorAll('.flow-down i')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionReduced = reduce.matches;
  let elapsed = 0;
  let previousTime = null;
  let frame = 0;
  let activePhase = null;
  let isVisible = false;
  let pageSuspended = false;

  function render() {
    const phase = motionReduced ? 'overview' : Math.floor(elapsed / stageDuration);
    const motion = motionReduced ? 0.5 : (elapsed % stageDuration) / stageDuration;
    root.dataset.phase = String(phase);
    root.dataset.elapsed = String(Math.floor(elapsed));
    if (phase !== activePhase) {
      activePhase = phase;
      if (phase === 'overview') {
        count.textContent = 'FP2';
        title.textContent = 'Action generation + interaction regulation.';
        description.textContent = 'The 2 Hz foundation policy generates actions and context. A compressor caches a compact context token; the 50 Hz force-control policy combines it with physical feedback. Both feed the 1 kHz controller, without downstream action re-generation.';
      } else {
        count.textContent = `0${phase + 1} / 04`;
        title.textContent = steps[phase].title;
        description.textContent = steps[phase].description;
      }
    }
    // These are explanatory glyphs, not plots of experiment data or real clocks.
    tokens.forEach((token, index) => {
      token.style.transform = phase <= 1 ? `scaleY(${0.7 + 0.3 * Math.sin(motion * Math.PI * 2 - index * 0.5)})` : 'scaleY(1)';
    });
    packet.style.left = `${Math.min(94, motion * 100)}%`;
    const feedbackPoint = feedbackPath.getPointAtLength(feedbackPath.getTotalLength() * ((motion * 3) % 1));
    feedback.setAttribute('cx', feedbackPoint.x);
    feedback.setAttribute('cy', feedbackPoint.y);
    drops.forEach((drop, index) => { drop.style.transform = `translateY(${((motion * 3 + index * .15) % 1) * 22}px)`; });
    const point = referencePath.getPointAtLength(referencePath.getTotalLength() * motion);
    tool.style.transform = phase === 3 || phase === 'overview' ? `translate(${point.x}px, ${point.y}px)` : 'translate(10px, 26px)';
  }
  function running() {
    return isVisible && !motionReduced && !pageSuspended && !document.hidden;
  }
  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    root.dataset.playing = 'false';
  }
  function tick(now) {
    frame = 0;
    if (!running()) { stopFrame(); return; }
    if (previousTime !== null) elapsed = (elapsed + Math.min(100, now - previousTime)) % total;
    previousTime = now;
    render();
    frame = requestAnimationFrame(tick);
  }
  function syncPlayback() {
    if (!running()) { stopFrame(); return; }
    root.dataset.playing = 'true';
    if (!frame) frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
    syncPlayback();
  }, { threshold: 0.15 });
  observer.observe(root);
  document.addEventListener('visibilitychange', syncPlayback);
  reduce.addEventListener('change', (event) => {
    motionReduced = event.matches;
    render();
    syncPlayback();
  });
  window.addEventListener('pagehide', () => { pageSuspended = true; stopFrame(); });
  window.addEventListener('pageshow', () => { pageSuspended = false; syncPlayback(); });
  render();
  syncPlayback();
}
