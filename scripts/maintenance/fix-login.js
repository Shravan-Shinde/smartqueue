const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/LoginPage.jsx', 'utf8');

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
  /className="-sq-surface-sq-textPrimary text-sq-textPrimary rounded-lg text-\[11px\] font-bold transition-all border border-sq-border text-center"/g,
  'className="px-3 py-2 bg-sq-surface hover:bg-sq-primarySubtle hover:text-sq-primary text-sq-textPrimary rounded-lg text-xs font-bold transition-all border border-sq-border text-center flex items-center justify-center gap-1.5 w-full"'
);

code = code.replace(
  '<div className="grid grid-cols-3 gap-2">',
  '<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">'
);

code = code.replace(
  '<span className="text-[10px] font-bold text-sq-primary uppercase tracking-wider block text-center">',
  '<span className="text-xs font-bold text-sq-primary uppercase tracking-wider block text-center">'
);

code = code.replace(
  'bg-gradient-to-br from-sq-primary to-sq-primaryDark',
  'bg-sq-primarySubtle border border-sq-primaryBorder'
);

code = code.replace(
  'shadow-lg  flex items-center justify-center',
  'shadow-sm flex items-center justify-center'
);

fs.writeFileSync('frontend/src/pages/LoginPage.jsx', code);
