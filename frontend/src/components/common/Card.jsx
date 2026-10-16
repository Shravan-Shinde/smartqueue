import React from 'react';

/**
 * Reusable SmartQueue Card Component
 * Warm Architectural Palette (#463B32, #41372E, #514438)
 */
const Card = ({
  children,
  className = '',
  variant = 'surface', // surface, secondary, elevated, glass
  hoverEffect = false,
  padding = 'p-6',
  ...props
}) => {
  const variantStyles = {
    surface: 'bg-sq-surface border border-sq-border shadow-sm',
    secondary: 'bg-sq-surfaceSecondary border border-sq-border',
    elevated: 'bg-sq-surface border border-sq-border shadow-md',
    faint: 'bg-sq-surfaceSecondary border border-sq-border',
    glass: 'bg-sq-surface/80 backdrop-blur-md border border-sq-border',
  };

  const hoverClass = hoverEffect
    ? 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
    : '';

  return (
    <div
      className={`rounded-2xl ${variantStyles[variant]} ${padding} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
