import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[#B0B3BD]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[#858995] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-sm rounded-[12px] border ${
              error ? 'border-[#FF6269] focus:border-[#FF6269]' : 'border-[#292B34] focus:border-[#FF7479]'
            } px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-1 ${
              error ? 'focus:ring-[#FF6269]' : 'focus:ring-[#FF7479]'
            } ${leftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-[#858995] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-[#FF6269] mt-0.5">{error}</span>}
        {helperText && !error && <span className="text-xs text-[#858995] mt-0.5">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-medium text-[#B0B3BD]">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-sm rounded-[12px] border ${
            error ? 'border-[#FF6269] focus:border-[#FF6269]' : 'border-[#292B34] focus:border-[#FF7479]'
          } px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-1 ${
            error ? 'focus:ring-[#FF6269]' : 'focus:ring-[#FF7479]'
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[#FF6269] mt-0.5">{error}</span>}
        {helperText && !error && <span className="text-xs text-[#858995] mt-0.5">{helperText}</span>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
