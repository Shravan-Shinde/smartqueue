export const designTokens = {
  colors: {
    bg: '#F9FCFB',
    surface: '#FFFFFF',
    secondarySurface: '#F2F8F6',
    elevated: '#FFFFFF',
    faint: '#E2EBE8',
    cream: '#FFFFFF',
    primary: '#23796E',
    textPrimary: '#263533',
    textSecondary: '#687875',
    textMuted: '#879590',
    border: '#E2EBE8',
    borderElevated: '#CFDEDA',
    semantic: {
      success: '#21865B',
      warning: '#B7791F',
      danger: '#C74646',
      info: '#287D91',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    heading1: 'text-3xl lg:text-4xl font-extrabold tracking-tight text-sq-textPrimary',
    heading2: 'text-2xl font-bold tracking-tight text-sq-textPrimary',
    heading3: 'text-lg font-semibold text-sq-textPrimary',
    body: 'text-sm font-normal text-sq-textPrimary',
    secondary: 'text-sm text-sq-textSecondary',
    muted: 'text-xs text-sq-muted',
    statNumber: 'text-3xl font-extrabold text-sq-textPrimary',
  },
  borderRadius: {
    sm: '0.125rem', // 2px
    md: '0.25rem',  // 4px
    lg: '0.375rem', // 6px
    xl: '0.5rem',   // 8px
    '2xl': '0.75rem',// 12px
    full: '9999px',
  },
  shadows: {
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  },
  transitions: {
    fast: 'all 0.15s ease-in-out',
    normal: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    slow: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

export default designTokens;
