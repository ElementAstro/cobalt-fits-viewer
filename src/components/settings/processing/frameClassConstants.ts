import type {
  FrameClassificationRuleHeaderField,
  FrameClassificationRuleMatchType,
  FrameClassificationRuleTarget,
} from "../../../lib/fits/types";

export const RULE_TARGET_OPTIONS: FrameClassificationRuleTarget[] = ["header", "filename"];
export const RULE_MATCH_OPTIONS: FrameClassificationRuleMatchType[] = [
  "exact",
  "contains",
  "regex",
];
export const RULE_HEADER_OPTIONS: FrameClassificationRuleHeaderField[] = [
  "IMAGETYP",
  "FRAME",
  "ANY",
];
