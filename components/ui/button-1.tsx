'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline';
  mode?: 'default' | 'icon';
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      mode = 'default',
      asChild = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold text-xs transition-all duration-150 rounded-xl select-none focus:outline-none';
    
    const variantStyles = {
      default:
        'bg-[#2563EB] hover:bg-blue-700 text-white shadow-2xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed',
      ghost:
        'bg-transparent hover:bg-gray-100/90 text-[#5E6470] hover:text-[#16191E] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#5E6470] disabled:cursor-not-allowed',
      outline:
        'border border-[#2563EB] bg-blue-50/70 text-[#2563EB] font-bold shadow-2xs hover:bg-blue-100/70 disabled:opacity-40 disabled:cursor-not-allowed',
    };

    const modeStyles = {
      default: 'h-9 px-3.5 gap-1.5 cursor-pointer',
      icon: 'h-9 w-9 p-0 cursor-pointer',
    };

    const combinedClassName = cn(
      baseStyles,
      variantStyles[variant],
      modeStyles[mode],
      disabled && 'cursor-not-allowed pointer-events-none',
      className
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(combinedClassName, child.props.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={combinedClassName}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
