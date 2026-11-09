import { blockTypeOptions, chartKindOptions, variableOptions, type TemplateBlock } from "@/lib/documents/template-schema";

const variableLabels: Record<string, string> = Object.fromEntries(
  variableOptions.map((option) => [option.key, option.label.toLowerCase()]),
);

export const blockLabels = Object.fromEntries(blockTypeOptions.map((option) => [option.type, option.label])) as Record<
  TemplateBlock["type"],
  string
>;
const chartLabels: Record<string, string> = Object.fromEntries(chartKindOptions.map((option) => [option.key, option.label]));

// What a block shows, in a few words.
export function blockDetail(block: TemplateBlock) {
  switch (block.type) {
    case "heading":
    case "text":
      return humanize(block.text).replace(/\s+/g, " ");
    case "chart":
      return block.title || chartLabels[block.kind];
    case "metrics":
      return block.metrics.map((key) => variableLabels[key] ?? key).join(", ");
    case "facts":
    case "taskTable":
    case "memberTable":
    case "signatures":
      return block.title;
    case "pageBreak":
      return "";
  }
}

// Small models sometimes leak template placeholders into replies; show them as plain words.
export function humanize(text: string) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => variableLabels[key] ?? key.replace(/\./g, " "));
}
