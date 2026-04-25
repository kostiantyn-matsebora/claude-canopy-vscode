// Reads .canopy-version (written by claude-canopy's install.sh / install.ps1) and
// writes canopyVersion into package.json. Run after every Canopy install/update:
//   npm run sync-canopy-version
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const versionFile = path.join(root, '.canopy-version');
const pkgFile = path.join(root, 'package.json');

if (!fs.existsSync(versionFile)) {
  console.error('ERROR: .canopy-version not found at repo root. Run install.sh / install.ps1 with --version to write it.');
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
