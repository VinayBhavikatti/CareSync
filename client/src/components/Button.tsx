import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-xl font-semibold transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-caresync-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-caresync-600 text-white hover:bg-caresync-700 active:bg-caresync-800',
    secondary:
      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600',
    ghost: 'text-caresync-600 dark:text-caresync-400 hover:bg-caresync-50 dark:hover:bg-caresync-900/20',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  };

  const sizes = {
    sm: 'min-h-[48px] px-4 py-2 text-base',
    md: 'min-h-[56px] px-6 py-3 text-lg',
    lg: 'min-h-[64px] px-8 py-4 text-xl',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Please wait…
        </span>
      ) : (
        children
      )}
    </button>
  );
}

