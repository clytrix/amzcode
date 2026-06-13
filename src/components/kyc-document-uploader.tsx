import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Upload, FileImage, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { updateKycDocument } from "@/server/kyc.functions";

type DocField = "document_front_url" | "document_back_url" | "selfie_url";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const ACCEPT_ATTR = ACCEPTED_MIME.join(",");

const FIELDS: { key: DocField; label: string; hint: string }[] = [
  {
    key: "document_front_url",
    label: "ID document — front",
    hint: "Aadhaar / PAN / Passport front side. JPG, PNG, or WEBP. Max 5 MB.",
  },
  {
    key: "document_back_url",
    label: "ID document — back",
    hint: "Back side of the same document (skip if not applicable). JPG, PNG, or WEBP. Max 5 MB.",
  },
  {
    key: "selfie_url",
    label: "Selfie holding ID",
    hint: "Clear photo of you holding the ID. Used for liveness verification. JPG, PNG, or WEBP. Max 5 MB.",
  },
];

interface Props {
  kyc: any;
  onChange: (patch: Partial<Record<DocField, string | null>>) => void;
  disabled?: boolean;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `File is ${formatBytes(file.size)}. Maximum allowed is 5 MB.`;
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  // Browsers sometimes leave file.type empty; fall back to extension check.
  const lowerName = file.name.toLowerCase();
  const extOk = ACCEPTED_EXT.some((ext) => lowerName.endsWith(ext));
  const mimeOk = ACCEPTED_MIME.includes(file.type);
  if (!mimeOk && !extOk) {
    return "Only JPG, PNG, or WEBP image files are accepted.";
  }
  return null;
}

export function KycDocumentUploader({ kyc, onChange, disabled }: Props) {
  const { user } = useAuth();
  const updateDoc = useServerFn(updateKycDocument);
  const [busy, setBusy] = useState<DocField | null>(null);
  const [progress, setProgress] = useState<Record<DocField, number>>({
    document_front_url: 0,
    document_back_url: 0,
    selfie_url: 0,
  });

  const upload = async (field: DocField, file: File) => {
    if (!user) return;

    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setBusy(field);
    setProgress((p) => ({ ...p, [field]: 5 }));

    // Smooth indeterminate progress while the upload is in-flight.
    // (Supabase JS doesn't expose XHR progress, so we animate to ~85%
    // and snap to 100% on success.)
    const tick = window.setInterval(() => {
      setProgress((p) => {
        const cur = p[field] ?? 0;
        if (cur >= 85) return p;
        return { ...p, [field]: Math.min(85, cur + Math.random() * 12 + 3) };
      });
    }, 220);

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${field}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("kyc-documents")
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      // Use server function to bypass RLS
      await updateDoc({ data: { field, path } });

      setProgress((p) => ({ ...p, [field]: 100 }));
      onChange({ [field]: path } as Partial<Record<DocField, string | null>>);
      toast.success("Uploaded.");
      window.setTimeout(() => setProgress((p) => ({ ...p, [field]: 0 })), 800);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
      setProgress((p) => ({ ...p, [field]: 0 }));
    } finally {
      window.clearInterval(tick);
      setBusy(null);
    }
  };

  const remove = async (field: DocField) => {
    if (!user || !kyc?.[field]) return;
    setBusy(field);
    try {
      await supabase.storage.from("kyc-documents").remove([kyc[field]]);
      // Use server function to bypass RLS
      await updateDoc({ data: { field, path: null } });
      onChange({ [field]: null });
      toast.success("Removed.");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove file");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {FIELDS.map((f) => {
        const path = kyc?.[f.key] as string | null | undefined;
        const isBusy = busy === f.key;
        const pct = progress[f.key] || 0;
        return (
          <div key={f.key} className="rounded-md border bg-secondary/30 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold">
                  {path ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <FileImage className="h-4 w-4 text-muted-foreground" />
                  )}
                  {f.label}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{f.hint}</div>
                {path && (
                  <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    {path.split("/").pop()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {path && !disabled && !isBusy && (
                  <button
                    type="button"
                    onClick={() => remove(f.key)}
                    className="flex items-center gap-1 rounded border border-input bg-white px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
                {!disabled && (
                  <label
                    className={`flex cursor-pointer items-center gap-1 rounded px-3 py-1.5 text-xs font-bold ${
                      path
                        ? "border border-input bg-white hover:bg-secondary"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    } ${isBusy ? "cursor-wait opacity-50" : ""}`}
                  >
                    <Upload className="h-3 w-3" />
                    {isBusy ? "Uploading…" : path ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept={ACCEPT_ATTR}
                      className="hidden"
                      disabled={isBusy}
                      onChange={(e) => {
                        const f2 = e.target.files?.[0];
                        if (f2) void upload(f.key, f2);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            {(isBusy || pct > 0) && (
              <div className="mt-2">
                <Progress value={pct} className="h-1.5" />
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {pct >= 100 ? "Upload complete" : `Uploading… ${Math.round(pct)}%`}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function isKycDocsComplete(kyc: any): boolean {
  return !!(kyc?.document_front_url && kyc?.selfie_url);
}
