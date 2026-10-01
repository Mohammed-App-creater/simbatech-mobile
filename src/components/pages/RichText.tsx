/*
 * Renders the body of an information page. The admin writes it as simple HTML (headings,
 * paragraphs, lists, links, bold text, images, tables); the website drops it into `.page-body`.
 * Here it is parsed into native text and views with the same type sizes and spacing.
 */
import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { C, F } from "@/theme";
import { API_URL, SITE_URL } from "@/lib/api";
import { navigate } from "@/lib/store";
import { openUrl } from "@/components/SiteFooter";
import { H, T } from "@/components/ui";

// ── Parsing ───────────────────────────────────────────────────────────────────

type Node = { tag: string; attrs: Record<string, string>; children: Node[]; text: string };

const VOID = new Set(["br", "img", "hr"]);
const SKIPPED = new Set(["script", "style", "head", "title"]);
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
// tags that only group other content
const CONTAINERS = new Set(["p", "div", "section", "article", "blockquote", "main", "header", "footer", "figure", "figcaption", "td", "th", "li"]);
const BLOCKS = new Set([...HEADINGS, ...CONTAINERS, "ul", "ol", "table", "img", "hr"]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: String.fromCharCode(160),
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  middot: "·",
  copy: "©",
  times: "×",
};

function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? whole;
    const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function parseAttrs(src: string) {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

/** HTML → a small tree. Forgiving: unknown tags are kept as plain groups, unclosed tags are closed for you. */
export function parseBody(html: string): Node[] {
  const root: Node = { tag: "body", attrs: {}, children: [], text: "" };
  const stack: Node[] = [root];
  const top = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+|<)/g;
  let skipUntil = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, closing, rawTag, rawAttrs, text] = m;
    if (rawTag) {
      const tag = rawTag.toLowerCase();
      if (skipUntil) {
        if (closing && tag === skipUntil) skipUntil = "";
        continue;
      }
      if (closing) {
        const at = stack.map((n) => n.tag).lastIndexOf(tag);
        if (at > 0) stack.length = at;
        continue;
      }
      if (SKIPPED.has(tag)) {
        skipUntil = tag;
        continue;
      }
      // a new block ends an open paragraph; a new list item ends the previous one
      if (BLOCKS.has(tag) && tag !== "img" && top().tag === "p") stack.pop();
      if (tag === "li" && top().tag === "li") stack.pop();
      const node: Node = { tag, attrs: parseAttrs(rawAttrs || ""), children: [], text: "" };
      top().children.push(node);
      if (!VOID.has(tag) && !/\/\s*$/.test(rawAttrs || "")) stack.push(node);
    } else if (text && !skipUntil) {
      top().children.push({ tag: "#text", attrs: {}, children: [], text: decode(text) });
    }
  }
  return root.children;
}

// ── Inline content ────────────────────────────────────────────────────────────

/** Site paths open in the app; anything else (other sites, mailto:, tel:) is handed to the phone. */
function openLink(href: string) {
  if (!href || href[0] === "#") return;
  if (href[0] === "/" && href[1] !== "/") navigate(href);
  else if (href.startsWith(SITE_URL + "/")) navigate(href.slice(SITE_URL.length));
  else openUrl(href);
}

function inline(nodes: Node[], key: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const k = key + i;
    if (n.tag === "#text") return n.text.replace(/\s+/g, " ");
    if (n.tag === "br") return "\n";
    if (n.tag === "img") return null;
    const kids = inline(n.children, k + "-");
    if (n.tag === "a") {
      return (
        <Text key={k} accessibilityRole="link" onPress={() => openLink(n.attrs.href || "")} style={{ fontFamily: F.g600, color: C.navy, textDecorationLine: "underline" }}>
          {kids}
        </Text>
      );
    }
    if (n.tag === "strong" || n.tag === "b") {
      return (
        <Text key={k} style={{ fontFamily: F.g700, color: C.ink }}>
          {kids}
        </Text>
      );
    }
    if (n.tag === "em" || n.tag === "i") {
      return (
        <Text key={k} style={{ fontStyle: "italic" }}>
          {kids}
        </Text>
      );
    }
    if (n.tag === "u") {
      return (
        <Text key={k} style={{ textDecorationLine: "underline" }}>
          {kids}
        </Text>
      );
    }
    return <React.Fragment key={k}>{kids}</React.Fragment>;
  });
}

/** Inline content of a block without the white space around it (null when there is nothing to show). */
function inlineTrimmed(nodes: Node[], key: string) {
  const out = inline(nodes, key);
  const blank = (v: React.ReactNode) => v == null || (typeof v === "string" && !v.trim());
  while (out.length && blank(out[0])) out.shift();
  while (out.length && blank(out[out.length - 1])) out.pop();
  if (!out.length) return null;
  const last = out.length - 1;
  if (typeof out[0] === "string") out[0] = out[0].replace(/^\s+/, "");
  if (typeof out[last] === "string") out[last] = (out[last] as string).replace(/\s+$/, "");
  return out;
}

// ── Blocks ────────────────────────────────────────────────────────────────────

// A block with its CSS margins; neighbours' margins collapse to the larger one, like on the site.
type Block = { el: React.ReactNode; mt: number; mb: number };

function absoluteUrl(src: string) {
  if (/^(https?:|data:)/.test(src)) return src;
  if (src.startsWith("//")) return "https:" + src;
  return (API_URL || SITE_URL) + (src[0] === "/" ? "" : "/") + src;
}

function BodyImage({ src, alt }: { src: string; alt?: string }) {
  const uri = absoluteUrl(src);
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    let live = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (live && w > 0 && h > 0) setRatio(w / h);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [uri]);
  return <Image source={{ uri }} accessibilityLabel={alt} resizeMode="cover" style={{ width: "100%", aspectRatio: ratio, borderRadius: 16, backgroundColor: C.sand }} />;
}

function List({ node, k }: { node: Node; k: string }) {
  const ordered = node.tag === "ol";
  const items = node.children.filter((c) => c.tag === "li");
  return (
    <View style={{ gap: 4 }}>
      {items.map((li, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          <T s={16} lh={25.6} c={C.text} style={{ width: 22, textAlign: ordered ? "left" : "center" }}>
            {ordered ? i + 1 + "." : "•"}
          </T>
          <View style={{ flex: 1 }}>
            <Blocks nodes={li.children} k={k + "-" + i} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Table({ node, k }: { node: Node; k: string }) {
  const rows: Node[] = [];
  const collect = (n: Node) => n.children.forEach((c) => (c.tag === "tr" ? rows.push(c) : collect(c)));
  collect(node);
  return (
    <View>
      {rows.map((tr, r) => (
        <View key={r} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line }}>
          {tr.children
            .filter((c) => c.tag === "td" || c.tag === "th")
            .map((cell, c) => (
              <View key={c} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12 }}>
                <T s={16} lh={25.6} w={cell.tag === "th" ? 700 : 400} c={cell.tag === "th" ? C.ink : C.text}>
                  {inlineTrimmed(cell.children, k + "-" + r + "-" + c)}
                </T>
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}

function toBlocks(nodes: Node[], k: string): Block[] {
  const out: Block[] = [];
  let run: Node[] = [];
  // loose text and inline tags between blocks make a paragraph
  const flush = () => {
    const kids = inlineTrimmed(run, k + "-t" + out.length + "-");
    run = [];
    if (!kids) return;
    out.push({
      mt: 0,
      mb: 16,
      el: (
        <T s={16} lh={25.6} c={C.text}>
          {kids}
        </T>
      ),
    });
  };
  nodes.forEach((n, i) => {
    const key = k + "-" + i;
    if (!BLOCKS.has(n.tag)) {
      run.push(n);
      return;
    }
    flush();
    if (HEADINGS.has(n.tag)) {
      const kids = inlineTrimmed(n.children, key + "-");
      if (!kids) return;
      if (n.tag === "h1" || n.tag === "h2") {
        out.push({
          mt: 32,
          mb: 10,
          el: (
            <H s={24} lh={26.4} ls={-0.72} accessibilityRole="header">
              {kids}
            </H>
          ),
        });
      } else {
        out.push({
          mt: 24,
          mb: 8,
          el: (
            <T s={17} w={700} lh={27.2} accessibilityRole="header">
              {kids}
            </T>
          ),
        });
      }
    } else if (n.tag === "ul" || n.tag === "ol") {
      out.push({ mt: 4, mb: 16, el: <List node={n} k={key} /> });
    } else if (n.tag === "table") {
      out.push({ mt: 0, mb: 16, el: <Table node={n} k={key} /> });
    } else if (n.tag === "img") {
      if (n.attrs.src) out.push({ mt: 0, mb: 16, el: <BodyImage src={n.attrs.src} alt={n.attrs.alt} /> });
    } else if (n.tag === "hr") {
      out.push({ mt: 8, mb: 24, el: <View style={{ height: 1, backgroundColor: C.line }} /> });
    } else {
      out.push(...toBlocks(n.children, key));
    }
  });
  flush();
  return out;
}

function Blocks({ nodes, k }: { nodes: Node[]; k: string }) {
  const blocks = toBlocks(nodes, k);
  return (
    <>
      {blocks.map((b, i) => (
        <View key={i} style={{ marginTop: i === 0 ? 0 : Math.max(blocks[i - 1].mb, b.mt) }}>
          {b.el}
        </View>
      ))}
    </>
  );
}

/** The page body. Text without any markup is shown as paragraphs split on blank lines. */
export function RichText({ html }: { html: string }) {
  const nodes = React.useMemo(() => {
    const src = String(html || "");
    if (src.includes("<")) return parseBody(src);
    return src
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .map((p): Node => ({ tag: "p", attrs: {}, children: [{ tag: "#text", attrs: {}, children: [], text: decode(p) }], text: "" }));
  }, [html]);
  return (
    <View>
      <Blocks nodes={nodes} k="b" />
    </View>
  );
}
