// Metodologiya: the website's own methodology card, read from the same
// i18n dictionaries the rest of the app already uses (frontend/i18n/*.json)
// -- not rewritten, just rendered with RN Text instead of raw HTML. The
// website's methodology-section markup (frontend/index.html) is the source
// of truth for exactly which strings this reads.
//
// One addition the website doesn't publish: the Abşeron-Xızı note below
// (notes.absheron.* -- app-only strings, i18n.tsx). It quotes the verified
// explanation in docs/methodology_log.md (2026-09-26 entry), not the
// earlier, since-retracted guess in an older version of that entry.
import { type ReactNode, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import { Card } from "./components";
import { DATA_URL, type Dataset } from "./data";
import { useI18n } from "./i18n";
import { useTheme, type Theme } from "./theme";

const SOURCE_URL = "https://www.stat.gov.az/source/healthcare/?lang=en";
const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// Parses the handful of inline tags the source i18n strings actually use
// (<strong>, <code>, <a href>, the COVID/est badge spans, the delta arrow
// spans) -- not a general HTML parser, just enough for these five keys.
type Token =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "badge"; kind: "covid" | "est"; text: string };

const INLINE_RE = /<strong>(.*?)<\/strong>|<code>(.*?)<\/code>|<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>|<span class="badge badge-(covid|est)">(.*?)<\/span>|<span class="delta"[^>]*>(.*?)<\/span>/gs;

function parseInlineHtml(html: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(html))) {
    if (m.index > last) tokens.push({ type: "text", text: html.slice(last, m.index) });
    if (m[1] != null) tokens.push({ type: "bold", text: m[1] });
    else if (m[2] != null) tokens.push({ type: "code", text: m[2] });
    else if (m[3] != null) tokens.push({ type: "link", text: m[4], href: m[3] });
    else if (m[5] != null) tokens.push({ type: "badge", kind: m[5] as "covid" | "est", text: m[6] });
    else if (m[7] != null) tokens.push({ type: "text", text: m[7] }); // delta ▲/▼ spans: keep the glyph as plain text
    last = INLINE_RE.lastIndex;
  }
  if (last < html.length) tokens.push({ type: "text", text: html.slice(last) });
  return tokens;
}

function InlineHtml({ html, theme, style }: { html: string; theme: Theme; style?: object }) {
  return (
    <Text style={style}>
      {parseInlineHtml(html).map((tok, i) => {
        switch (tok.type) {
          case "bold":
            return <Text key={i} style={{ fontWeight: "700", color: theme.textPrimary }}>{tok.text}</Text>;
          case "code":
            return <Text key={i} style={{ fontFamily: MONO, fontSize: 12 }}>{tok.text}</Text>;
          case "link":
            return <Text key={i} style={{ color: theme.series }} onPress={() => Linking.openURL(tok.href)}>{tok.text}</Text>;
          case "badge":
            return <Text key={i} style={{ fontWeight: "700", color: tok.kind === "covid" ? theme.covidFg : theme.estFg }}>{tok.text}</Text>;
          default:
            return <Text key={i}>{tok.text}</Text>;
        }
      })}
    </Text>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

export function MethodologyCard({ dataset }: { dataset: Dataset }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Text style={[styles.heading, { color: theme.textPrimary }]}>{t("methodology.heading")}</Text>

      <Row label={t("methodology.source")}>
        <Text style={{ color: theme.series, fontSize: 13 }} onPress={() => Linking.openURL(SOURCE_URL)}>
          {t("methodology.sourceName")}
        </Text>
      </Row>
      <Row label={t("methodology.lastUpdated")}>
        <Text style={{ color: theme.textPrimary, fontSize: 13 }}>{dataset.generated ?? "—"}</Text>
      </Row>
      <Row label={t("methodology.rawData")}>
        <Text numberOfLines={1} style={{ color: theme.series, fontSize: 13 }} onPress={() => Linking.openURL(DATA_URL)}>
          circulatory_data.json
        </Text>
      </Row>
      <Row label={t("methodology.project")}>
        <InlineHtml html={t("methodology.projectHtml")} theme={theme} style={{ color: theme.textPrimary, fontSize: 13 }} />
      </Row>

      <Text
        style={[styles.summary, { color: theme.series }]}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        {t("notes.summary")} {open ? "▲" : "▼"}
      </Text>
      {open && (
        <View style={styles.notes}>
          <InlineHtml html={t("notes.rateHtml")} theme={theme} style={[styles.note, { color: theme.textSecondary }]} />
          <InlineHtml html={t("notes.deltaHtml")} theme={theme} style={[styles.note, { color: theme.textSecondary }]} />
          <InlineHtml html={t("notes.covidHtml")} theme={theme} style={[styles.note, { color: theme.textSecondary }]} />
          <InlineHtml html={t("notes.estHtml")} theme={theme} style={[styles.note, { color: theme.textSecondary }]} />
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            <Text style={{ fontWeight: "700", color: theme.textPrimary }}>{t("notes.absheron.term")}</Text>
            {" — "}{t("notes.absheron.body")}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  rowLabel: { width: 90, fontSize: 13, fontWeight: "600" },
  rowValue: { flex: 1 },
  summary: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  notes: { gap: 10 },
  note: { fontSize: 12, lineHeight: 17 },
});
