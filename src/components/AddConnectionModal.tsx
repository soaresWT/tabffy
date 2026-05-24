import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Link,
  Unlink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { testConnection, saveConnection, updateConnection, pickSqliteFile } from "@/api";
import type { ConnectionType, Connection } from "@/types";
import { useToast } from "@/contexts/ToastContext";

type InputMode = "url" | "fields";

interface AddConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (conn: Connection) => void;
  editingConnection?: Connection | null;
}

interface PgFieldValues {
  name: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

interface SqliteFieldValues {
  name: string;
  path: string;
}

function parsePgUrl(url: string): Partial<PgFieldValues> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1),
    };
  } catch {
    return {};
  }
}

function buildPgUrl(fields: PgFieldValues): string {
  const { host, port, user, password, database } = fields;
  if (!host) return "";
  const auth = user
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
    : "";
  const db = database ? `/${database}` : "";
  return `postgresql://${auth}${host}:${port || "5432"}${db}`;
}

type TestStatus = "idle" | "testing" | "success" | "error";

export function AddConnectionModal({
  open,
  onOpenChange,
  onSaved,
  editingConnection,
}: AddConnectionModalProps) {
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const isEditing = !!editingConnection;
  const editType = editingConnection?.connection_type;
  const editUrl = editingConnection?.url ?? "";
  const editName = editingConnection?.name ?? "";

  const parsedPg = editType === "postgres" ? parsePgUrl(editUrl) : {};
  const [connType, setConnType] = useState<ConnectionType>(editType ?? "postgres");
  const [mode, setMode] = useState<InputMode>("fields");
  const [url, setUrl] = useState(isEditing ? editUrl : "");
  const [pgFields, setPgFields] = useState<PgFieldValues>({
    name: isEditing && editType === "postgres" ? editName : "",
    host: parsedPg.host ?? "",
    port: parsedPg.port ?? "5432",
    user: parsedPg.user ?? "",
    password: parsedPg.password ?? "",
    database: parsedPg.database ?? "",
  });
  const [sqliteFields, setSqliteFields] = useState<SqliteFieldValues>({
    name: isEditing && editType === "sqlite" ? editName : "",
    path: isEditing && editType === "sqlite" && editUrl.startsWith("sqlite:") ? editUrl.slice(7) : "",
  });

  const currentUrl =
    connType === "postgres"
      ? mode === "url"
        ? url
        : buildPgUrl(pgFields)
      : sqliteFields.path
        ? `sqlite:${sqliteFields.path}`
        : "";

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (connType === "postgres") {
      const parsed = parsePgUrl(newUrl);
      setPgFields((f) => ({
        ...f,
        ...parsed,
        name: f.name || parsed.host || "",
      }));
    }
  };

  const handlePgFieldChange = (key: keyof PgFieldValues, value: string) => {
    setPgFields((f) => {
      const next = { ...f, [key]: value };
      const generated = buildPgUrl(next);
      if (generated) setUrl(generated);
      return next;
    });
  };

  const handleModeToggle = () => {
    if (connType !== "postgres") return;
    if (mode === "fields") {
      const generated = buildPgUrl(pgFields);
      if (generated) setUrl(generated);
      setMode("url");
    } else {
      const parsed = parsePgUrl(url);
      setPgFields((f) => ({ ...f, ...parsed }));
      setMode("fields");
    }
  };

  const handleBrowseFile = async () => {
    const path = await pickSqliteFile();
    if (path) {
      const name = path.split("/").pop()?.replace(/\.\w+$/, "") || "";
      setSqliteFields({ path, name: sqliteFields.name || name });
    }
  };

  const handleTest = async () => {
    if (!currentUrl) return;
    setTestStatus("testing");
    setTestError("");
    try {
      await testConnection(connType, currentUrl);
      setTestStatus("success");
      setTimeout(() => setTestStatus("idle"), 2000);
    } catch (e) {
      setTestStatus("error");
      setTestError(String(e));
    }
  };

  const canSave =
    (connType === "postgres"
      ? pgFields.name.trim() &&
        (mode === "url" ? url.trim() : pgFields.host.trim())
      : sqliteFields.name.trim() && sqliteFields.path.trim()) &&
    currentUrl.trim();

  const handleSave = async () => {
    if (!canSave) return;
    try {
      const name = connType === "postgres" ? pgFields.name : sqliteFields.name;
      if (editingConnection) {
        const conn = await updateConnection(editingConnection.id, name, currentUrl, connType);
        onSaved?.(conn);
        toast("Connection updated", "success");
      } else {
        const conn = await saveConnection(name, currentUrl, connType);
        onSaved?.(conn);
        toast("Connection saved", "success");
      }
      resetAndClose();
    } catch {
      toast(editingConnection ? "Failed to update connection" : "Failed to save connection", "error");
    }
  };

  const resetAndClose = () => {
    setConnType("postgres");
    setMode("fields");
    setUrl("");
    setPgFields({
      name: "",
      host: "",
      port: "5432",
      user: "",
      password: "",
      database: "",
    });
    setSqliteFields({ name: "", path: "" });
    setTestStatus("idle");
    setTestError("");
    setShowPassword(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={resetAndClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] bg-zinc-950 border border-zinc-800/80 rounded-xl shadow-2xl shadow-black/40 z-50 focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
            <Dialog.Title className="text-[14px] font-semibold text-zinc-200">
              {editingConnection ? "Edit Connection" : "New Connection"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-3.5">
            <div className="flex gap-1 p-0.5 bg-zinc-900/60 border border-zinc-800/60 rounded-md">
              {(["postgres", "sqlite"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setConnType(t);
                    setTestStatus("idle");
                    setTestError("");
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-[11px] font-medium rounded transition-colors",
                    connType === t
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {t === "postgres" ? "PostgreSQL" : "SQLite"}
                </button>
              ))}
            </div>

            {connType === "postgres" ? (
              <PgForm
                mode={mode}
                pgFields={pgFields}
                url={url}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword((v) => !v)}
                onModeToggle={handleModeToggle}
                onUrlChange={handleUrlChange}
                onFieldChange={handlePgFieldChange}
              />
            ) : (
              <SqliteForm
                sqliteFields={sqliteFields}
                onFieldChange={(key, value) =>
                  setSqliteFields((f) => ({ ...f, [key]: value }))
                }
                onBrowse={handleBrowseFile}
              />
            )}

            {testStatus === "error" && testError && (
              <div className="px-2.5 py-1.5 rounded-md bg-red-500/10 border border-red-500/20">
                <p className="text-[11px] text-red-400 break-all">{testError}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800/60">
            <button
              onClick={handleTest}
              disabled={testStatus === "testing" || !currentUrl}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-medium transition-colors border",
                testStatus === "success"
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : testStatus === "error"
                    ? "text-red-400 bg-red-500/10 border-red-500/20"
                    : "text-zinc-400 bg-zinc-900 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {testStatus === "testing" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {testStatus === "success" && (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {testStatus === "error" && <AlertCircle className="w-3 h-3" />}
              {testStatus === "testing"
                ? "Testing..."
                : testStatus === "success"
                  ? "Connected"
                  : "Test Connection"}
            </button>

            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <button className="h-7 px-3 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="h-7 px-4 rounded-md text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingConnection ? "Update Connection" : "Save Connection"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PgForm({
  mode,
  pgFields,
  url,
  showPassword,
  onTogglePassword,
  onModeToggle,
  onUrlChange,
  onFieldChange,
}: {
  mode: InputMode;
  pgFields: PgFieldValues;
  url: string;
  showPassword: boolean;
  onTogglePassword: () => void;
  onModeToggle: () => void;
  onUrlChange: (url: string) => void;
  onFieldChange: (key: keyof PgFieldValues, value: string) => void;
}) {
  return (
    <>
      <FieldInput
        label="Name"
        placeholder="e.g. Production"
        value={pgFields.name}
        onChange={(v) => onFieldChange("name", v)}
      />

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
          Connection
        </span>
        <button
          onClick={onModeToggle}
          className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-teal-400 transition-colors"
        >
          {mode === "url" ? (
            <>
              <Unlink className="w-3 h-3" />
              Fill fields
            </>
          ) : (
            <>
              <Link className="w-3 h-3" />
              Enter URL
            </>
          )}
        </button>
      </div>

      {mode === "url" ? (
        <div className="relative">
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="postgresql://user:password@host:5432/database"
            className="w-full h-8 bg-zinc-900/80 border border-zinc-800 rounded-md px-3 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-teal-500/50 transition-colors font-mono"
            spellCheck={false}
            autoFocus
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex gap-2.5">
            <div className="flex-[3]">
              <FieldInput
                label="Host"
                placeholder="localhost"
                value={pgFields.host}
                onChange={(v) => onFieldChange("host", v)}
                autoFocus
              />
            </div>
            <div className="flex-[1]">
              <FieldInput
                label="Port"
                placeholder="5432"
                value={pgFields.port}
                onChange={(v) => onFieldChange("port", v)}
              />
            </div>
          </div>
          <FieldInput
            label="User"
            placeholder="postgres"
            value={pgFields.user}
            onChange={(v) => onFieldChange("user", v)}
          />
          <div className="relative">
            <FieldInput
              label="Password"
              placeholder="••••••••"
              value={pgFields.password}
              onChange={(v) => onFieldChange("password", v)}
              type={showPassword ? "text" : "password"}
            />
            <button
              type="button"
              onClick={onTogglePassword}
              className="absolute right-2 top-[22px] text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-1"
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
          <FieldInput
            label="Database"
            placeholder="mydb"
            value={pgFields.database}
            onChange={(v) => onFieldChange("database", v)}
          />
        </div>
      )}
    </>
  );
}

function SqliteForm({
  sqliteFields,
  onFieldChange,
  onBrowse,
}: {
  sqliteFields: SqliteFieldValues;
  onFieldChange: (key: keyof SqliteFieldValues, value: string) => void;
  onBrowse: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <FieldInput
        label="Name"
        placeholder="e.g. Local DB"
        value={sqliteFields.name}
        onChange={(v) => onFieldChange("name", v)}
        autoFocus
      />
      <div>
        <label className="block text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-1">
          Database file
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={sqliteFields.path}
            onChange={(e) => onFieldChange("path", e.target.value)}
            placeholder="/path/to/database.db"
            className="flex-1 h-7 bg-zinc-900/80 border border-zinc-800 rounded-md px-2.5 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-teal-500/50 transition-colors font-mono"
            spellCheck={false}
          />
          <button
            onClick={onBrowse}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700 transition-colors shrink-0"
          >
            <FolderOpen className="w-3 h-3" />
            Browse
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        className="w-full h-7 bg-zinc-900/80 border border-zinc-800 rounded-md px-2.5 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-teal-500/50 transition-colors"
      />
    </div>
  );
}
