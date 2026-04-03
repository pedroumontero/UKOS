import Link from "next/link";
import { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  href?: string;
};

export function MetricCard({ label, value, helper, icon: Icon, href }: MetricCardProps) {
  const body = (
    <CardContent className="flex items-start justify-between p-5">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      </div>
      <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-3xl outline-none ring-offset-background transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring">
        <Card className={cn("rounded-3xl border-border/60 bg-card/90 shadow-sm", "cursor-pointer hover:border-primary/40")}>
          {body}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
      {body}
    </Card>
  );
}
