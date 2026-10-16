const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminStaffPage.jsx', 'utf8');

code = code.replace(
  'const res = await api.get(/admin/organizations//locations);',
  'const res = await api.get(\/admin/organizations/\/locations\);'
);

code = code.replace(
  'const res = await api.get(/admin/organizations//locations//departments);',
  'const res = await api.get(\/admin/organizations/\/locations/\/departments\);'
);

code = code.replace(
  'const res = await api.get(/admin/organizations//locations//departments//counters);',
  'const res = await api.get(\/admin/organizations/\/locations/\/departments/\/counters\);'
);

fs.writeFileSync('frontend/src/pages/AdminStaffPage.jsx', code);
