import React from 'react';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'danger'
  disabled = false,
  disabledReason = '',
  className = '',
  id,
  title,
  ...props
}) {
  const baseClasses = 'min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded border transition-colors inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1E2D5A] focus:ring-offset-1 select-none';

  let variantClasses = '';
  if (variant === 'primary') {
    variantClasses = disabled
      ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
      : 'bg-[#1E2D5A] text-white border-[#1E2D5A] hover:bg-[#162244] active:bg-[#101833] cursor-pointer';
  } else if (variant === 'secondary') {
    variantClasses = disabled
      ? 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
      : 'bg-white text-[#1E2D5A] border-[#D4D0C8] hover:bg-slate-50 active:bg-slate-100 cursor-pointer';
  } else if (variant === 'danger') {
    variantClasses = disabled
      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
      : 'bg-white text-red-700 border-red-300 hover:bg-red-50 active:bg-red-100 cursor-pointer';
  }

  const tooltip = disabled && disabledReason ? disabledReason : (title || undefined);

  return (
    <button
      id={id}
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip}
      aria-disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
