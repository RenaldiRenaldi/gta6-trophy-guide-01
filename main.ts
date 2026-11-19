// Vice Fieldnotes: deterministic offline hand-in, Node 22 standard library only.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const source = fileURLToPath(new URL('.', import.meta.url));
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
if (destination === resolve(source)) throw new Error('Output directory must differ from the source repository.');
mkdirSync(destination, { recursive: true });
for (const directory of ['app', 'screenshots']) {
  cpSync(join(source, directory), join(destination, directory), { recursive: true });
}
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(destination, 'dossier.json'), dossier);
