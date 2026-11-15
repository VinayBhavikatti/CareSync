import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        {label}
      </label>
      {hint && <p className="text-lg text-muted">{hint}</p>}
      <input
        id={inputId}
        className={`input-field ${error ? 'border-red-500 dark:border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-base text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

