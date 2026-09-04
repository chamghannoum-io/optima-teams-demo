import { RefreshCw } from "lucide-react";
import { Button } from "./button.js";
import { useI18n } from "@optima/i18n";

export function RefreshButton({
  onClick,
  loading,
  label,
  "data-testid": dataTestId,
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  "data-testid"?: string;
}) {
  const t = useI18n();
  return (
    <Button
      size="sm"
      variant="secondary"
      data-testid={dataTestId}
      onClick={onClick}
      disabled={loading}
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
      {label ?? t("common.refresh")}
    </Button>
  );
}
