import { ThemeToggle } from "@/components/theme-toggle";
import { UkosMobileNav } from "@/components/ukos-mobile-nav";
import { Badge } from "@/components/ui/badge";

type HeaderProps = {
  companyName: string;
  moduleLabel?: string;
  title: string;
  description: string;
};

export function UkosHeader({ companyName, moduleLabel, title, description }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 px-4 py-4 lg:px-8">
        <div className="flex items-start gap-3">
          <div className="lg:hidden">
            <UkosMobileNav companyName={companyName} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {moduleLabel ? <Badge variant="outline">{moduleLabel}</Badge> : null}
              <Badge variant="secondary">{companyName}</Badge>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground lg:text-2xl">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
