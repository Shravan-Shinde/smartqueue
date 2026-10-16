const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/RegisterPage.jsx', 'utf8');

code = code.replace(
  '<div className="-sq-bg-sq-textPrimary">', 
  '<div className="min-h-screen w-full bg-sq-bg text-sq-textPrimary flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-sq-primarySubtle selection:text-sq-primary">'
);

code = code.replace(
  '<div className="w-full max-w-md space-y-6">',
  '<div className="w-full max-w-[440px] space-y-6">'
);

code = code.replace(
  '<Card variant="surface" className="space-y-6 bg-sq-surface border border-sq-border shadow-2xl">',
  '<Card variant="surface" className="p-7 sm:p-8 space-y-6 bg-sq-surface border border-sq-border shadow-sm rounded-2xl">'
);

code = code.replace(
  /bg-gradient-to-br from-\[#[A-F0-9]+\] to-\[#[A-F0-9]+\]/g,
  'bg-sq-primarySubtle border border-sq-primaryBorder'
);

code = code.replace(
  /shadow-lg\s+shadow-sq-warning\/20/g,
  'shadow-sm flex items-center justify-center'
);

code = code.replace(
  /text-sq-textSecondary/g,
  'text-sq-primary'
);

fs.writeFileSync('frontend/src/pages/RegisterPage.jsx', code);
