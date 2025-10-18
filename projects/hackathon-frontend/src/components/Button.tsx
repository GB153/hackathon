import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children?: React.ReactNode;
}

export default function Button({ label, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`
        relative inline-flex select-none items-center justify-center
        rounded-2xl px-8 py-3 gap-3
        font-display font-normal text-white
        bg-[#FA812F]
        border-[1px] border-[#FA812F]/50
        shadow-[0_6px_0_0_rgba(250,129,47,0.4)]
        transition-all duration-200 ease-out
        hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(250,129,47,0.4)]
        active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(250,129,47,0.4)]
        focus:outline-none
        touch-manipulation
        ${className}
      `}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {children}
      {label}
    </button>
  );
}
