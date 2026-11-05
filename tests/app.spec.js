const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ready = page => expect(page.getByRole('button', { name: '📁 Выбрать фото' })).toBeVisible({ timeout: 45000 });

test('uploads, translates, resets, reselects same file, rejects corrupt file', async ({page}) => {
  await page.goto('/'); await ready(page);
  const input = page.getByLabel('Фото рыбы');
  for (let i = 0; i < 2; i++) {
    await input.setInputFiles(path.join(root, 'tests/photos/pike-river.jpg'));
    await expect(page.locator('.result-section')).toBeVisible();
    await expect(page.locator('.prediction-score')).toHaveCount(5);
    await page.getByText('Все оценки модели').click();
    await expect(page.locator('.prediction-score[data-class="northern pike"]')).toContainText('щука');
    await page.getByRole('button', {name:'🗑️ Сбросить'}).click();
    await expect(page.locator('.result-section')).toHaveCount(0);
  }
  await input.setInputFiles({name:'broken.jpg', mimeType:'image/jpeg', buffer:Buffer.from('broken')});
  await expect(page.getByRole('alert')).toContainText('Не удалось прочитать или проанализировать');
  await expect(page.getByRole('button', {name:'📁 Выбрать фото'})).toBeEnabled();
});

test('shows model load failure and successfully retries', async ({page}) => {
  await page.route('**/model/model.json', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить модель');
  await expect(page.getByText('Загружаем модель…')).toHaveCount(0);
  await page.unroute('**/model/model.json');
  await page.getByRole('button',{name:'Повторить загрузку'}).click();
  await ready(page);
});

test('captures a frame and releases camera on capture and cancel', async ({page,context}) => {
  await context.grantPermissions(['camera']);
  await page.addInitScript(() => {
    window.cameraStreams=[];
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async c=>{const stream=await original(c);window.cameraStreams.push(stream);return stream;};
  });
  await page.goto('/'); await ready(page);
  await page.getByRole('button',{name:'📷 Сделать фото'}).click();
  await expect(page.locator('video')).toBeVisible();
  const capture=page.getByRole('button',{name:'📸 Сделать фото'});
  await expect(capture).toBeEnabled(); await capture.click();
  await expect(page.locator('.result-section')).toBeVisible();
  expect(await page.evaluate(()=>window.cameraStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  await page.getByRole('button',{name:'📷 Сделать фото'}).click();
  await expect(capture).toBeEnabled();
  await page.locator('.cancel-btn').click();
  await expect(page.locator('video')).toHaveCount(0);
  expect(await page.evaluate(()=>window.cameraStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
});

test('mobile layout fits at 390px including camera controls', async ({page,context}) => {
  await page.setViewportSize({width:390,height:844});
  await context.grantPermissions(['camera']);
  await page.goto('/'); await ready(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button',{name:'📷 Сделать фото'}).click();
  await expect(page.getByRole('button',{name:'📸 Сделать фото'})).toBeEnabled();
  const boxes=await page.locator('.camera-controls button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right};}));
  expect(boxes.every(b=>b.left>=0 && b.right<=390)).toBe(true);
  await page.screenshot({path:'reports/mobile.png',fullPage:true});
});

for (const base of ['/', '/nested/']) {
  test(`production PWA caches every asset and recognizes a photo offline at ${base}`, async ({page,context}) => {
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const failures=[]; page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
    await page.goto(base); await ready(page);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cached=await page.evaluate(async()=>{
      const names=await caches.keys(); const cache=await caches.open(names.find(n=>n.startsWith('fish-identifier:')));
      return (await cache.keys()).map(r=>new URL(r.url).pathname);
    });
    expect(cached).toContain(base+'model/weights.bin');
    const manifest=await page.evaluate(async()=>{const r=await fetch('manifest.json');return r.json();});
    for (const icon of manifest.icons) expect((await page.request.get(base+icon.src)).status()).toBe(200);
    const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await context.setOffline(true); await page.reload(); await ready(page);
    await page.getByLabel('Фото рыбы').setInputFiles(path.join(root,'tests/photos/pike-river.jpg'));
    await expect(page.locator('.result-section')).toBeVisible();
    expect(errors).toEqual([]); expect(failures).toEqual([]);
  });
}
