const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/RegisterPage.jsx', 'utf8');

code = code.replace(
  '<p className="text-xs text-sq-primary">Create your SmartQueue customer account</p>',
  '<p className="text-sm text-sq-textSecondary">Create your SmartQueue customer account</p>'
);
code = code.replace(
  '<p className="text-center text-xs text-sq-primary">',
  '<p className="text-center text-xs text-sq-textSecondary">'
);

fs.writeFileSync('frontend/src/pages/RegisterPage.jsx', code);
