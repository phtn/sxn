import { type HTMLAttributes, ReactNode } from "react";
import { ClassName } from "@/types";

interface HyperCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const HyperCard = ({ children }: HyperCardProps) => {
  return (
    <div
      className={`bg-card/10 text-card-foreground flex flex-col space-y-2 rounded-xl border-x border-b border-gray-400/10 px-3 py-3 shadow-xs relative overflow-hidden group cursor-pointer p-0 dark:bg-origin/20 dark:border-xy dark:inset-shadow-[0_0.5px_rgb(255_255_255/0.20)]
      `}
    >
      {children}
    </div>
  );
};
