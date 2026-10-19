import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual button callback, including its optional AGV dependencies.
// Rendering is stubbed here; the smoke suites cover real MuJoCo state restoration.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const helpers = ['stopAgv', 'setGoalPickMode', 'cancelAgvNavigation'].map((name) => {
  const match = source.match(new RegExp(`^  function ${name}\\([^]*?^  }`, 'm'));
  assert(match, `Missing ${name}`);
  return match[0];
});
const binding = source.match(/^  resetEl\.addEventListener\('click', [^]*?^  \}\);/m);
assert(binding, 'Missing Reset click binding');

for (const mode of ['arm', 'agv-idle', 'agv-navigating', 'agv-docked']) {
  const hasAgv = mode !== 'arm';
  const events = [];
  let click;
  const record = (name) => () => events.push(name);
  const goal = hasAgv ? { x: 1, y: 2 } : null;
  const context = vm.createContext({
    resetEl: {
      addEventListener(type, callback) {
        assert.equal(type, 'click');
        click = callback;
      }
    },
    agvKeys: new Set(['forward']),
    agvController: hasAgv ? {
      stop: record('drive-stop'),
      releasePlanarPose: record('release-dock')
    } : null,
    agvNavigation: hasAgv ? {
      cancel() {
        events.push('cancel-navigation');
        const wasActive = context.agvNavigationState.active;
        context.agvNavigationState = { active: false, goal };
        return wasActive;
      },
      state: () => ({ goal })
    } : null,
    agvNavigationState: { active: mode === 'agv-navigating', goal },
    agvDocked: mode === 'agv-docked' || !hasAgv,
    navGoalPickMode: true,
    modelVariant: { hasAgv },
    viewportEl: { classList: { toggle: () => {} } },
    view: {
      setGroundPickHandler: () => {},
      resetExplosion: record('reset-explosion'),
      clearPartSelection: record('clear-selection'),
      setNavigationGoalMarker: () => {}
    },
    tcpDrag: { stop: record('stop-drag') },
    graspDemo: { reset: record('reset-grasp') },
    telemetryPanel: { reset: record('reset-telemetry') },
    physics: { reset: record('reset-physics'), targets: { joint1: 0, joint7: 0 } },
    objectPositionController: {
      reset: record('reset-object-edit'),
      setEnabled(enabled) { assert.equal(enabled, !hasAgv); }
    },
    panel: { setTarget: () => {}, setActual: () => {} },
    renderExplosionControls: () => {},
    renderAgvNavigationControls: () => {},
    renderGraspControls: () => {},
    setAgvNavigationMessage: () => {},
    t: (key) => key,
    readyCount: 1,
    setStatus: record('ready')
  });
  vm.runInContext([...helpers, binding[0]].join('\n'), context);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    events.length = 0;
    assert.doesNotThrow(() => click(), `${mode}: Reset must complete`);
    for (const event of [
      'stop-drag', 'reset-grasp', 'reset-telemetry', 'reset-explosion',
      'clear-selection', 'reset-physics', 'reset-object-edit', 'ready'
    ]) assert(events.includes(event), `${mode}: missing ${event}`);
    assert(events.indexOf('reset-grasp') < events.indexOf('reset-physics'));
    assert(events.indexOf('reset-physics') < events.indexOf('reset-object-edit'));
    assert.equal(context.navGoalPickMode, false);
    assert.equal(context.agvDocked, !hasAgv);
    if (hasAgv) {
      assert(events.includes('cancel-navigation'), `${mode}: route must be cleared`);
      assert(events.includes('release-dock'), `${mode}: dock must be released`);
      assert.equal(context.agvKeys.size, 0);
      assert.equal(context.agvNavigationState.active, false);
    }
  }
}

console.log('Reset click regression: arm, idle/navigating/docked AGV and repeated clicks passed.');
