/**
 * Tooltip Guide Steps Configuration
 *
 * Defines the per-page bubble guide steps shown after the full-screen onboarding.
 * Each step targets a specific UI element wrapped with <GuideTarget>.
 */

export interface GuideStepConfig {
  page: string;
  order: number;
  targetName: string;
  titleKey: string;
  descKey: string;
  placement: "top" | "bottom" | "left" | "right";
}

export const GUIDE_PAGES = ["files", "gallery", "targets", "sessions"] as const;

export type GuidePage = (typeof GUIDE_PAGES)[number];

export const GUIDE_STEPS: GuideStepConfig[] = [
  // Files page
  {
    page: "files",
    order: 0,
    targetName: "files-import",
    titleKey: "onboarding.tooltip.filesImportTitle",
    descKey: "onboarding.tooltip.filesImportDesc",
    placement: "bottom",
  },
  {
    page: "files",
    order: 1,
    targetName: "files-sort",
    titleKey: "onboarding.tooltip.filesSortTitle",
    descKey: "onboarding.tooltip.filesSortDesc",
    placement: "bottom",
  },

  // Gallery page
  {
    page: "gallery",
    order: 0,
    targetName: "gallery-tabs",
    titleKey: "onboarding.tooltip.galleryTabsTitle",
    descKey: "onboarding.tooltip.galleryTabsDesc",
    placement: "bottom",
  },
  {
    page: "gallery",
    order: 1,
    targetName: "gallery-header",
    titleKey: "onboarding.tooltip.galleryHeaderTitle",
    descKey: "onboarding.tooltip.galleryHeaderDesc",
    placement: "bottom",
  },

  // Targets page
  {
    page: "targets",
    order: 0,
    targetName: "targets-add",
    titleKey: "onboarding.tooltip.targetsAddTitle",
    descKey: "onboarding.tooltip.targetsAddDesc",
    placement: "bottom",
  },
  {
    page: "targets",
    order: 1,
    targetName: "targets-scan",
    titleKey: "onboarding.tooltip.targetsScanTitle",
    descKey: "onboarding.tooltip.targetsScanDesc",
    placement: "bottom",
  },

  // Sessions page
  {
    page: "sessions",
    order: 0,
    targetName: "sessions-create",
    titleKey: "onboarding.tooltip.sessionsCreateTitle",
    descKey: "onboarding.tooltip.sessionsCreateDesc",
    placement: "bottom",
  },
  {
    page: "sessions",
    order: 1,
    targetName: "sessions-plan",
    titleKey: "onboarding.tooltip.sessionsPlanTitle",
    descKey: "onboarding.tooltip.sessionsPlanDesc",
    placement: "bottom",
  },
  {
    page: "sessions",
    order: 2,
    targetName: "sessions-detect",
    titleKey: "onboarding.tooltip.sessionsDetectTitle",
    descKey: "onboarding.tooltip.sessionsDetectDesc",
    placement: "bottom",
  },
];

export function getPageSteps(page: string): GuideStepConfig[] {
  return GUIDE_STEPS.filter((step) => step.page === page);
}

export function getPageStepCount(page: string): number {
  return GUIDE_STEPS.filter((step) => step.page === page).length;
}

export function getStepConfig(page: string, order: number): GuideStepConfig | undefined {
  return GUIDE_STEPS.find((step) => step.page === page && step.order === order);
}
