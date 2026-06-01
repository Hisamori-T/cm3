import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-primary)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-surface-2)] hover:border-[var(--c-border-strong)]",
        primary:
          "bg-[var(--c-primary)] border border-[var(--c-primary)] text-white hover:bg-[var(--c-primary-hover)] hover:border-[var(--c-primary-hover)]",
        accent:
          "bg-[var(--c-accent)] border border-[var(--c-accent)] text-white hover:bg-[var(--c-accent-hover)] hover:border-[var(--c-accent-hover)]",
        ghost:
          "bg-transparent border border-transparent text-[var(--c-text-muted)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]",
        destructive:
          "bg-[var(--c-danger)] border border-[var(--c-danger)] text-white hover:opacity-90",
      },
      size: {
        default: "h-8 px-3 py-1.5 text-[13px] rounded-[var(--r-md)]",
        sm: "h-7 px-2 py-1 text-[12px] rounded-[var(--r-md)]",
        lg: "h-9 px-4 py-2 text-[14px] rounded-[var(--r-md)]",
        icon: "h-7 w-7 rounded-[var(--r-md)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
