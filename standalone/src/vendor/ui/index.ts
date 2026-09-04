// Utilities
export { cn } from "./utils.js";

// Layout Components
export { AppShell } from "./app-shell.js";
export { PageHeader } from "./page-header.js";
export { SectionHeader } from "./section-header.js";
export { EmptyState } from "./empty-state.js";

// Basic Components
export { Button } from "./button.js";
export { Badge } from "./badge.js";
export { Skeleton } from "./skeleton.js";
export { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./card.js";
export { KPICard, type AccentColor } from "./kpi-card.js";

// Form Components
export { Label } from "./label.js";
export { Input } from "./input.js";
export { Textarea } from "./textarea.js";
export { Switch } from "./switch.js";
export { Checkbox } from "./checkbox.js";
export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "./select.js";
export { Combobox } from "./combobox.js";
export { DatePicker } from "./date-picker.js";
export { DateRangeCalendar, type DateRange } from "./date-range-calendar.js";
export { PhoneInput } from "./phone-input.js";
export { TagInput, parseTags, serializeTags, type TagInputProps } from "./tag-input.js";

// Dialog & Overlays
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog.js";
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet.js";

// Feedback Components
export { Alert, AlertTitle, AlertDescription } from "./alert.js";
export { NetworkStatusBanner } from "./network-status-banner.js";
export { AppToaster, toast, type AppToasterProps } from "./app-toaster.js";
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
} from "./tooltip.js";

// User Menu
export { UserMenu } from "./user-menu.js";
export type { UserMenuItem, UserMenuProps } from "./user-menu.js";

// Navigation Components
export {
  Breadcrumbs,
  type BreadcrumbItem,
  type BreadcrumbsProps,
  type BreadcrumbVariant,
  type BreadcrumbSeparator,
} from "./breadcrumbs.js";
export { Stepper, type StepItem, type StepperProps, type StepStatus } from "./stepper.js";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs.js";
export { PageTabs, PageTabsList, PageTabsTrigger, PageTabsContent } from "./page-tabs.js";

// List Components
export { ListPanel, type ListPanelProps } from "./list-panel.js";
export { ListItem, type ListItemProps } from "./list-item.js";

// Data Display
export { DataTable } from "./data-table.js";
export type { DataTableProps } from "./data-table.js";
export { DataTableEmpty } from "./data-table-empty.js";
export type { DataTableEmptyProps } from "./data-table-empty.js";
export {
  TableFilters,
  TableFilterChips,
  type FilterFieldConfig,
  type FilterOption,
  type TableFiltersProps,
} from "./table-filters.js";
export {
  AdvancedFilterModal,
  type AdvancedFilterSection,
  type AdvancedFilterValues,
  type FilterChipOption,
} from "./advanced-filter-modal.js";
export { TableSort, type SortField, type TableSortProps } from "./table-sort.js";
export { TablePagination } from "./table-pagination.js";
export { useFilterableTable, buildCursorPaginationVariables } from "./use-filterable-table.js";
export type { PageInfo, SortValue } from "./use-filterable-table.js";
export { RefreshButton } from "./refresh-button.js";
export { CopyIconButton, type CopyIconButtonProps } from "./copy-icon-button.js";
export { useFormValidation, type ValidationField, type FieldError } from "./use-form-validation.js";

// Query Components
export {
  CancelQueryDialog,
  type CancelQueryReason,
  type CancelQueryDialogProps,
} from "./cancel-query-dialog.js";

// Confirmation Dialog
export { ConfirmationDialog, type ConfirmationDialogProps } from "./confirmation-dialog.js";

// Claim/Validation Detail Components
export {
  EditCard,
  type EditCardProps,
  type EditCardWrapper,
  type EditCardEdit,
} from "./edit-card.js";
export { ItemCard, type ItemCardProps } from "./item-card.js";
export {
  getPriorityVariant,
  getPriorityBorder,
  resolveExtraData,
  getAiEditDisplay,
  isEditVisible,
  getDisplayConfidenceColor,
  getEffectivePriority,
  CONFIDENCE_STYLES,
  type EditDisplayState,
} from "./claim-helpers.js";

// Enhanced Components (with label, AI prefill, icons)
export {
  EnhancedInput,
  type EnhancedInputProps,
  Modal,
  closeAllModals,
  registerModalCloseHandler,
  type ModalProps,
  type ModalVariant,
  type ModalSize,
  CortexSelect,
  type CortexSelectProps,
  EnhancedStepper,
  type EnhancedStepperProps,
  type EnhancedStepItem,
  type EnhancedStepStatus,
  EnhancedBadge,
  EnhancedTag,
  type EnhancedTagProps,
  BADGE_COLORS,
  BADGE_SIZES,
  DOT_SIZES,
  STATUS_TO_COLOR,
  BASE_CLASSES,
  INTERACTIVE_CLASSES,
  resolveColor,
  type BadgeColor,
  type BadgeSize,
  type DotSize,
  Dot,
  type DotProps,
  CardShell,
  type CardShellProps,
  PageContent,
  CortexKPICard,
  Trend,
  type TrendProps,
  type TrendDirection,
  ProgressBar,
  type ProgressBarProps,
  type ProgressBarSize,
  type ProgressBarColor,
} from "./enhanced/index.js";

// Enhanced Navigation
export { CortexTabs, type TabItem } from "./cortex-tabs.js";

// Enhanced Primitives
export { CortexButton } from "./cortex-button.js";
export { CortexTooltip } from "./cortex-tooltip.js";
export {
  OverflowActionRail,
  type OverflowActionRailProps,
  type OverflowRailItem,
} from "./overflow-action-rail.js";
export { CortexCheckbox } from "./cortex-checkbox.js";
export { Pill } from "./pill.js";

// Markdown
export { LazyMarkdown } from "./lazy-markdown.js";

// Support
export { SupportWidget, type SupportWidgetProps } from "./support-widget.js";
