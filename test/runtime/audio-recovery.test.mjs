import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real handlers and effect dependencies with a controlled media clock.
// Native event delivery and the rendered UI are verified separately in the browser.
const compile = async path => ts.transpileModule(await readFile(new URL('../../src/' + path, import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React, esModuleInterop: true},
}).outputText;
const sources = Object.fromEntries(await Promise.all(['components/audio/AudioEngine.tsx',
  'components/audio/EnhancedAudioPlayer.tsx', 'utils/loopTimeline.ts', 'stores/timelineStore.ts']
  .map(async path => [path, await compile(path)])));

function fixture() {
  const hooks = [], effects = [], timers = new Map(), statuses = [], playing = [];
  let cursor = 0, now = 10000, timerId = 0, loads = 0, plays = 0, props, element;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    useRef(value) {const id = cursor++; return hooks[id] ??= {current: value};},
    useState(value) {const id = cursor++; hooks[id] ??= {value}; return [hooks[id].value, v => {hooks[id].value = v;}];},
    useCallback(fn, deps) {const id = cursor++; if (!same(hooks[id]?.deps, deps)) hooks[id] = {deps, fn}; return hooks[id].fn;},
    useEffect(fn, deps) {
      const id = cursor++;
      if (!same(hooks[id]?.deps, deps)) {
        const previous = hooks[id]; hooks[id] = {deps};
        effects.push(() => {previous?.cleanup?.(); hooks[id].cleanup = fn();});
      }
    },
  };
  const context = vm.createContext({window: {}, console: {log() {}, warn() {}, error() {}},
    Date: {now: () => now}, performance, Math,
    setTimeout: (fn, delay) => {const id = ++timerId; timers.set(id, {fn, at: now + delay}); return id;},
    clearTimeout: id => timers.delete(id), requestAnimationFrame: () => 1, cancelAnimationFrame() {}});
  const modules = new Map();
  const load = path => {
    if (modules.has(path)) return modules.get(path);
    const module = {exports: {}};
    const require = id => id === 'react' ? {__esModule: true, default: react, ...react} :
      load(id.replace(/^@\//, '') + '.ts');
    vm.runInContext('(function(require,module,exports){' + sources[path] + '\n})', context)(require, module, module.exports);
    modules.set(path, module.exports); return module.exports;
  };
  const audio = {src: '/test.mp3', currentTime: 0, duration: 40, readyState: 0, paused: true, error: null, seeking: false,
    getAttribute: () => audio.src, removeAttribute: () => {audio.src = '';},
    load() {loads++; audio.currentTime = 0; audio.readyState = 0; audio.error = null;},
    pause() {audio.paused = true;}, play() {plays++; audio.paused = false; return Promise.resolve();}};
  const timeline = load('stores/timelineStore.ts').default;
  props = {audioSrc: '/test.mp3', sessionRevision: 0, isPlaying: false, isReady: false, currentTime: 0,
    loopCount: 0, duration: 40, retrySignal: 0, seekSignal: 0, enableWebAudio: false,
    onReady() {}, onTimeUpdate() {}, onDurationChange() {}, onLoopComplete() {},
    onStatusChange: s => statuses.push(s), onPlayStateChange: s => playing.push(s)};
  function render(update = {}) {
    props = {...props, ...update}; cursor = 0;
    element = load('components/audio/AudioEngine.tsx').AudioEngine(props);
    element.props.ref.current = audio; audio.src = props.audioSrc;
    while (effects.length) effects.shift()();
    return element;
  }
  function event(name) {element.props[name]({currentTarget: audio});}
  function ready() {audio.readyState = 4; audio.error = null; event('onLoadedMetadata'); event('onCanPlay');}
  function error(code = 2) {audio.error = {code}; event('onError');}
  function runNext() {
    const [id, timer] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    timers.delete(id); now = timer.at; timer.fn();
  }
  render();
  return {audio, timeline, statuses, playing, timers, render, event, ready, error, runNext,
    load, react, counts: () => ({loads, plays}), handlers: () => element.props};
}

test('startup failures stop after two retries and expose a recoverable error', () => {
  const f = fixture();
  f.error(); assert.equal(f.timers.size, 1); f.error(); assert.equal(f.timers.size, 1); f.runNext();
  f.error(); f.error(); assert.equal(f.statuses.at(-1).status, 'loading');
  f.runNext(); f.error();
  assert.equal(f.counts().loads, 2); assert.equal(f.timers.size, 0);
  assert.equal(f.statuses.at(-1).status, 'error');
  assert.match(f.statuses.at(-1).message, /网络/); assert.equal(f.playing.at(-1), false);
  f.render({retrySignal: 1}); assert.equal(f.counts().loads, 3);
  assert.equal(f.statuses.at(-1).status, 'loading');
  f.ready(); assert.equal(f.statuses.at(-1).status, 'ready'); assert.equal(f.counts().plays, 0);
});

test('manual retry preserves a signed cycle, honors a newer seek and stays paused', () => {
  const f = fixture(); f.ready();
  f.render({isReady: true, currentTime: 7, loopCount: -3, seekSignal: 1});
  assert.equal(f.audio.currentTime, 7); f.error(3);
  assert.equal(f.timeline.sampleAudioTime().absolute, -113);
  f.render({isReady: false, retrySignal: 1});
  assert.equal(f.audio.currentTime, 0); assert.equal(f.timeline.sampleAudioTime().absolute, -113);
  f.timeline.requestAudioTime(12, -108);
  f.render({currentTime: 12, seekSignal: 2}); f.ready();
  assert.equal(f.audio.currentTime, 12); assert.equal(f.timeline.pendingAudioSeek, null);
  assert.equal(f.timeline.sampleAudioTime().absolute, -108); assert.equal(f.counts().plays, 0);
});

test('native waiting is deduplicated, playing clears it and paused recovery never plays', () => {
  const f = fixture(); f.ready(); f.render({isReady: true, isPlaying: true});
  f.audio.readyState = 2; f.event('onWaiting'); f.event('onWaiting'); f.event('onStalled');
  assert.deepEqual(f.statuses.map(s => s.status), ['loading', 'ready', 'buffering']);
  f.audio.readyState = 4; f.event('onPlaying'); assert.equal(f.statuses.at(-1).status, 'ready');
  f.audio.readyState = 2; f.event('onWaiting'); f.render({isPlaying: false});
  const before = f.counts().plays; f.audio.readyState = 4; f.event('onCanPlay'); f.event('onPlaying');
  assert.equal(f.audio.paused, true); assert.equal(f.counts().plays, before);
  assert.equal(f.statuses.at(-1).status, 'ready');
});

test('a playback decode failure is immediately visible and does not restart the track', () => {
  const f = fixture(); f.ready(); f.render({isReady: true, isPlaying: true});
  const before = f.counts().loads; f.error(3);
  assert.equal(f.counts().loads, before); assert.equal(f.timers.size, 0);
  assert.equal(f.audio.paused, true); assert.match(f.statuses.at(-1).message, /解码/);
  f.error(3); assert.equal(f.timers.size, 0); assert.equal(f.counts().loads, before);
});

test('a same-source session change cancels retries and ignores old callbacks', () => {
  const f = fixture(); f.error();
  const oldTimer = [...f.timers.values()][0].fn, oldHandlers = f.handlers();
  f.render({sessionRevision: 1});
  assert.equal(f.timers.size, 0); const before = f.counts().loads;
  oldTimer(); f.audio.readyState = 4; oldHandlers.onCanPlay();
  f.audio.error = {code: 3}; oldHandlers.onError({currentTarget: f.audio});
  assert.equal(f.counts().loads, before); assert.equal(f.statuses.at(-1).status, 'loading');
  f.ready(); assert.equal(f.statuses.at(-1).status, 'ready');
});

test('a retry command is consumed once across a recording switch and playback intent survives', () => {
  const f = fixture();
  f.render({retrySignal: 1}); f.ready();
  f.render({isReady: true, isPlaying: true});
  const before = f.counts();
  f.render({sessionRevision: 1, audioSrc: '/next.mp3', retrySignal: 1});
  // Only the existing source-effect cleanup calls load(); no retry for the new recording.
  assert.equal(f.counts().loads, before.loads + 1);
  f.ready(); assert.ok(f.counts().plays > before.plays);
});

test('buffer estimates do not report a stall while actual playback is healthy', () => {
  const f = fixture(); f.ready(); f.render({isReady: true, isPlaying: true});
  f.audio.currentTime = 39.9; f.event('onTimeUpdate'); f.event('onStalled');
  assert.equal(f.statuses.at(-1).status, 'ready');
});

test('pausing cancels an unresolved play promise and a later canplay cannot resume it', async () => {
  const f = fixture(); f.ready();
  let resolvePlay;
  f.audio.play = () => new Promise(resolve => {resolvePlay = resolve;});
  f.render({isReady: true, isPlaying: true});
  f.render({isPlaying: false}); resolvePlay();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.playing.includes(true), false); assert.equal(f.audio.paused, true);
  f.event('onCanPlay'); assert.equal(f.audio.paused, true);
});

test('buffering keeps pause and seek enabled; errors expose an actionable retry', () => {
  const f = fixture();
  const player = f.load('components/audio/EnhancedAudioPlayer.tsx').default;
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of (node.props?.children ?? []).flat(Infinity)) {const result = find(child, predicate); if (result) return result;}
    return null;
  };
  const props = {isReady: true, isPlaying: true, isBuffering: true, duration: 40, currentTime: 7, onSeek() {}, onPlayPause() {}};
  const buffering = player(props);
  assert.equal(find(buffering, n => n.type === 'button').props.disabled, false);
  assert.equal(find(buffering, n => n.type === 'input').props.disabled, false);
  let retried = false;
  const failed = player({...props, isReady: false, isPlaying: false, isBuffering: false,
    errorMessage: '录音加载失败', onRetry: () => {retried = true;}});
  assert.ok(find(failed, n => n.props?.role === 'alert'));
  const retry = find(failed, n => n.type === 'button' && n.props.children.includes('重试'));
  assert.ok(retry); retry.props.onClick(); assert.equal(retried, true);
});
