const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/common/Sidebar.jsx', 'utf8');
code = code.replace(
  "{ label: 'Customer Reviews', path: '/admin/reviews', icon: Star },",
  "{ label: 'Customer Reviews', path: '/admin/reviews', icon: Star },\n    { label: 'Staff Management', path: '/admin/staff', icon: UserPlus },"
);
fs.writeFileSync('frontend/src/components/common/Sidebar.jsx', code);
