const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace(
  "import AdminDashboard from './pages/AdminDashboard';",
  "import AdminDashboard from './pages/AdminDashboard';\nimport AdminStaffPage from './pages/AdminStaffPage';"
);

const routeBlock = \
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminStaffPage />
            </ProtectedRoute>
          }
        />\;

code = code.replace(
  '<Route\n          path="/admin/analytics"',
  routeBlock + '\n        <Route\n          path="/admin/analytics"'
);

fs.writeFileSync('frontend/src/App.jsx', code);
