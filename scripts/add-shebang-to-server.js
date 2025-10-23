const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../package/dist/server.js');
const content = fs.readFileSync(serverPath, 'utf-8');

// Prepend shebang if it doesn't exist
if (!content.startsWith('#!')) {
  fs.writeFileSync(serverPath, '#!/usr/bin/env node\n' + content);
}
