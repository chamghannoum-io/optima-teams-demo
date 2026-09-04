/**
 * Stands in for the app's "@/components/enhanced" barrel.
 *
 * Re-exports @optima/ui (all 75 vendored files) plus the two app-layer layout
 * components the Teams page uses. Nothing here is reimplemented.
 */
export * from "../ui/index.js";
export { default as PageContent } from "../applayer/PageContent.js";
