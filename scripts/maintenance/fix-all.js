const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminStaffPage.jsx', 'utf8');

code = code.replace(
  /api\.get\(\/admin\/organizations\/\/locations\)/g,
  'api.get(\/admin/organizations/\/locations\)'
);

code = code.replace(
  /api\.get\(\/admin\/organizations\/\/locations\/\/departments\)/g,
  'api.get(\/admin/organizations/\/locations/\/departments\)'
);

code = code.replace(
  /api\.get\(\/admin\/organizations\/\/locations\/\/departments\/\/counters\)/g,
  'api.get(\/admin/organizations/\/locations/\/departments/\/counters\)'
);

fs.writeFileSync('frontend/src/pages/AdminStaffPage.jsx', code);
