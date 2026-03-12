import type { MouseEvent } from "react";
import logoColor from "../assets/dev_clean_color.png";

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen = ({ onDismiss }: SplashScreenProps) => {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDismiss();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onDismiss();
          ("");
        }
      }}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-emerald-500/20 blur-3xl" />
            <img
              src={logoColor}
              alt="Dev Cleaner logo"
              className="relative h-64 w-64 object-contain"
            />
          </div>
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
              Welcome
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Dev Cleaner</h1>
            <p className="mt-2 text-sm text-slate-300">
              Keep your projects tidy, fast, and focused.
            </p>
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
          Click to continue
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
