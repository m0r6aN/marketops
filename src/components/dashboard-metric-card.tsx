import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardMetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "attention";
  className?: string;
};

export function DashboardMetricCard({
  label,
  value,
  detail,
  tone = "default",
  className,
}: DashboardMetricCardProps) {
  return (
    <Card
      className={cn(
        "h-full border-border/70 bg-card/95 shadow-sm",
        tone === "attention" && "border-amber-300/70 bg-amber-50/30 dark:border-amber-400/30 dark:bg-amber-950/10",
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="text-3xl font-semibold tracking-tight sm:text-4xl">{value}</span>
        {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
