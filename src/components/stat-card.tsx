import { ClassName } from "@/types";
import { HyperCard } from "./card";

interface StatCardProps {
  label: string;
  value: number | string;
  className?: ClassName;
}
export const StatCard = ({ label, value, className }: StatCardProps) => (
  <HyperCard>
    <div className="text-right text-xs tracking-wide font-light text-gray-400 uppercase">
      {label}
    </div>
    <div className={`text-lg text-right ${className}`}>{value}</div>
  </HyperCard>
);
