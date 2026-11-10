#!/usr/bin/env node
/**
 * Copies the pure game rules (src/game/core.ts) into the Supabase Edge
 * Functions so the server validates scores with exactly the same code the
 * app uses. A unit test fails if the copies drift — run `npm run sync:shared`.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'supabase/functions/_shared/core.ts');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(join(root, 'src/game/core.ts'), target);
console.log('Synced src/game/core.ts → supabase/functions/_shared/core.ts');
