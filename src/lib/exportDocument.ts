import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, Header, Footer, PageNumber,
  NumberFormat, convertInchesToTwip,
} from "docx";

interface ExportSection {
  title: string;
  content: string;
  isMarkdown?: boolean;
}

interface ExportOptions {
  documentTitle: string;
  orgao?: string;
  legalBasis?: string;
  sections: ExportSection[];
}

// ── Remove citation blocks before export (kept only during streaming preview) ─
function stripCitationBlocks(md: string): string {
  return md
    .split("\n")
    .filter(line => !line.trimStart().startsWith("> 📌"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Markdown parser → docx Paragraphs ────────────────────────────────────────

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[2]) runs.push(new TextRun({ text: m[2], bold: true, italics: true }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], bold: true }));
    else if (m[4]) runs.push(new TextRun({ text: m[4], italics: true }));
    else if (m[5]) runs.push(new TextRun({ text: m[5], font: "Courier New", size: 18 }));
    else if (m[6]) runs.push(new TextRun({ text: m[6] }));
  }
  return runs.length ? runs : [new TextRun({ text })];
}

function markdownToParagraphs(md: string): Paragraph[] {
  const lines = md.split("\n");
  const paragraphs: Paragraph[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Headings
    const h4 = line.match(/^#{4} (.+)/);
    const h3 = line.match(/^#{3} (.+)/);
    const h2 = line.match(/^#{2} (.+)/);
    const h1 = line.match(/^# (.+)/);

    if (h1) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: stripInlineMarkdown(h1[1]), bold: true })] }));
    } else if (h2) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: stripInlineMarkdown(h2[1]), bold: true })] }));
    } else if (h3) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: stripInlineMarkdown(h3[1]) })] }));
    } else if (h4) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_4, children: [new TextRun({ text: stripInlineMarkdown(h4[1]) })] }));
    }
    // Horizontal rule
    else if (/^---+$|^\*\*\*+$/.test(line)) {
      paragraphs.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C9A84C" } },
        children: [],
      }));
    }
    // Bullet list
    else if (/^(\s*)[-*+] (.+)/.test(line)) {
      const m = line.match(/^(\s*)[-*+] (.+)/)!;
      const level = Math.floor(m[1].length / 2);
      paragraphs.push(new Paragraph({
        bullet: { level },
        children: parseInline(m[2]),
      }));
    }
    // Numbered list
    else if (/^(\s*)\d+\. (.+)/.test(line)) {
      const m = line.match(/^(\s*)\d+\. (.+)/)!;
      paragraphs.push(new Paragraph({
        numbering: { reference: "intelicite-numbering", level: 0 },
        children: parseInline(m[2]),
      }));
    }
    // Empty line
    else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ children: [] }));
    }
    // Normal paragraph
    else {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: parseInline(line),
        spacing: { after: 120 },
      }));
    }

    i++;
  }

  return paragraphs;
}

// ── Build DOCX document ───────────────────────────────────────────────────────

function buildSectionTitle(title: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: title.toUpperCase(), bold: true, color: "7A5C00", size: 20 })],
    border: { left: { style: BorderStyle.THICK, size: 16, color: "C9A84C" } },
    indent: { left: convertInchesToTwip(0.1) },
    spacing: { before: 280, after: 120 },
  });
}

function buildHeaderTable(title: string, orgao?: string, legalBasis?: string): Table {
  const cells = [
    new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 28, color: "1A1A1A" })],
          spacing: { after: 80 },
        }),
        ...(orgao ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: orgao, size: 20, color: "555555" })], spacing: { after: 60 } })] : []),
        ...(legalBasis ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: legalBasis, size: 18, color: "7A5C00", bold: true })] })] : []),
      ],
      shading: { type: ShadingType.SOLID, color: "FDF8EE" },
      borders: {
        bottom: { style: BorderStyle.THICK, size: 16, color: "C9A84C" },
        top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      },
    }),
  ];

  return new Table({
    rows: [new TableRow({ children: cells })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

async function buildDocx(options: ExportOptions): Promise<Blob> {
  const bodyChildren: (Paragraph | Table)[] = [
    buildHeaderTable(options.documentTitle, options.orgao, options.legalBasis),
    new Paragraph({ children: [] }),
  ];

  for (const section of options.sections) {
    if (!section.content.trim()) continue;

    if (section.title) {
      bodyChildren.push(buildSectionTitle(section.title));
    }

    const cleanContent = stripCitationBlocks(section.content);
    const useMarkdown = section.isMarkdown !== false && /[#*`]/.test(cleanContent);
    const sectionParagraphs = useMarkdown
      ? markdownToParagraphs(cleanContent)
      : cleanContent.split("\n").map(line =>
          new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: line })], spacing: { after: 100 } })
        );

    bodyChildren.push(...sectionParagraphs);
  }

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  bodyChildren.push(
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Documento gerado por InteliCite AI — ${today}`, size: 16, color: "888888", italics: true })],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" } },
      spacing: { before: 400 },
    }),
  );

  const doc = new Document({
    numbering: {
      config: [{
        reference: "intelicite-numbering",
        levels: [{ level: 0, format: NumberFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } },
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", run: { bold: true, size: 28, color: "1A1A1A" }, paragraph: { spacing: { before: 320, after: 160 } } },
        { id: "Heading2", name: "Heading 2", run: { bold: true, size: 24, color: "333333" }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: "Heading3", name: "Heading 3", run: { bold: true, size: 22, color: "555555" }, paragraph: { spacing: { before: 200, after: 80 } } },
        { id: "Heading4", name: "Heading 4", run: { bold: true, italics: true, size: 22, color: "666666" }, paragraph: { spacing: { before: 160, after: 60 } } },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.25), right: convertInchesToTwip(1) },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: options.documentTitle, size: 16, color: "888888" })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" } },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Página ", size: 16, color: "888888" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }),
              new TextRun({ text: " de ", size: 16, color: "888888" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "888888" }),
            ],
          })],
        }),
      },
      children: bodyChildren,
    }],
  });

  return Packer.toBlob(doc);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportAsDocx(options: ExportOptions): Promise<void> {
  const blob = await buildDocx(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${options.documentTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── HTML/PDF export (unchanged) ───────────────────────────────────────────────

function inlineMarkdownToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let listType = "";
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = ""; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^# (.+)/.test(line))   { closeList(); out.push(`<h1>${inlineMarkdownToHtml(line.replace(/^# /, ""))}</h1>`); continue; }
    if (/^## (.+)/.test(line))  { closeList(); out.push(`<h2>${inlineMarkdownToHtml(line.replace(/^## /, ""))}</h2>`); continue; }
    if (/^### (.+)/.test(line)) { closeList(); out.push(`<h3>${inlineMarkdownToHtml(line.replace(/^### /, ""))}</h3>`); continue; }
    if (/^#### (.+)/.test(line)){ closeList(); out.push(`<h4>${inlineMarkdownToHtml(line.replace(/^#### /, ""))}</h4>`); continue; }
    if (/^---+$|^\*\*\*+$/.test(line)) { closeList(); out.push("<hr>"); continue; }
    const bullet = line.match(/^(\s*)[-*+] (.+)/);
    if (bullet) { if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; } out.push(`<li>${inlineMarkdownToHtml(bullet[2])}</li>`); continue; }
    const num = line.match(/^(\s*)\d+\. (.+)/);
    if (num) { if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; } out.push(`<li>${inlineMarkdownToHtml(num[2])}</li>`); continue; }
    if (line.trim() === "") { closeList(); out.push(""); continue; }
    closeList();
    out.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

function buildHtml(options: ExportOptions): string {
  const sectionsHtml = options.sections
    .filter(s => s.content.trim())
    .map(s => {
      const cleanContent = stripCitationBlocks(s.content);
      const body = s.isMarkdown !== false && /[#*`]/.test(cleanContent)
        ? markdownToHtml(cleanContent)
        : `<p style="white-space:pre-wrap;">${cleanContent.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>`;
      return `<section>${s.title ? `<div class="sec-title">${s.title}</div>` : ""}${body}</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<title>${options.documentTitle}</title>
<style>
  @page { margin: 22mm 20mm 22mm 25mm; }
  @media print { body { font-size: 11pt; } .no-print { display:none; } }
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #111; line-height: 1.7; margin: 0 auto; max-width: 800px; padding: 40px 48px; }
  .doc-header { text-align: center; border-bottom: 2px solid #8b6914; padding-bottom: 16px; margin-bottom: 28px; }
  .doc-header h1 { font-size: 15pt; font-weight: bold; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-header .sub { font-size: 10pt; color: #555; margin: 2px 0; }
  .doc-header .badge { display: inline-block; margin-top: 8px; background: #f5f0e0; border: 1px solid #c9a84c; border-radius: 4px; padding: 2px 10px; font-size: 9pt; color: #7a5c00; font-weight: bold; }
  section { margin-bottom: 20px; page-break-inside: avoid; }
  .sec-title { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #7a5c00; border-left: 3px solid #c9a84c; padding-left: 8px; margin: 20px 0 8px; }
  h1 { font-size: 14pt; font-weight: bold; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h2 { font-size: 12pt; font-weight: bold; margin: 16px 0 6px; }
  h3 { font-size: 11pt; font-weight: bold; margin: 12px 0 4px; color: #333; }
  h4 { font-size: 11pt; font-weight: bold; font-style: italic; margin: 10px 0 4px; }
  p { margin: 0 0 8px; text-align: justify; }
  ul, ol { margin: 4px 0 8px 24px; padding: 0; }
  li { margin-bottom: 3px; }
  code { font-family: "Courier New", monospace; font-size: 10pt; background: #f5f5f5; padding: 0 3px; border-radius: 2px; }
  hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  .doc-footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 9pt; color: #888; text-align: center; }
</style>
</head><body>
  <div class="doc-header">
    <h1>${options.documentTitle}</h1>
    ${options.orgao ? `<p class="sub">${options.orgao}</p>` : ""}
    ${options.legalBasis ? `<span class="badge">${options.legalBasis}</span>` : ""}
  </div>
  ${sectionsHtml}
  <div class="doc-footer">
    Documento gerado por InteliCite AI &mdash; ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;
}

export function exportAsPdf(options: ExportOptions) {
  const html = buildHtml(options);
  const win = window.open("", "_blank");
  if (!win) { alert("Permita pop-ups para exportar o PDF."); return; }
  win.document.write(html);
  win.document.close();
}

export function exportChecklist(
  tipo: string,
  items: { id: string; text: string; required: boolean; category: string }[],
  checked: Set<string>
) {
  const tipoLabel = tipo === "bens" ? "Aquisição de Bens" : tipo === "servicos" ? "Prestação de Serviços" : "Obras e Engenharia";
  const categories = [...new Set(items.map(i => i.category))];
  const sections = categories.map(cat => ({
    title: cat,
    isMarkdown: false,
    content: items
      .filter(i => i.category === cat)
      .map((item, idx) => `${checked.has(item.id ?? String(idx)) ? "✅" : "⬜"} ${item.text}${item.required ? " (Obrigatório)" : ""}`)
      .join("\n"),
  }));
  exportAsPdf({ documentTitle: `Checklist — ${tipoLabel}`, legalBasis: "Lei 14.133/2021", sections });
}

export function exportValidatorReport(
  findings: { severity: string; title: string; description: string; article: string }[]
) {
  const grouped = {
    alta: findings.filter(f => f.severity === "alta"),
    media: findings.filter(f => f.severity === "media"),
    baixa: findings.filter(f => f.severity === "baixa"),
  };
  exportAsPdf({
    documentTitle: "Relatório de Validação de Edital",
    legalBasis: "Lei 14.133/2021",
    sections: [
      { title: "Resumo", isMarkdown: false, content: `Total de achados: ${findings.length}\nRisco Alto: ${grouped.alta.length}\nRisco Médio: ${grouped.media.length}\nRisco Baixo: ${grouped.baixa.length}` },
      ...findings.map(f => ({ title: `[${f.severity.toUpperCase()}] ${f.title}`, isMarkdown: false, content: `${f.description}\nFundamento: ${f.article}` })),
    ],
  });
}

export function exportQuotation(
  items: { descricao: string; quantidade: number; valorUnitario: number }[],
  margem: string,
  impostos: string,
  subtotal: number,
  total: number
) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  exportAsPdf({
    documentTitle: "Proposta Comercial",
    sections: [
      { title: "Itens da Proposta", isMarkdown: false, content: items.filter(i => i.descricao).map(i => `${i.descricao} — Qtd: ${i.quantidade} × ${fmt(i.valorUnitario)} = ${fmt(i.quantidade * i.valorUnitario)}`).join("\n") },
      { title: "Resumo Financeiro", isMarkdown: false, content: `Subtotal: ${fmt(subtotal)}\nMargem (${margem}%): ${fmt(subtotal * (parseFloat(margem) / 100))}\nImpostos (${impostos}%): ${fmt((subtotal + subtotal * (parseFloat(margem) / 100)) * (parseFloat(impostos) / 100))}\n\nTOTAL: ${fmt(total)}` },
    ],
  });
}

export function exportDiagnostic(result: {
  modalidade: string; fundamento: string; descricao: string; alertas: string[]; recomendacoes: string[];
}) {
  exportAsPdf({
    documentTitle: "Diagnóstico de Licitação",
    legalBasis: "Lei 14.133/2021",
    sections: [
      { title: "Modalidade Recomendada", isMarkdown: false, content: `${result.modalidade}\n${result.fundamento}\n\n${result.descricao}` },
      { title: "Alertas", isMarkdown: false, content: result.alertas.map(a => `⚠ ${a}`).join("\n") },
      { title: "Recomendações", isMarkdown: false, content: result.recomendacoes.map(r => `✓ ${r}`).join("\n") },
    ],
  });
}
