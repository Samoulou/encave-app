/**
 * Workaround for @types/mapbox__point-geometry stub package
 * which ships without an index.d.ts, causing "Cannot find type definition" errors.
 * @mapbox/point-geometry provides its own types — this just satisfies TypeScript's
 * implicit type library resolution.
 */
const fs = require('fs');
const path = require('path');

const targetDir = path.join(
  __dirname,
  '..',
  'node_modules',
  '@types',
  'mapbox__point-geometry'
);
const targetFile = path.join(targetDir, 'index.d.ts');

if (fs.existsSync(targetDir) && !fs.existsSync(targetFile)) {
  fs.writeFileSync(targetFile, 'export {};\n');
}
