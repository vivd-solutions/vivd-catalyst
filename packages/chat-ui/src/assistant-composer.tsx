import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { Paperclip, Send, Square } from "lucide-react";
import { AttachmentPreview } from "./attachment-preview";
import { Button } from "./ui/button";
import { cn } from "./ui/cn";

export function AssistantComposer() {
  return (
    <ComposerPrimitive.Root className="relative w-full">
      <ComposerPrimitive.AttachmentDropzone disabled asChild>
        <div
          className={cn(
            "grid gap-2 rounded-lg border bg-background p-2 shadow-sm transition-colors",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
          )}
        >
          <ComposerPrimitive.Attachments>
            {() => <AttachmentPreview removable />}
          </ComposerPrimitive.Attachments>
          <ComposerPrimitive.Input
            className="max-h-40 min-h-12 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
            placeholder="Message"
            rows={1}
            submitMode="enter"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              disabled
              title="Attachments will be available when file acquisition is implemented"
              aria-label="Add attachment"
            >
              <Paperclip size={16} aria-hidden="true" />
            </Button>
            <ComposerAction />
          </div>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
}

function ComposerAction() {
  return (
    <div className="relative size-9">
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button type="button" size="icon" className="absolute inset-0 size-9" aria-label="Stop generating">
            <Square size={14} className="fill-current" aria-hidden="true" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <Button type="button" size="icon" className="absolute inset-0 size-9" aria-label="Send message">
            <Send size={17} aria-hidden="true" />
          </Button>
        </ComposerPrimitive.Send>
      </AuiIf>
    </div>
  );
}
