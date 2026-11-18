import json
import re
import os

os.makedirs('render-service/samples', exist_ok=True)
transcript_path = '/Users/apple/.gemini/antigravity/brain/3bd9650d-810d-4103-abaa-7577515a19f1/.system_generated/logs/transcript_full.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
        except Exception:
            continue
        c = data.get('content', '')
        if not c or not isinstance(c, str):
            continue

        if 'chinooo' in c and '<!DOCTYPE html>' in c and not os.path.exists('render-service/samples/chinooo-ad.html'):
            s = c.find('<!DOCTYPE html>')
            e = c.rfind('</html>') + 7
            if e > s:
                with open('render-service/samples/chinooo-ad.html', 'w', encoding='utf-8') as out:
                    out.write(c[s:e])
                print('Saved chinooo-ad.html')

        if ('snake' in c or 'SNAKE' in c) and '<!DOCTYPE html>' in c and 'hospital' in c and not os.path.exists('render-service/samples/snake-safety-ad.html'):
            s = c.find('<!DOCTYPE html>')
            e = c.rfind('</html>') + 7
            if e > s:
                with open('render-service/samples/snake-safety-ad.html', 'w', encoding='utf-8') as out:
                    out.write(c[s:e])
                print('Saved snake-safety-ad.html')

        if 'cola' in c and '<!DOCTYPE html>' in c and not os.path.exists('render-service/samples/cola-ad.html'):
            s = c.find('<!DOCTYPE html>')
            e = c.rfind('</html>') + 7
            if e > s:
                with open('render-service/samples/cola-ad.html', 'w', encoding='utf-8') as out:
                    out.write(c[s:e])
                print('Saved cola-ad.html')

        if 'london' in c.lower() and '<!DOCTYPE html>' in c and not os.path.exists('render-service/samples/london-trip-ad.html'):
            s = c.find('<!DOCTYPE html>')
            e = c.rfind('</html>') + 7
            if e > s:
                with open('render-service/samples/london-trip-ad.html', 'w', encoding='utf-8') as out:
                    out.write(c[s:e])
                print('Saved london-trip-ad.html')

# Also copy shoe-ad.html
if os.path.exists('shoe-ad.html'):
    with open('shoe-ad.html', 'r', encoding='utf-8') as src:
        with open('render-service/samples/shoe-ad.html', 'w', encoding='utf-8') as dst:
            dst.write(src.read())
    print('Copied shoe-ad.html')

print('Samples directory contents:', os.listdir('render-service/samples'))
