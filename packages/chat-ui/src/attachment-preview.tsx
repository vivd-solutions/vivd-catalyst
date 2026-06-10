import { AttachmentPrimitive } from "@assistant-ui/react";
import { FileText, X } from "lucide-react";
import { cn } from "./ui/cn";

export function AttachmentPreview({ removable }: { removable: boolean }) {
  return (
    <AttachmentPrimitive.Root className="group/attachment relative max-w-72">
      <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 rounded-md border bg-card px-2 py-1.5 shadow-xs">
        <AttachmentPrimitive.unstable_Thumb className="grid size-9 place-items-center rounded bg-muted text-[0.625rem] font-medium uppercase text-muted-foreground">
          <FileText size={15} aria-hidden="true" />
        </AttachmentPrimitive.unstable_Thumb>
        <span className="truncate text-sm">
          <AttachmentPrimitive.Name />
        </span>
      </div>
      {removable ? (
        <AttachmentPrimitive.Remove
          className={cn(
            "absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-xs transition-opacity",
            "group-hover/attachment:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          )}
          aria-label="Remove attachment"
          title="Remove attachment"
        >
          <X size={12} aria-hidden="true" />
        </AttachmentPrimitive.Remove>
      ) : null}
    </AttachmentPrimitive.Root>
  );
}
