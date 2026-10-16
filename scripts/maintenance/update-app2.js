const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace(
  "import AdminDashboard from './pages/AdminDashboard';",
  "import AdminDashboard from './pages/AdminDashboard';\nimport AdminStaffPage from './pages/AdminStaffPage';"
);

const routeBlock = "        <Route\n          path=\"/admin/staff\"\n          element={\n            <ProtectedRoute allowedRoles={['ADMIN']}>\n              <AdminStaffPage />\n            </ProtectedRoute>\n          }\n        />";

code = code.replace(
  '<Route\n          path="/admin/analytics"',
  routeBlock + '\n        <Route\n          path="/admin/analytics"'
);

fs.writeFileSync('frontend/src/App.jsx', code);
