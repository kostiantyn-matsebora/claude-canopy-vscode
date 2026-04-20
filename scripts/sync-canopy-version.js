// Reads .claude/canopy/.canopy-version and writes canopyVersion into package.json.
// Run after every Canopy subtree update: npm run sync-canopy-version
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const versionFile = path.join(root, '.claude', 'canopy', '.canopy-version');
const pkgFile = path.join(root, 'package.json');

if (!fs.existsSync(versionFile)) {
  console.error('ERROR: .claude/canopy/.canopy-version not found.');
  process.exit(1);
}

const canopyVersion = fs.readFileSync(versionFile, 'utf8').trim();
if (!/^\d+\.\d+\.\d+/.test(canopyVersion)) {
  console.error(`ERROR: unexpected content in .canopy-version: "${canopyVersion}"`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.canopyVersion = canopyVersion;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
console.log(`canopyVersion set to ${canopyVersion} in package.json`);
