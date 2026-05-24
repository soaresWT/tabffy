import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveQuery, updateQuery, listSavedQueries } from "@/api";
import type { QueryTab, SavedQuery } from "@/types";
import { useToast } from "@/contexts/ToastContext";

const QUERY_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

interface SaveQueryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: QueryTab;
  onUpdateTab: (id: string, patch: Partial<QueryTab>) => void;
  onSavedQueriesChange: (queries: SavedQuery[]) => void;
}

export function SaveQueryModal({
  open,
  onOpenChange,
  tab,
  onUpdateTab,
  onSavedQueriesChange,
}: SaveQueryModalProps) {
  const [name, setName] = useState(() => tab.name);
  const [color, setColor] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      if (tab.savedQueryId) {
        await updateQuery(tab.savedQueryId, {
          name: name.trim(),
          sql: tab.sql,
          connectionId: tab.connectionId,
          color,
        });
        toast("Query updated", "success");
      } else {
        const saved = await saveQuery(name.trim(), tab.sql, tab.connectionId, color);
        onUpdateTab(tab.id, { name: name.trim(), savedQueryId: saved.id });
        toast("Query saved", "success");
      }

      const updated = await listSavedQueries();
      onSavedQueriesChange(updated);
      onOpenChange(false);
    } catch {
      toast("Failed to save query", "error");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-zinc-950 border border-zinc-800/80 rounded-xl shadow-2xl shadow-black/40 z-50 focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
            <Dialog.Title className="text-[14px] font-semibold text-zinc-200">
              {tab.savedQueryId ? "Save Changes" : "Save Query"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-3.5">
            <div>
              <label className="block text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Query name"
                autoFocus
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) handleSave();
                }}
                className="w-full h-7 bg-zinc-900/80 border border-zinc-800 rounded-md px-2.5 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-teal-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-1.5">
                Color Label
              </label>
              <div className="flex items-center gap-2">
                {QUERY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(color === c ? null : c)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all",
                      color === c
                        ? "ring-2 ring-offset-2 ring-offset-zinc-950 scale-110"
                        : "hover:scale-110 opacity-60 hover:opacity-100"
                    )}
                    style={{
                      backgroundColor: c,
                      ...(color === c ? { boxShadow: `0 0 0 2px var(--tw-ring-offset-color, #09090b), 0 0 0 4px ${c}` } : {}),
                    }}
                  />
                ))}
                <button
                  onClick={() => setColor(null)}
                  className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-full border border-dashed transition-all",
                    color === null
                      ? "border-zinc-500 opacity-100"
                      : "border-zinc-700 opacity-40 hover:opacity-70"
                  )}
                >
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-800/60">
            <Dialog.Close asChild>
              <button className="h-7 px-3 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="h-7 px-4 rounded-md text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {tab.savedQueryId ? "Update" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
