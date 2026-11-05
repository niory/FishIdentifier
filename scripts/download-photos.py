"""Download a fixed, attributed eight-photo smoke-test set from Commons."""
import hashlib
import html
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CASES = [
 ('catfish-wels', 'Catfish', 'Silurus glanis', 'Silurus glanis 02.jpg'),
 ('catfish-channel', 'Catfish', 'Ictalurus punctatus', 'Channel Catfish (Ictalurus punctatus) white background.jpg'),
 ('gourami-three-spot', 'Gourami', 'Trichopodus trichopterus', 'Trichogster trichopterus 13.jpg'),
 ('gourami-pearl', 'Gourami', 'Trichopodus leerii', 'Trichopodus leerii Natural History Museum University of Pisa.jpg'),
 ('perch-european', 'Perch', 'Perca fluviatilis', 'Perca fluviatilis - Perche commune - European perch (cropped).jpg'),
 ('perch-yellow', 'Perch', 'Perca flavescens', 'Yellow Perch (Perca flavescens) (cropped).jpg'),
 ('pike-aquarium', 'northern pike', 'Esox lucius', 'Esox lucius ZOO 1.jpg'),
 ('pike-river', 'northern pike', 'Esox lucius', 'Esox lucius.jpg'),
]

def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'FishIdentifierReview/1.0 (local educational evaluation)'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()

def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', value))

output = ROOT / 'tests/photos'
output.mkdir(parents=True, exist_ok=True)
manifest = []
for ident, expected, species, filename in CASES:
    params = dict(action='query', format='json', prop='imageinfo', iiprop='url|extmetadata', iiurlwidth=960, titles='File:' + filename)
    data = json.loads(get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)))
    info = next(iter(data['query']['pages'].values()))['imageinfo'][0]
    meta = info['extmetadata']
    url = info.get('thumburl', info['url']).split('?')[0]
    content = get(url)
    if not content.startswith(b'\xff\xd8'):
        raise RuntimeError('Expected JPEG: ' + url)
    path = output / (ident + '.jpg')
    path.write_bytes(content)
    manifest.append(dict(id=ident, expected=expected, species=species, file='tests/photos/' + path.name,
        source=info['descriptionurl'], imageUrl=url,
        author=plain(meta.get('Artist', {}).get('value', 'See source')),
        license=meta.get('LicenseShortName', {}).get('value', 'See source'),
        licenseUrl=meta.get('LicenseUrl', {}).get('value', ''),
        sha256=hashlib.sha256(content).hexdigest()))
    print(ident, len(content), flush=True)
(output / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
