/* FP2 project page. Native modules; no framework or runtime dependencies. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const node = (tag, className = '', text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const TASKS = { 'flip-box': 'Flip Box', 'ev-charger': 'Insert EV Charger', 'insert-peg': 'Insert Peg', 'wipe-curve': 'Wipe Curve' };
const METHODS = { pi0: 'π₀ · LoRA', pi05: 'π₀.₅ · full', gr00t: 'GR00T N1.7', lawam: 'LaWAM', acp: 'ACP', hybridil: 'HybridIL', 'force-policy': 'Force Policy', forcevla: 'ForceVLA', 'ta-vla': 'TA-VLA', native: 'FP2', 'ablation-wrist-action': 'Ablation · wrist + action', 'ablation-wrist': 'Ablation · extra wrist vision', 'ablation-action': 'Ablation · action re-generation', 'ablation-action-expert': 'Ablation · action-expert latent', 'ablation-global-mean': 'Ablation · average-pooled context' };
const unifiedHighlightIDs = Object.fromEntries(Object.keys(TASKS).map((task) => [task, `unified-${task}`]));
const state = { videos: [], results: null, task: 'flip-box', backbone: 'pi0', highlight: 'flip-box' };
const findVideo = (id) => state.videos.find((video) => video.id === id);
const mediaURL = (path) => {
  const base = $('meta[name="media-base"]')?.content;
  // A CDN can replace only the media root without changing the catalog or routing.
  return new URL(path, base ? new URL(base, document.baseURI) : document.baseURI).href;
};

// Keep anchor offsets accurate when the compact navigation wraps on phones.
const navigation = $('.site-header');
if (navigation) new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--nav-height', `${Math.ceil(entry.target.getBoundingClientRect().height)}px`);
}).observe(navigation);

// Only visible presentation players load media.
const players = new Map();
let playersSuspended = false;
const playerObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const player = players.get(entry.target);
    if (!player) continue;
    player.visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
    player.sync();
  }
}, { threshold: 0.2 });
function syncPlayers() { players.forEach((player) => player.sync()); }
document.addEventListener('visibilitychange', syncPlayers);
window.addEventListener('pagehide', () => { playersSuspended = true; syncPlayers(); });
window.addEventListener('pageshow', () => { playersSuspended = false; syncPlayers(); });

function clearPlayerHost(host) {
  $$('video', host).forEach((video) => players.get(video)?.destroy());
  host.replaceChildren();
}
function createPlayer(entry) {
  const shell = node('div', 'video-shell');
  const video = node('video');
  video.controls = false;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.preload = 'none';
  video.tabIndex = -1;
  video.poster = mediaURL(entry.poster);
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-label', entry.title);
  const error = node('div', 'player-error');
  error.hidden = true;
  error.setAttribute('role', 'alert');
  let disposed = false;
  let pending = false;
  let blocked = false;
  let userPaused = false;
  let ignoredPauseEvents = 0;
  const canPlay = () => !disposed && video.isConnected && player.visible && !document.hidden && !playersSuspended;
  const pause = () => {
    if (!video.paused) {
      ignoredPauseEvents += 1;
      video.pause();
    }
  };
  const showError = (message) => {
    if (disposed) return;
    blocked = true;
    error.replaceChildren(node('span', '', `${message} `));
    const link = node('a', '', 'Open the MP4');
    link.href = mediaURL(entry.src);
    link.target = '_blank';
    link.rel = 'noopener';
    const retry = node('button', '', 'Retry playback');
    retry.type = 'button';
    retry.addEventListener('click', () => {
      blocked = false;
      userPaused = false;
      error.hidden = true;
      video.load();
      player.sync();
    });
    error.append(link, node('span', '', ' · '), retry);
    error.hidden = false;
  };
  const start = async () => {
    if (pending || blocked || userPaused || !canPlay() || !video.paused) return;
    pending = true;
    if (!video.hasAttribute('src')) video.src = mediaURL(entry.src);
    try {
      await video.play();
      if (!canPlay()) pause();
    } catch (reason) {
      if (!disposed && reason.name !== 'AbortError' && canPlay()) {
        showError(reason.name === 'NotAllowedError'
          ? 'Your browser blocked automatic playback. Retry playback below, or'
          : 'This video could not be played.');
      }
    } finally {
      pending = false;
      // Re-entering the viewport can race a pending play() rejection from the
      // preceding automatic pause. Resume without waiting for another scroll.
      if (!disposed && !blocked && !userPaused && canPlay() && video.paused) {
        requestAnimationFrame(() => player.sync());
      }
    }
  };
  const player = {
    visible: false,
    sync() {
      if (!canPlay()) pause();
      else start();
    },
    destroy() {
      disposed = true;
      playerObserver.unobserve(video);
      players.delete(video);
      pause();
      video.removeAttribute('src');
      video.load();
    },
  };
  video.addEventListener('pause', () => {
    if (ignoredPauseEvents) { ignoredPauseEvents -= 1; return; }
    if (!disposed && canPlay() && !video.ended) userPaused = true;
  });
  video.addEventListener('play', () => {
    if (!canPlay()) { pause(); return; }
    userPaused = false;
    blocked = false;
    error.hidden = true;
  });
  video.addEventListener('error', () => showError('This video could not be loaded.'));
  // canplay also covers a fast leave/re-enter while an earlier play promise aborts.
  video.addEventListener('canplay', () => player.sync());
  players.set(video, player);
  playerObserver.observe(video);
  shell.append(video, error);
  return shell;
}
function mountPlayer(host, entry) {
  clearPlayerHost(host);
  if (entry) host.append(createPlayer(entry));
  else host.append(node('div', 'media-placeholder', 'This video is not available. Please try another task or consult the paper.'));
}
function selectHighlight(task) {
  state.highlight = task;
  $$('[data-highlight]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.highlight === task)));
  const unified = state.videos.find((video) => video.id === unifiedHighlightIDs[task]);
  const entry = unified;
  mountPlayer($('#hero-player'), entry);
  $('#highlight-caption').textContent = unified
    ? `${TASKS[task]} · ${unified.methods.map((method) => METHODS[method] || method).join(' / ')} with and without FP2.`
    : `${TASKS[task]} demonstration unavailable.`;
}
function setFigure() {
  const targets = { method: '#method-figure', tasks: '#task-figure', failures: '#failure-figure' };
  for (const [id, selector] of Object.entries(targets)) {
    const figure = state.results?.figures?.find((item) => item.id === id);
    const host = $(selector);
    if (!figure || !host) continue;
    const image = node('img');
    image.src = figure.src;
    image.alt = figure.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    host.replaceChildren(image, node('figcaption', '', figure.caption));
  }
}

function resultBar(label, value, ours = false) {
  const row = node('div', 'result-row');
  const heading = node('div', `result-row-label${ours ? ' fp2-label' : ''}`);
  heading.append(node('span', '', label), node('strong', '', `${value}%`));
  const track = node('div', 'bar-track');
  const fill = node('div', `bar-fill${ours ? ' ours' : ''}`);
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  track.setAttribute('aria-hidden', 'true');
  track.append(fill);
  row.append(heading, track);
  return row;
}
function experimentVideo(task, method, ours) {
  return findVideo(`${task}-${method}-${ours ? 'fp2' : 'baseline'}`);
}
function renderExperiment() {
  if (!state.results) return;
  const taskIndex = state.results.tasks.findIndex((task) => task.id === state.task);
  const task = state.results.tasks[taskIndex];
  const backbone = state.results.backbones.find((item) => item.id === state.backbone);
  const baseline = state.results.baselines.find((item) => item.id === state.backbone);
  if (!task || (!backbone && !baseline)) return;
  // Standalone baselines are not FP2 backbones. Compare them to the explicitly
  // labeled π0 LoRA + FP2 reference rather than inventing e.g. "ACP + FP2".
  const reference = backbone || state.results.backbones.find((item) => item.id === 'pi0');
  const beforeData = backbone ? backbone.baseline : baseline;
  const beforeLabel = METHODS[state.backbone] || (backbone || baseline).label;
  const afterLabel = `${METHODS[reference.id] || reference.label} + FP2`;
  $$('[data-task]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.task === state.task)));
  const result = $('#experiment-result');
  const context = node('div', 'experiment-context');
  context.append(node('h3', '', task.label), node('p', '', task.description), node('p', 'task-insight', task.insight));
  const metrics = node('div', 'experiment-metrics');
  const metric = node('div', 'metric-heading');
  const before = beforeData.scores[taskIndex];
  const after = reference.fp2.scores[taskIndex];
  const difference = after - before;
  const delta = node('span', `gain${difference <= 0 ? ' neutral' : ''}`, `${difference > 0 ? '+' : ''}${difference} pp${baseline ? ' difference' : ''}`);
  delta.title = `${afterLabel} minus ${beforeLabel}; ${baseline ? 'cross-method comparison, not an FP2 ablation' : 'same foundation policy with and without FP2'}.`;
  metric.append(node('span', '', `${state.task === 'wipe-curve' ? 'Completion rate' : 'Success rate'} · 25 trials`), delta);
  metrics.append(metric, resultBar(beforeLabel, before), resultBar(afterLabel, after, true));
  const nfe = node('div', 'nfe-row');
  const nfeBefore = beforeData.nfe[taskIndex];
  const nfeAfter = reference.fp2.nfe[taskIndex];
  nfe.append(node('span', '', 'Normalized force error ↓'), node('strong', '', `${nfeBefore === null ? '—' : nfeBefore.toFixed(3)} → ${nfeAfter === null ? '—' : nfeAfter.toFixed(3)}`), node('span', '', 'Successful executions only'));
  metrics.append(nfe);
  result.replaceChildren(context, metrics);
  $('#comparison-protocol').textContent = backbone
    ? `${beforeLabel} is compared with its own FP2 version, using the same task evaluation protocol.`
    : ['forcevla', 'ta-vla'].includes(baseline.id)
      ? `${beforeLabel} and the FP2 reference use the matched π₀ LoRA backbone, task demonstrations, and evaluation configurations from Table I. This compares different methods, not ${beforeLabel} with and without FP2.`
      : `${beforeLabel} is a task-specific force-control baseline. The reference is π₀ LoRA + FP2 from Table I—not ${beforeLabel} + FP2. The percentage-point difference is between methods, not an FP2 ablation.`;
  const host = $('#experiment-players');
  clearPlayerHost(host);
  const comparisons = [
    { method: state.backbone, ours: false, label: `${beforeLabel}${backbone ? ' · foundation policy' : ' · baseline'}` },
    { method: reference.id, ours: true, label: afterLabel },
  ];
  comparisons.forEach(({ method, ours, label }) => {
    const wrapper = node('div', 'comparison-player');
    wrapper.append(node('p', `comparison-player-label${ours ? ' ours' : ''}`, label));
    const entry = experimentVideo(state.task, method, ours);
    if (entry) {
      wrapper.append(createPlayer(entry));
      wrapper.append(node('p', 'comparison-speed fine-print', entry.speedNote || 'Edited, accelerated rollout montage.'));
    } else {
      wrapper.append(node('div', 'media-placeholder', `${METHODS[method] || method}: evaluation video unavailable for ${task.label}. The scores above are from the paper.`));
    }
    host.append(wrapper);
  });
}
function tableHead(labels) {
  const head = node('thead');
  const row = node('tr');
  labels.forEach((label) => {
    const th = node('th', '', label);
    th.scope = 'col';
    row.append(th);
  });
  head.append(row);
  return head;
}
function renderFullResults() {
  const table = node('table');
  table.append(node('caption', '', 'Table I · Task performance (%) with normalized force error shown below each score.'));
  table.append(tableHead(['Policy', 'Flip Box · SR', 'EV Charger · SR', 'Insert Peg · SR', 'Wipe Curve · CR', 'Average']));
  const body = node('tbody');
  const rows = [...state.results.baselines];
  state.results.backbones.forEach((backbone) => {
    const label = METHODS[backbone.id] || backbone.label;
    rows.push({ ...backbone.baseline, label });
    rows.push({ ...backbone.fp2, label: `${label} + FP2`, ours: true });
  });
  rows.forEach((item) => {
    const row = node('tr', item.ours ? 'ours' : '');
    const th = node('th', '', item.label);
    th.scope = 'row';
    row.append(th);
    item.scores.forEach((score, index) => {
      const td = node('td', '', `${score}%`);
      td.append(node('small', '', `NFE ${item.nfe[index] === null ? '—' : item.nfe[index].toFixed(3)}`));
      row.append(td);
    });
    row.append(node('td', '', `${item.average}%`));
    body.append(row);
  });
  table.append(body);
  $('#full-results').replaceChildren(table);
}
function ablationBar(item, label, latency = false) {
  const ours = item.group === 'ours';
  const row = node('div', `ablation-row${ours ? ' ours' : ''}`);
  const heading = node('div', 'ablation-label');
  const title = node('span', '', label || item.label);
  if (latency) title.append(node('small', '', ` · ${item.latency.toFixed(2)} ms`));
  heading.append(title, node('strong', '', `${item.novel}%`));
  const track = node('div', 'bar-track');
  const fill = node('div', `bar-fill${ours ? ' ours' : ''}`);
  fill.style.width = `${item.novel}%`;
  track.setAttribute('aria-hidden', 'true');
  track.append(fill);
  row.append(heading, track);
  return row;
}
function renderAblations() {
  const items = state.results.ablations;
  const ours = items.find((item) => item.group === 'ours');
  const inputs = items.filter((item) => item.group === 'inputs');
  $('#input-ablation').replaceChildren(...inputs.map((item) => ablationBar(item)));
  if (ours) $('#input-ablation').append(ablationBar(ours, 'Context + physical feedback (FP2)'));
  // Exact latency identifies the action-only ablation even if its prose label changes.
  const action = items.find((item) => item.group === 'architecture' && Math.abs(item.latency - 13.03) < 0.01);
  const wristAction = items.find((item) => item.group === 'architecture' && Math.abs(item.latency - 14.44) < 0.01);
  $('#architecture-ablation').replaceChildren();
  if (action) $('#architecture-ablation').append(ablationBar(action, 'Re-generate actions', true));
  if (wristAction) $('#architecture-ablation').append(ablationBar(wristAction, 'Wrist vision + action re-generation', true));
  if (ours) $('#architecture-ablation').append(ablationBar(ours, 'Regulation only (FP2)', true));
  const table = node('table');
  table.append(node('caption', '', 'Table II · Flip Box with π₀.₅. Novel-object results aggregate 40 trials (10 per object).'));
  table.append(tableHead(['Force-control policy design', 'Seen-object SR', 'Novel-object SR', 'Latency']));
  const body = node('tbody');
  items.forEach((item) => {
    const row = node('tr', item.group === 'ours' ? 'ours' : '');
    const th = node('th', '', item.label);
    th.scope = 'row';
    row.append(th, node('td', '', `${item.seen}%`), node('td', '', `${item.novel}%`), node('td', '', `${item.latency.toFixed(2)} ms`));
    body.append(row);
  });
  table.append(body);
  $('#full-ablations').replaceChildren(table);
}
function renderGeneralization() {
  mountPlayer($('#generalization-player'), findVideo('generalization-fp2-vs-wrist-action'));
}

async function copyText(text, status) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied to clipboard.';
  } catch {
    status.replaceChildren(node('span', '', 'Select and copy: '));
    const input = node('textarea');
    input.value = text;
    input.readOnly = true;
    input.setAttribute('aria-label', 'Text to copy');
    input.style.width = '100%';
    input.rows = text.includes('\n') ? 6 : 2;
    status.append(input);
    input.focus();
    input.select();
  }
}
function bindEvents() {
  $$('[data-highlight]').forEach((button) => button.addEventListener('click', () => selectHighlight(button.dataset.highlight)));
  $$('[data-task]').forEach((button) => button.addEventListener('click', () => { state.task = button.dataset.task; renderExperiment(); }));
  $('#backbone').addEventListener('change', (event) => { state.backbone = event.target.value; renderExperiment(); });
  $('#copy-citation').addEventListener('click', () => copyText($('#bibtex').textContent, $('#citation-status')));
}
async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
function reportError(message) {
  const error = $('#app-error');
  error.hidden = false;
  error.append(node('p', '', message));
}
async function init() {
  // Content remains readable if either independent data source cannot be loaded.
  const [catalog, results] = await Promise.allSettled([
    loadJSON('assets/data/videos.json'), loadJSON('assets/data/results.json'),
  ]);
  if (catalog.status === 'fulfilled' && Array.isArray(catalog.value.videos)) {
    state.videos = catalog.value.videos;
    selectHighlight(state.highlight);
    renderGeneralization();
  } else {
    reportError('The video catalog could not be loaded. Serve this folder over HTTP (rather than opening index.html directly) and reload. The paper and project text are still available.');
    $$('.media-placeholder').forEach((item) => item.textContent = 'Video catalog unavailable. Please reload or open the paper.');
  }
  if (results.status === 'fulfilled' && Array.isArray(results.value.tasks)) {
    state.results = results.value;
    setFigure();
    renderExperiment();
    renderFullResults();
    renderAblations();
  } else {
    reportError('Interactive results could not be loaded. The verified results are available in Tables I and II of the paper.');
    $('#experiment-result').textContent = 'Results unavailable. Please refer to Table I in the paper.';
  }
  bindEvents();
}
init().catch((error) => {
  console.error(error);
  reportError('Part of the interactive page could not be initialized. Reload to try again, or read the linked paper.');
});
