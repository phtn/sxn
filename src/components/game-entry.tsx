import { type GameResult } from "@/types";
import { useMemo } from "react";

const EDGE = 0.989898;
export const GameEntry = ({ game }: { game: GameResult }) => {
  const timeStr = new Date(game.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const targetMultiplier = useMemo(
    () => game.winningChance && ((EDGE / game.winningChance) * 100).toFixed(2),
    [game.winningChance],
  );

  return (
    <div
      className={`flex justify-between items-center p-3 rounded-lg ${game.result === "win" ? "bg-green-50/10" : "bg-red-50/5"}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-14">
          <span
            className={`text-sm font-bold font-sans uppercase px-2 py-1.5 rounded-md ${game.result === "win" ? "bg-teal-600 text-white" : "bg-red-500/60 text-white"}`}
          >
            {game.result}
          </span>
        </div>
        <div className="w-14 text-right">
          <div className="font-light text-gray-400 text-[8px] tracking-widest uppercase">
            profit
          </div>
          <div className="text-sm text-slate-200 space-x-4 flex justify-end">
            <span>
              {game.gameData?.active
                ? `${Number(game.amount).toFixed(2)}`
                : "N/A"}
            </span>
          </div>
        </div>
        <div className="w-16 text-right">
          <div className="font-light text-gray-400 text-[8px] tracking-widest uppercase">
            target
          </div>
          <div className="text-sm text-slate-200 space-x-4 flex justify-end">
            <span className="text-teal-500">{targetMultiplier}</span>
          </div>
        </div>
        <div className="w-16 text-right">
          <div className="font-light text-gray-400 text-[8px] tracking-widest uppercase">
            result
          </div>
          <div className="text-sm text-slate-200 space-x-4 flex justify-end">
            <span
              className={`${!!targetMultiplier && game.multiplier && +targetMultiplier >= game.multiplier ? "text-red-300" : "text-teal-500"}`}
            >
              {game.multiplier && `${game.multiplier}`}
            </span>
          </div>
        </div>
        <div className="w-16 text-right">
          <div className="font-light text-gray-400 text-[8px] tracking-widest uppercase">
            chance
          </div>
          <div className="text-sm text-slate-200 space-x-4 flex justify-end">
            <span className="text-sky-200">
              {game.winningChance && `${game.winningChance}%`}
            </span>
          </div>
        </div>
        <div className="w-16 text-right">
          <div className="font-light text-gray-400 text-[8px] tracking-widest uppercase">
            game
          </div>
          <div className="text-sm text-slate-200 space-x-4 flex justify-end capitalize">
            <span>{game.gameType}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-light font-mono text-xs text-gray-300">
          {timeStr}
        </div>
        <div className="text-xs text-slate-400">
          {game.gameData?.roundId && `#${game.gameData.roundId}`}
        </div>
      </div>
    </div>
  );
};
