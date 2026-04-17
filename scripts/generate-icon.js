const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '../images/icon.svg'));
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } });
const png = resvg.render().asPng();
fs.writeFileSync(path.join(__dirname, '../images/icon.png'), png);
console.log('Generated images/icon.png');
