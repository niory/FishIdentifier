const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const normalize = value => value.trim().toLowerCase();
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async () => {
  const server = spawn(process.execPath, ['scripts/serve-build.cjs'], {cwd:root, stdio:['ignore','pipe','inherit']});
  let browser;
  try {
    await new Promise((resolve,reject)=>{
      server.stdout.on('data',chunk=>{if(chunk.toString().includes('Production preview:'))resolve();});
      server.on('error',reject); server.on('exit',code=>reject(new Error('Preview server exited: '+code)));
    });
    browser = await chromium.launch({headless:true});
    const context = await browser.newContext({serviceWorkers:'block'});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173');
    await page.getByRole('button',{name:'📁 Выбрать фото'}).waitFor({timeout:45000});
    const cases = JSON.parse(fs.readFileSync(path.join(root,'tests/photos/sources.json'),'utf8'));
    cases.push({id:'control-react-logo',expected:'unknown',file:'public/logo192.png',source:'Repository React logo',species:'Non-fish control'});
    const rows=[];
    for (const sample of cases) {
      await page.getByLabel('Фото рыбы').setInputFiles(path.join(root,sample.file));
      await page.locator('.result-section').waitFor({timeout:30000});
      const scores=await page.locator('.prediction-score').evaluateAll(elements=>elements.map(e=>({className:e.dataset.class, probability:Number(e.dataset.probability)})));
      const uncertain=await page.locator('.result-section').getAttribute('data-uncertain')==='true';
      const top=scores[0];
      rows.push({...sample,top:top.className,confidence:top.probability,uncertain,correct:normalize(top.className)===normalize(sample.expected),scores});
      console.log(sample.id, 'expected='+sample.expected,'top='+top.className,(top.probability*100).toFixed(2)+'%',uncertain?'DECLINED':'ACCEPTED');
      await page.getByRole('button',{name:'🗑️ Сбросить'}).click();
    }
    const fish=rows.filter(r=>r.expected!=='unknown');
    const report={date:new Date().toISOString(),note:'Small convenience sample, two Commons photographs per broad class. No training-set provenance is available, so independence and generalization cannot be established. UI cutoffs 0.8 top score / 0.15 margin are uncalibrated heuristics.',fishCount:fish.length,top1Correct:fish.filter(r=>r.correct).length,acceptedCorrect:fish.filter(r=>r.correct&&!r.uncertain).length,acceptedIncorrect:fish.filter(r=>!r.correct&&!r.uncertain).length,declined:fish.filter(r=>r.uncertain).length,rows};
    fs.mkdirSync(path.join(root,'reports'),{recursive:true});
    fs.writeFileSync(path.join(root,'reports/photo-evaluation.json'),JSON.stringify(report,null,2)+'\n');
    const md=['# Проверка модели на фотографиях','',`Дата: ${report.date}`,'',`Верный первый класс: ${report.top1Correct}/${fish.length}. Уверенные верные ответы: ${report.acceptedCorrect}. Уверенные ошибки: ${report.acceptedIncorrect}. Отказы: ${report.declined}.`,'','Это небольшая подборка из интернета, не оценка общей точности. Состав обучающей выборки неизвестен. Сом, гурами и окунь проверены на двух разных видах внутри широкой категории; метаданные модели не уточняют виды обучения.','', '| Фото | Ожидание | Ответ | Оценка | Решение |','|---|---|---|---:|---|', ...rows.map(r=>`| [${r.id}](${r.source.startsWith('http')?r.source:'../'+r.file}) | ${r.expected} | ${r.top} | ${(r.confidence*100).toFixed(2)}% | ${r.uncertain?'Отказ':r.correct?'Верно':'Ошибка'} |`),'','Пороги интерфейса: оценка не ниже 80%, отрыв от второго класса не меньше 15 процентных пунктов, класс unknown всегда означает отказ. Эти пороги не калиброваны на контрольной выборке.',''];
    fs.writeFileSync(path.join(root,'reports/photo-evaluation.md'),md.join('\n'));
    const cards=rows.map(r=>`<article><img src="../${escape(r.file)}"><h2>${escape(r.id)}</h2><p>Ожидание: ${escape(r.expected)}<br>Ответ: <b>${escape(r.top)}</b> · ${(r.confidence*100).toFixed(2)}%<br>${r.uncertain?'Отказ от уверенного ответа':r.correct?'Верно':'Уверенная ошибка'}</p><a href="${escape(r.source)}">Источник</a><p>${escape(r.author||'')} · ${escape(r.license||'')}</p></article>`).join('');
    fs.writeFileSync(path.join(root,'reports/photo-evaluation.html'),`<!doctype html><meta charset="utf-8"><title>Проверка FishIdentifier</title><style>body{font:16px system-ui;background:#edf3fa;padding:24px;color:#182b42}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{background:white;padding:16px;border-radius:12px}img{width:100%;height:190px;object-fit:contain}h2{font-size:17px}a{color:#165aa1}p{line-height:1.6}</style><h1>FishIdentifier: проверка фотографий</h1><p>Первый класс верен на ${report.top1Correct} из ${fish.length} фото рыб. Уверенных ошибок: ${report.acceptedIncorrect}. Выборка мала; общая точность неизвестна.</p><main>${cards}</main>`);
    await page.goto('file://'+path.join(root,'reports/photo-evaluation.html'));
    await page.setViewportSize({width:1200,height:900});
    await page.screenshot({path:path.join(root,'reports/photo-evaluation.png'),fullPage:true});
    console.log('SUMMARY',JSON.stringify({fishCount:report.fishCount,top1Correct:report.top1Correct,acceptedCorrect:report.acceptedCorrect,acceptedIncorrect:report.acceptedIncorrect,declined:report.declined}));
  } finally { await browser?.close(); server.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
