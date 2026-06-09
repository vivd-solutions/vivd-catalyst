import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const buttonVariants = cva("acp-ui-button", {
  variants: {
    variant: {
      primary: "acp-ui-button-primary",
      secondary: "acp-ui-button-secondary",
      ghost: "acp-ui-button-ghost",
      danger: "acp-ui-button-danger"
    },
    size: {
      sm: "acp-ui-button-sm",
      md: "acp-ui-button-md",
      icon: "acp-ui-button-icon"
    }
  },
  defaultVariants: {
    variant: "primary",
    size: "md"
  }
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
