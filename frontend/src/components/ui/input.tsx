import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-[var(--r-md)] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-text-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)] focus:ring-offset-0 focus:border-[var(--c-primary)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
