import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const overridesPath = path.join(__dirname, 'latest-source-overrides.json');

if (fs.existsSync(overridesPath)) {
  const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  let restoredCount = 0;
  for (const [relPath, content] of Object.entries(overrides)) {
    const fullPath = path.join(repoRoot, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const current = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null;
    if (current !== content) {
      fs.writeFileSync(fullPath, content, 'utf8');
      restoredCount += 1;
    }
  }
  for (const localeRel of ['src/i18n/locales/en.ts', 'src/i18n/locales/in.ts', 'src/i18n/locales/zh-CN.ts']) {
    const locPath = path.join(repoRoot, localeRel);
    if (fs.existsSync(locPath)) {
      const txt = fs.readFileSync(locPath, 'utf8');
      if (!txt.includes('"lrclib":')) {
        const updated = txt.includes('"amll": "AMLLDB",')
          ? txt.replace('"amll": "AMLLDB",', '"amll": "AMLLDB",\n    "lrclib": "LRCLIB",')
          : txt.replace('"amll": "AMLLDB"', '"amll": "AMLLDB",\n    "lrclib": "LRCLIB"');
        if (updated !== txt) {
          fs.writeFileSync(locPath, updated, 'utf8');
          restoredCount += 1;
        }
      }
    }
  }
  if (restoredCount > 0) {
    console.log(`[restore-latest-overrides] Restored ${restoredCount} updated source files from latest ZIP.`);
  }
}
