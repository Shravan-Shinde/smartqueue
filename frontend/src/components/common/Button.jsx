import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable SmartQueue Button Component
 * Warm Architectural Design Palette (#3E362E, #865D36, #AC8968, #F4EEE7)
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  onClick,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#171821] focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5 font-semibold',
  };

  const variantStyles = {
    primary: 'bg-sq-primary text-white font-bold hover:bg-sq-primaryDark active:scale-[0.98] focus:ring-sq-focusRing',
    secondary: 'bg-sq-surface text-sq-textPrimary hover:bg-sq-surfaceSecondary border border-sq-border active:scale-[0.98] focus:ring-sq-focusRing',
    brown: 'bg-sq-primary text-white font-bold hover:bg-sq-primaryDark active:scale-[0.98] focus:ring-sq-focusRing',
    ghost: 'bg-transparent text-sq-textSecondary hover:text-sq-textPrimary hover:bg-sq-surfaceSecondary active:scale-[0.98] focus:ring-sq-focusRing',
    danger: 'bg-sq-danger text-white border border-sq-danger hover:bg-red-700 active:scale-[0.98] focus:ring-sq-danger',
    success: 'bg-sq-success text-white border border-sq-success hover:bg-green-700 active:scale-[0.98] focus:ring-sq-success',
  };

  return (
    <button
      type={type}
      disabled={isDisabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default Button;
