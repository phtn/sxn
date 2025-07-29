import { GameResult } from "@/types";
import { useMemo } from "react";

interface Props {
  results: GameResult[] | undefined;
  windows: number;
  accWin: number;
  winChance: number;
}

export const ResultWindow = ({
  results,
  windows,
  accWin,
  winChance,
}: Props) => {
  // Get the last N results (most recent first)
  const windowResults = useMemo(() => {
    if (!results || results.length === 0) return [];

    // Take the last 'windows' number of results and keep them in chronological order
    // (oldest to newest within the window)
    return results.slice(-windows);
  }, [results, windows]);

  // Calculate win rate for this window
  const winRate = useMemo(() => {
    if (windowResults.length === 0) return 0;

    const wins = windowResults.filter(
      (result) => result.result === "win",
    ).length;
    return (wins / windowResults.length) * 100;
  }, [windowResults]);

  return (
    <div className="flex items-center space-x-4 border-b border-gray-400/15 last:border-b-0 pb-1.5">
      <p className="font-sans font-semibold text-sm">{windows}</p>
      <div className="w-full">
        <div className="w-fit flex gap-1">
          {windowResults.map((result) => (
            <div
              key={result.timestamp}
              className={`size-5 aspect-square rounded-md border  ${
                result.result === "win"
                  ? "bg-win border-win"
                  : "bg-loss border-loss"
              }`}
              title={`${result.result} - ${new Date(result.timestamp).toLocaleTimeString()}`}
            />
          ))}
          {/* Fill remaining slots with empty boxes if we don't have enough results */}
          {Array.from({
            length: Math.max(0, windows - windowResults.length),
          }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="size-5 aspect-square rounded-md border border-gray-400/30 bg-gray-400/10"
            />
          ))}
        </div>
      </div>
      <div className="flex-1 font-medium font-sans">
        <div className="flex items-center space-x-1">
          <div
            className={`uppercase size-3 mx-1.5 rounded-full aspect-square ${Math.abs(winRate - winChance) - Math.abs(accWin - winChance) < 3.33 ? "bg-teal-500" : "bg-orange-300"}`}
          />
          <div className="w-8 text-right">
            {winRate.toFixed(1)}
            <span className="text-sm font-light"></span>
          </div>
        </div>
      </div>
    </div>
  );
};
