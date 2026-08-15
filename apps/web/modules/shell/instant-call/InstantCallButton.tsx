"use client";

import { useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@calcom/ui/components/dialog";
import { Icon } from "@calcom/ui/components/icon";
import { showToast } from "@calcom/ui/components/toast";
import { Tooltip } from "@calcom/ui/components/tooltip";

import { generateInstantCallUrl } from "./generateInstantCallUrl";
import { useRecentInstantCalls } from "./useRecentInstantCalls";

async function copyToClipboard(url: string, onSuccess: () => void, onError: () => void) {
  try {
    await navigator.clipboard.writeText(url);
    onSuccess();
  } catch {
    onError();
  }
}

/**
 * "Start instant call" action for the authenticated app shell. Generates a fresh
 * https://meet.jit.si/voxpilot-<random-slug> room, shows it with a copy button, and
 * opens it in a new tab. No database changes - Jitsi rooms are created on first join,
 * and the (optional) recent-link list lives entirely in localStorage.
 */
export function InstantCallButton({ iconOnly = true }: { iconOnly?: boolean }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const { recent, addRecent } = useRecentInstantCalls();

  const startCall = () => {
    const url = generateInstantCallUrl();
    setCallUrl(url);
    addRecent(url);
    setOpen(true);
  };

  const handleCopy = (url: string) => {
    copyToClipboard(
      url,
      () => showToast(t("link_copied"), "success"),
      () => showToast(t("something_went_wrong"), "error")
    );
  };

  return (
    <>
      <Tooltip content={t("start_instant_call")}>
        <button
          type="button"
          aria-label={t("start_instant_call")}
          onClick={startCall}
          className="hover:bg-cal-muted hover:text-subtle text-muted rounded-full p-1 transition focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
          <Icon name="video" className="text-default h-4 w-4" />
          {!iconOnly && <span className="ml-1 text-sm">{t("start_instant_call")}</span>}
        </button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={t("instant_call_dialog_title")}
          description={t("instant_call_dialog_description")}>
          <div className="flex flex-col gap-4">
            {callUrl && (
              <div className="border-subtle bg-muted flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="text-emphasis truncate text-sm" data-testid="instant-call-url">
                  {callUrl}
                </span>
                <Button
                  color="secondary"
                  size="sm"
                  StartIcon="copy"
                  onClick={() => handleCopy(callUrl)}
                  data-testid="instant-call-copy">
                  {t("copy")}
                </Button>
              </div>
            )}

            {recent.length > 0 && (
              <div className="border-subtle border-t pt-3">
                <p className="text-subtle mb-2 text-xs font-medium uppercase">
                  {t("recent_instant_calls")}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {recent.map((entry) => (
                    <li key={entry.url} className="flex items-center justify-between gap-2">
                      <span className="text-default truncate text-xs">{entry.url}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="text-subtle hover:text-emphasis text-xs underline"
                          onClick={() => handleCopy(entry.url)}>
                          {t("copy")}
                        </button>
                        <a
                          className="text-subtle hover:text-emphasis text-xs underline"
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer">
                          {t("open")}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter showDivider>
            <DialogClose color="minimal">{t("close")}</DialogClose>
            {callUrl && (
              <Button color="primary" href={callUrl} target="_blank" rel="noreferrer" EndIcon="external-link">
                {t("open_call")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
