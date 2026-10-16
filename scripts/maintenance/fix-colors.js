const fs = require('fs');
const path = require('path');

function replaceColors(content) {
  return content
    .replace(/bg-\[\#15161E\]/g, 'bg-sq-surface')
    .replace(/bg-\[\#3E362E\]/g, 'bg-sq-surfaceSecondary')
    .replace(/bg-\[\#865D36\]/g, 'bg-sq-warning')
    .replace(/bg-\[\#AC8968\]/g, 'bg-sq-warningBg')
    .replace(/bg-\[\#B27BDD\]/g, 'bg-sq-info')

    .replace(/text-\[\#15161E\]/g, 'text-sq-textPrimary')
    .replace(/text-\[\#3E362E\]/g, 'text-sq-textPrimary')
    .replace(/text-\[\#865D36\]/g, 'text-sq-warning')
    .replace(/text-\[\#AC8968\]/g, 'text-sq-textSecondary')
    .replace(/text-\[\#B27BDD\]/g, 'text-sq-info')
    
    .replace(/border-\[\#865D36\]/g, 'border-sq-warning')
    .replace(/border-\[\#AC8968\]/g, 'border-sq-warning')
    .replace(/border-\[\#B27BDD\]/g, 'border-sq-info')
    .replace(/shadow-\[\#865D36\]/g, 'shadow-sq-warning')

    .replace(/bg-slate-50/g, 'bg-sq-surfaceSecondary')
    .replace(/bg-slate-100/g, 'bg-sq-surfaceSecondary')
    .replace(/bg-slate-200/g, 'bg-sq-border')
    .replace(/bg-purple-600/g, 'bg-sq-primary')
    .replace(/bg-indigo-600/g, 'bg-sq-info')
    
    .replace(/hover:bg-slate-100/g, 'hover:bg-sq-surfaceSecondary')
    .replace(/hover:bg-slate-200/g, 'hover:bg-sq-border')
    .replace(/hover:bg-purple-700/g, 'hover:bg-sq-primaryDark')
    .replace(/hover:bg-indigo-700/g, 'hover:bg-sq-info')
    
    .replace(/text-purple-600/g, 'text-sq-primary')
    .replace(/text-indigo-600/g, 'text-sq-info')
    .replace(/border-purple-600/g, 'border-sq-primary')
    .replace(/focus:border-purple-600/g, 'focus:border-sq-primary')
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      content = replaceColors(content);
      
      content = content.replace(/className="([^"]*)bg-sq-surface([^"]*)text-white/g, 'className="\-sq-surface\-sq-textPrimary');
      content = content.replace(/className="([^"]*)bg-sq-surfaceSecondary([^"]*)text-white/g, 'className="\-sq-surfaceSecondary\-sq-textPrimary');
      content = content.replace(/className="([^"]*)bg-sq-bg([^"]*)text-white/g, 'className="\-sq-bg\-sq-textPrimary');
      
      content = content.replace(/border-white\/[0-9]+/g, 'border-sq-border');
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated ' + fullPath);
      }
    }
  }
}
walk('frontend/src');
