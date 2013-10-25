var fs    = require('fs')
  , files = fs.readdirSync('sandbox/d3/actors')
  ;

var col, file, i, s1, s2;

col = 0;
s1 = '<table>';
s2 = '<table>';
files.sort();
for (i = 0; i < files.length; i++) {
  file = files[i];

  if (!fs.existsSync('sandbox/d3/popovers/assets/actors/' + file))
    throw new Error('missing sandbox/d3/popovers/assets/actors/' + file);

  if (col === 0) {
    s1 += '<tr>';
    s2 += '<tr>';
  }
  s1 += '<td><img src="d3/actors/' + file + '" title="d3/actors/' + file + '"/></td>';
  s2 += '<td><img src="d3/popovers/assets/actors/' + file + '"title="d3/popovers/assets/actors/' + file + '" /></td>';
  if (col === 9) {
    s1 += '</tr>';
    s2 += '</tr>';
    col = 0;
  } else col++;
}
if (col !== 0) {
  s1 += '</tr>';
  s2 += '</tr>';
}
s1 += '</table>';
s2 += '</table>';

fs.writeFileSync('svg.html', s1 + s2);
