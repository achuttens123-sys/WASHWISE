const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

content = content.replace(
  'className="absolute top-3.5 sm:top-5 left-5 right-5 sm:left-11 sm:right-11 h-0.5 sm:h-1 -z-0"',
  'className="absolute top-3.5 sm:top-5 left-10 right-10 sm:left-14 sm:right-14 h-0.5 sm:h-1 -z-0"'
);

content = content.replace(
  'className="flex flex-col items-center flex-1 text-center group min-w-0"',
  'className="flex flex-col items-center w-20 sm:w-28 text-center group min-w-0 shrink-0"'
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
