const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../build');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
const assets = files(root).filter(file => !file.endsWith('.map') && path.basename(file) !== 'service-worker.js').sort();
const hash = crypto.createHash('sha256');
for (const file of assets) { hash.update(path.relative(root, file)); hash.update(fs.readFileSync(file)); }
const version = hash.digest('hex').slice(0, 16);
const paths = assets.map(file => './' + path.relative(root, file).split(path.sep).join('/'));
const worker = fs.readFileSync(path.resolve(__dirname, '../public/service-worker.js'), 'utf8');
fs.writeFileSync(path.join(root, 'service-worker.js'),
  `self.__FISH_VERSION__ = ${JSON.stringify(version)};\nself.__FISH_PRECACHE__ = ${JSON.stringify(paths)};\n` + worker);
console.log(`Service Worker: ${paths.length} assets, including model weights; version ${version}`);
