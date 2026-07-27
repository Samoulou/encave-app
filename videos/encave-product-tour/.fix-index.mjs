// assemble-index injects GSAP from jsdelivr. Headless Chrome cannot complete a
// TLS handshake to external hosts through this sandbox's egress proxy, so the
// render/snapshot navigation hangs on it. Repoint that one tag at the vendored
// copy. Re-run after every assemble.
import fs from 'node:fs';
const p = 'index.html';
let s = fs.readFileSync(p, 'utf8');
const before = s;
s = s.replace(
  /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@[^"]+"[^>]*><\/script>/,
  '<script src="vendor/gsap.min.js"></script>'
);
fs.writeFileSync(p, s);
console.log(before === s ? 'no CDN gsap tag found' : 'gsap repointed to vendor/gsap.min.js');
