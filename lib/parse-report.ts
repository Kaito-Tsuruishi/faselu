export type ReportSection = {
  heading: string;
  body: string;
};

export function parseReport(report: string): ReportSection[] {
  const lines = report.split("\n");
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1].trim(), body: "" };
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  return sections.map((s) => ({
    heading: s.heading,
    body: s.body.trim(),
  }));
}
