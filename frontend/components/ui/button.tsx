import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "border-brand-500 bg-brand-500 text-white hover:border-brand-600 hover:bg-brand-600",
        secondary: "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100",
        neutral: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900",
        ghost: "border-transparent bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        destructive: "border-error-500 bg-error-500 text-white hover:border-error-700 hover:bg-error-700"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
