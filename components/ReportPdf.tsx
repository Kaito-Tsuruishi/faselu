import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { parseReport } from "@/lib/parse-report";

Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: "/fonts/NotoSansJP-Regular.woff", fontWeight: "normal" },
    { src: "/fonts/NotoSansJP-Medium.woff", fontWeight: "medium" },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "NotoSansJP",
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
  },
  brand: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#888",
  },
  date: {
    fontSize: 9,
    letterSpacing: 1,
    color: "#888",
  },
  title: {
    fontSize: 22,
    fontWeight: "medium",
    marginBottom: 8,
    lineHeight: 1.5,
  },
  subtitle: {
    fontSize: 10,
    color: "#888",
    letterSpacing: 2,
    marginBottom: 36,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: "#b8923f",
    fontWeight: "medium",
    marginBottom: 6,
  },
  heading: {
    fontSize: 14,
    fontWeight: "medium",
    marginBottom: 12,
    color: "#1a1a1a",
  },
  body: {
    fontSize: 11,
    lineHeight: 1.9,
    marginBottom: 24,
    color: "#222",
  },
  divider: {
    height: 1,
    backgroundColor: "#e6e1d8",
    marginBottom: 24,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 8,
    color: "#aaa",
    letterSpacing: 1,
    textAlign: "center",
  },
});

type Props = {
  report: string;
  date?: string;
};

export function ReportPdf({ report, date }: Props) {
  const sections = parseReport(report);
  const displayDate =
    date ??
    new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <Document
      title="Faselu / 詳細レポート"
      author="Faselu"
      creator="Faselu"
      producer="Faselu"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>FASELU</Text>
          <Text style={styles.date}>{displayDate}</Text>
        </View>

        <Text style={styles.title}>あなたという人間</Text>
        <Text style={styles.subtitle}>A SESSION WITH YOURSELF</Text>

        <View style={styles.divider} />

        {sections.map((section, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.sectionLabel}>
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
