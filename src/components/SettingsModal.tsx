import * as Dialog from "@radix-ui/react-dialog";
import { X, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { settings, setTheme, setFontSize } = useSettings();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-zinc-950 border border-zinc-800/80 rounded-xl shadow-2xl shadow-black/40 z-50 focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
            <Dialog.Title className="text-[14px] font-semibold text-zinc-200">
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                Theme
              </label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/60 border border-zinc-800/60 rounded-md">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded transition-colors",
                      settings.theme === t
                        ? "bg-zinc-800 text-zinc-200"
                        : "text-zinc-600 hover:text-zinc-400"
                    )}
                  >
                    {t === "light" ? (
                      <Sun className="w-3 h-3" />
                    ) : (
                      <Moon className="w-3 h-3" />
                    )}
                    {t === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                  Editor Font Size
                </label>
                <span className="text-[12px] text-zinc-400 tabular-nums">
                  {settings.fontSize}px
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={24}
                step={1}
                value={settings.fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-teal-400"
              />
              <div className="flex justify-between text-[10px] text-zinc-700">
                <span>10px</span>
                <span>24px</span>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
