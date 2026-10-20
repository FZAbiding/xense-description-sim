import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function ready(page) {
  await page.goto('./');
  await page.waitForFunction(() => window.xensePreview?.ready);
  await expect(page.locator('#loading')).toBeHidden();
}

async function moveJoint(page, name, degrees) {
  const slider = page.locator(`[data-joint="${name}"]`);
  await slider.evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, degrees);
}

async function feedPixels(page, side) {
  return page.locator(`#${side}-camera-canvas`).evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 16) {
      hash = Math.imul(hash ^ pixels[i], 16777619);
      colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
    }
    return { hash, colors: colors.size };
  });
}

test('dual-arm controls, independent camera poses, live images and PNG/JSON downloads', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const initial = await page.evaluate(() => window.xensePreview.state());
  expect(Object.keys(initial.joints)).toHaveLength(18);
  const pixels = await feedPixels(page, 'left');
  expect(pixels.colors).toBeGreaterThan(12);
  expect((await feedPixels(page, 'right')).colors).toBeGreaterThan(12);
  await moveJoint(page, 'left_joint1', 65);
  await page.waitForFunction(() => window.xensePreview.state().cameras[0].frames > 1);
  const moved = await page.evaluate(() => window.xensePreview.state());
  expect(Math.abs(moved.joints.left_joint1 - 65 * Math.PI / 180)).toBeLessThan(0.01 * Math.PI / 180);
  expect(moved.cameras[0].position).not.toEqual(initial.cameras[0].position);
  expect(moved.cameras[1].position).toEqual(initial.cameras[1].position);
  expect((await feedPixels(page, 'left')).hash).not.toEqual(pixels.hash);

  await page.locator('[data-gripper="left"][data-opening="0"]').click();
  let pose = await page.evaluate(() => window.xensePreview.state().joints);
  expect(pose.left_tool_taccap_right_finger_joint).toBe(0);
  expect(pose.left_tool_taccap_left_finger_joint).toBeCloseTo(0);
  await page.getByRole('tab', { name: /右臂/ }).click();
  const numeric = page.locator('[data-number="right_joint6"]');
  await numeric.fill('999');
  await numeric.press('Tab');
  pose = await page.evaluate(() => window.xensePreview.state().joints);
  expect(pose.right_joint6).toBeCloseTo(4.6251, 6);
  await page.locator('[data-gripper="right"][data-opening="0"]').click();
  await page.locator('[data-gripper="right"][data-opening="100"]').click();
  pose = await page.evaluate(() => window.xensePreview.state().joints);
  expect(pose.right_tool_taccap_left_finger_joint).toBeCloseTo(-pose.right_tool_taccap_right_finger_joint, 10);
  await page.locator('#reset-pose').click();
  expect((await page.evaluate(() => window.xensePreview.state())).joints).toEqual(initial.joints);
  await page.getByRole('tab', { name: /左臂/ }).click();

  await page.locator('#left-camera-enabled').uncheck();
  await expect(page.locator('#left-camera-state')).toHaveText('已暂停');
  const paused = await page.evaluate(() => window.xensePreview.state().cameras);
  await moveJoint(page, 'left_joint1', 60);
  await page.waitForFunction((frames) => window.xensePreview.state().cameras[1].frames > frames, paused[1].frames);
  expect((await page.evaluate(() => window.xensePreview.state().cameras))[0].frames).toBe(paused[0].frames);
  await page.locator('#left-camera-enabled').check();
  await page.locator('#reset-pose').click();
  await page.locator('#show-frusta').check();
  await page.locator('#show-frusta').uncheck();
  await page.locator('#show-reference').uncheck();
  await page.locator('#show-reference').check();
  for (const view of ['front', 'side', 'top', 'perspective']) {
    await page.locator(`[data-view="${view}"]`).click();
    await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-pressed', 'true');
  }

  for (const side of ['left', 'right']) {
    const downloaded = page.waitForEvent('download');
    await page.locator(`[data-capture="${side}"]`).click();
    const download = await downloaded;
    const buffer = await readFile(await download.path());
    expect(buffer.subarray(1, 4).toString()).toBe('PNG');
    expect(buffer.readUInt32BE(16)).toBe(640);
    expect(buffer.readUInt32BE(20)).toBe(480);
    expect(buffer.length).toBeGreaterThan(4000);
    await testInfo.attach(`${side}-wrist`, { body: buffer, contentType: 'image/png' });
  }
  const mainDownload = page.waitForEvent('download');
  await page.locator('#capture-main').click();
  expect((await mainDownload).suggestedFilename()).toMatch(/main\.png$/);
  const mainBuffer = await readFile(await (await mainDownload).path());
  expect(mainBuffer.length).toBeGreaterThan(10000);
  const poseDownload = page.waitForEvent('download');
  await page.locator('#export-pose').click();
  const exported = JSON.parse(await readFile(await (await poseDownload).path(), 'utf8'));
  expect(exported.unit).toBe('rad');
  expect(exported.joints).toEqual(initial.joints);
  expect(exported.cameras).toHaveLength(2);
  expect(exported.cameras[0].calibrated).toBe(false);
  expect(errors).toEqual([]);
});

test('mobile layout exposes controls and both wrist feeds without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#viewport canvas')).toBeVisible();
  await page.getByRole('tab', { name: /右臂/ }).click();
  await expect(page.locator('#right-controls')).toBeVisible();
  await page.locator('#right-camera-canvas').scrollIntoViewIfNeeded();
  await expect(page.locator('#left-camera-canvas')).toBeVisible();
  await expect(page.locator('#right-camera-canvas')).toBeVisible();
  await testInfo.attach('mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('original reBot page loads through the preserved entry point', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('rebot.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/is-hidden/, { timeout: 60000 });
  await expect(page.locator('#viewport canvas').first()).toBeVisible();
  expect(errors).toEqual([]);
});
