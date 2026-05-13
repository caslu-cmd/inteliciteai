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
  format: "pdf" | "docx";
}

// ── Markdown → HTML (handles Claude's ETP/TR output) ──────────
function inlineMarkdown(text: string): string {
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

  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = ""; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^#{1} (.+)/.test(line)) { closeList(); out.push(`<h1>${inlineMarkdown(line.replace(/^# /, ""))}</h1>`); continue; }
    if (/^#{2} (.+)/.test(line)) { closeList(); out.push(`<h2>${inlineMarkdown(line.replace(/^## /, ""))}</h2>`); continue; }
    if (/^#{3} (.+)/.test(line)) { closeList(); out.push(`<h3>${inlineMarkdown(line.replace(/^### /, ""))}</h3>`); continue; }
    if (/^#{4} (.+)/.test(line)) { closeList(); out.push(`<h4>${inlineMarkdown(line.replace(/^#### /, ""))}</h4>`); continue; }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) { closeList(); out.push("<hr>"); continue; }

    const bulletMatch = line.match(/^(\s*)[-*+] (.+)/);
    if (bulletMatch) {
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inlineMarkdown(bulletMatch[2])}</li>`);
      continue;
    }

    const numMatch = line.match(/^(\s*)\d+\. (.+)/);
    if (numMatch) {
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inlineMarkdown(numMatch[2])}</li>`);
      continue;
    }

    if (line.trim() === "") { closeList(); out.push(""); continue; }

    closeList();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return out.join("\n");
}

function buildHtml(options: ExportOptions): string {
  const sectionsHtml = options.sections
    .filter((s) => s.content.trim())
    .map((s) => {
      const body = s.isMarkdown !== false && /[#*`]/.test(s.content)
        ? markdownToHtml(s.content)
        : `<p style="white-space:pre-wrap;">${s.content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>`;
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

export function exportAsPdf(options: Omit<ExportOptions, "format">) {
  const html = buildHtml({ ...options, format: "pdf" });
  const win = window.open("", "_blank");
  if (!win) { alert("Permita pop-ups para exportar o PDF."); return; }
  win.document.write(html);
  win.document.close();
}

export function exportAsDocx(options: Omit<ExportOptions, "format">) {
  const html = buildHtml({ ...options, format: "docx" });
  const blob = new Blob(
    [`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><title>${options.documentTitle}</title></head><body>${html}</body></html>`],
    { type: "application/msword" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${options.documentTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportChecklist(
  tipo: string,
  items: { id: string; text: string; required: boolean; category: string }[],
  checked: Set<string>
) {
  const tipoLabel = tipo === "bens" ? "Aquisição de Bens" : tipo === "servicos" ? "Prestação de Serviços" : "Obras e Engenharia";
  const categories = [...new Set(items.map((i) => i.category))];
  const sections = categories.map((cat) => ({
    title: cat,
    isMarkdown: false,
    content: items
      .filter((i) => i.category === cat)
      .map((item, idx) => `${checked.has(item.id ?? String(idx)) ? "✅" : "⬜"} ${item.text}${item.required ? " (Obrigatório)" : ""}`)
      .join("\n"),
  }));
  exportAsPdf({ documentTitle: `Checklist — ${tipoLabel}`, legalBasis: "Lei 14.133/2021", sections });
}

export function exportValidatorReport(
  findings: { severity: string; title: string; description: string; article: string }[]
) {
  const grouped = {
    alta: findings.filter((f) => f.severity === "alta"),
    media: findings.filter((f) => f.severity === "media"),
    baixa: findings.filter((f) => f.severity === "baixa"),
  };
  exportAsPdf({
    documentTitle: "Relatório de Validação de Edital",
    legalBasis: "Lei 14.133/2021",
    sections: [
      { title: "Resumo", isMarkdown: false, content: `Total de achados: ${findings.length}\nRisco Alto: ${grouped.alta.length}\nRisco Médio: ${grouped.media.length}\nRisco Baixo: ${grouped.baixa.length}` },
      ...findings.map((f) => ({ title: `[${f.severity.toUpperCase()}] ${f.title}`, isMarkdown: false, content: `${f.description}\nFundamento: ${f.article}` })),
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
      { title: "Itens da Proposta", isMarkdown: false, content: items.filter((i) => i.descricao).map((i) => `${i.descricao} — Qtd: ${i.quantidade} × ${fmt(i.valorUnitario)} = ${fmt(i.quantidade * i.valorUnitario)}`).join("\n") },
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
      { title: "Alertas", isMarkdown: false, content: result.alertas.map((a) => `⚠ ${a}`).join("\n") },
      { title: "Recomendações", isMarkdown: false, content: result.recomendacoes.map((r) => `✓ ${r}`).join("\n") },
    ],
  });
}
