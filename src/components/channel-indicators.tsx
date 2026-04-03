import { CheckCircle2, CircleDashed } from "lucide-react";

import { PublicationStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

type ChannelIndicator = {
  name: string;
  status: PublicationStatus;
};

export function ChannelIndicators({ channels }: { channels: ChannelIndicator[] }) {
  return (
    <div className="flex items-center gap-2">
      {channels.map((channel) => {
        const published = channel.status === PublicationStatus.PUBLISHED;
        return (
          <div
            key={channel.name}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border text-xs font-semibold shadow-sm",
              published
                ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "border-border/70 bg-card text-muted-foreground",
            )}
            title={channel.name}
          >
            {published ? <CheckCircle2 className="size-4" /> : <CircleDashed className="size-4" />}
          </div>
        );
      })}
    </div>
  );
}
