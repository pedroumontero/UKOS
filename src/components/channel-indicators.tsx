import { PublicationStatus } from "@prisma/client";
import { Store } from "lucide-react";

import { cn } from "@/lib/utils";

type ChannelIndicator = {
  name: string;
  code: string;
  status: PublicationStatus;
};

function ChannelGlyph({ code }: { code: string }) {
  const c = code.toLowerCase();
  if (c.includes("facebook") || c === "facebook_marketplace") {
    return (
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden>
        <path
          fill="#1877F2"
          d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 5.997 4.388 10.983 10.125 11.927v-8.43H7.078v-3.497h3.047V9.413c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953h-1.513c-1.491 0-1.956.926-1.956 1.874v2.246h3.328l-.532 3.497h-2.796V24C19.612 23.056 24 18.069 24 12.073z"
        />
      </svg>
    );
  }
  if (c.includes("offerup") || c === "offerup") {
    return (
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="#00A87E" />
        <path fill="#fff" d="M12 7l3.5 6H8.5L12 7zm0-1.5L6 18h12L12 5.5z" />
      </svg>
    );
  }
  if (c.includes("ebay")) {
    return (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="#E53238" d="M5.5 8.5h4.2c1.4 0 2.3.8 2.3 2.1 0 .9-.4 1.5-1.1 1.8l1.9 3.6h-2.5l-1.5-3h-1v3H5.5v-7.5zm2.2 3.6h1.4c.6 0 1-.3 1-.9 0-.6-.4-.9-1.1-.9H7.7v1.8z" />
        <path fill="#0064D2" d="M13.8 8.5h2.1l2.8 4.4V8.5h2.2v7.5h-2.1l-2.8-4.4v4.4h-2.2v-7.5z" />
        <path fill="#F5AF02" d="M5.5 5.5h13v1.5h-13V5.5z" />
      </svg>
    );
  }
  if (c.includes("mercado") || c.includes("ml_")) {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <rect width="24" height="24" rx="12" fill="#FFE600" />
        <circle cx="9" cy="12" r="3.5" fill="#2D3277" />
        <circle cx="15" cy="12" r="3.5" fill="#2D3277" />
      </svg>
    );
  }
  return <Store className="size-4 text-muted-foreground" aria-hidden />;
}

export function ChannelIndicators({ channels }: { channels: ChannelIndicator[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {channels.map((channel) => {
        const published = channel.status === PublicationStatus.PUBLISHED;
        return (
          <div
            key={`${channel.code}-${channel.name}`}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border text-xs font-semibold shadow-sm",
              published
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "border-border/70 bg-card text-muted-foreground",
            )}
            title={channel.name}
          >
            <ChannelGlyph code={channel.code} />
          </div>
        );
      })}
    </div>
  );
}
