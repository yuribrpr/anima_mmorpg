import { LoaderCircle } from "lucide-react";

export const FullPageLoader = ({ label }: { label: string }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
};
