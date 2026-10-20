export function createFlexivLayout(workspace) {
  const element = (id) => document.getElementById(id);
  const cameras = element('camera-overlays');
  const controls = element('controls-panel');
  const bottom = element('bottom-overlays');
  const cameraButton = element('toggle-camera-views');
  const controlsButton = element('toggle-controls');
  const focusButton = element('focus-view');
  let camerasVisible = true;
  let controlsVisible = true;
  let focused = false;

  function refresh() {
    cameras.hidden = focused || !camerasVisible;
    controls.hidden = focused || !controlsVisible;
    bottom.hidden = focused;
    workspace.classList.toggle('controls-collapsed', controls.hidden);
    cameraButton.setAttribute('aria-pressed', String(!cameras.hidden));
    controlsButton.setAttribute('aria-pressed', String(!controls.hidden));
    focusButton.setAttribute('aria-pressed', String(focused));
    focusButton.textContent = focused ? '退出专注' : '专注视图';
    cameraButton.title = cameras.hidden ? '显示相机浮窗' : '隐藏相机浮窗';
    controlsButton.title = controls.hidden ? '显示控制区' : '隐藏控制区';
  }

  function toggleCameras() {
    camerasVisible = focused || !camerasVisible;
    focused = false;
    refresh();
  }

  function toggleControls() {
    controlsVisible = focused || !controlsVisible;
    focused = false;
    refresh();
  }

  function toggleFocus() {
    focused = !focused;
    refresh();
  }

  function keydown(event) {
    if (event.key === 'Escape' && focused) {
      focused = false;
      refresh();
    }
  }

  cameraButton.addEventListener('click', toggleCameras);
  controlsButton.addEventListener('click', toggleControls);
  focusButton.addEventListener('click', toggleFocus);
  document.addEventListener('keydown', keydown);
  refresh();

  return {
    dispose() {
      cameraButton.removeEventListener('click', toggleCameras);
      controlsButton.removeEventListener('click', toggleControls);
      focusButton.removeEventListener('click', toggleFocus);
      document.removeEventListener('keydown', keydown);
    }
  };
}
