export type ReportSection = {
  heading: string;
  body: string;
};

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/(?<!\*)\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1") // *italic* (not bold)
    .replace(/^[-*+]\s+/gm, "") // list bullets
    .replace(/`([^`]+)`/g, "$1"); // `code`
}

export function parseReport(report: string): ReportSection[] {
  const lines = report.split("\n");
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = { heading: stripInlineMarkdown(match[1].trim()), body: "" };
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  const trimmed = sections.map((s) => ({
    heading: s.heading,
    body: stripInlineMarkdown(s.body.trim()),
  }));

  if (trimmed.length === 0 && report.trim().length > 0) {
    return [
      {
        heading: "あなたという人間",
        body: stripInlineMarkdown(report.trim()),
      },
    ];
  }

  return trimmed;
}
