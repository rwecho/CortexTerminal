import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type PageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  headerAccessory?: ReactNode;
  className?: string;
};

export function PageShell({
  title,
  subtitle,
  children,
  onBack,
  backLabel,
  headerAccessory,
  className,
}: PageShellProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-[#050505] px-4 pt-4 pb-8">
      <div className={cn("mx-auto w-full max-w-md space-y-5", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {onBack ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={onBack}
                aria-label={backLabel ?? "back"}
                title={backLabel ?? "back"}
                className="shrink-0"
              >
                <ChevronLeft size={18} />
              </Button>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {headerAccessory}
        </div>
        {children}
      </div>
    </div>
  );
}
