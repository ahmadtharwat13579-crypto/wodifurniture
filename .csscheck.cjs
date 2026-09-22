const fs = require('fs');

for (const f of ['css/components/modals.css', 'css/configurator.css']) {
  let s = fs.readFileSync(f, 'utf8');
  // strip comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // strip url(...) payloads (may contain braces/quotes)
  s = s.replace(/url\(\s*(['"])[\s\S]*?\1\s*\)/gs, '');
  s = s.replace(/url\([^)]*\)/gs, '');

  let depth = 0, line = 1, err = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\n') line++;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth < 0) { err = 'unbalanced } at line ' + line; break; }
    }
  }
  if (!err && depth !== 0) err = 'unclosed brace, depth ' + depth;
  const blocks = (s.match(/{/g) || []).length;
  console.log(f, '->', err ? 'FAIL: ' + err : 'OK (' + blocks + ' blocks)');
}

anonyig.com

pvstory.com

save-free.com

dolphinradar.com

inflact.com

instastoriesviewer.com

gramsnap.com

igexort.com

geelart.com

pathsocial.com