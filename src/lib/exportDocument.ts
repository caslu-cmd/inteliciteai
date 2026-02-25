/**
 * Utility to export document content as PDF (via print) or DOCX (via Blob).
 */

interface ExportSection {
  title: string;
  content: string;
}

interface ExportOptions {
  documentTitle: string;
  orgao?: string;
  legalBasis?: string;
  sections: ExportSection[];
  format: "pdf" | "docx";
}

function buildHtml(options: ExportOptions): string {
  const sectionsHtml = options.sections
    .filter((s) => s.content.trim())
    .map(
      (s, i) => `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:13px;color:#555;text-transform:uppercase;margin-bottom:4px;">${i + 1}. ${s.title}</h3>
        <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${s.content}</p>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${options.documentTitle}</title>
<style>
  @media print { body { margin: 20mm; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { text-align: center; border-bottom: 2px solid #c9a84c; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 18px; margin: 0; }
  .header p { font-size: 12px; color: #666; margin: 4px 0 0; }
  .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #999; text-align: center; }
</style>
</head><body>
  <div class="header">
    <h1>${options.documentTitle}</h1>
    ${options.orgao ? `<p>${options.orgao}</p>` : ""}
    ${options.legalBasis ? `<p>${options.legalBasis}</p>` : ""}
  </div>
  ${sectionsHtml}
  <div class="footer">
    Documento gerado por InteliCite AI — ${new Date().toLocaleDateString("pt-BR")}
  </div>
</body></html>`;
}

export function exportAsPdf(options: Omit<ExportOptions, "format">) {
  const html = buildHtml({ ...options, format: "pdf" });
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 400);
}

export function exportAsDocx(options: Omit<ExportOptions, "format">) {
  const html = buildHtml({ ...options, format: "docx" });
  const blob = new Blob(
    [
      `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>${options.documentTitle}</title></head><body>${html}</body></html>`,
    ],
    { type: "application/msword" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${options.documentTitle.replace(/\s+/g, "_")}.doc`;
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
    content: items
      .filter((i) => i.category === cat)
      .map((item, idx) => {
        const isChecked = checked.has(item.id ?? String(idx));
        return `${isChecked ? "✅" : "⬜"} ${item.text}${item.required ? " (Obrigatório)" : ""}`;
      })
      .join("\n"),
  }));

  exportAsPdf({
    documentTitle: `Checklist - ${tipoLabel}`,
    legalBasis: "Lei 14.133/2021",
    sections,
  });
}

export function exportValidatorReport(
  findings: { severity: string; title: string; description: string; article: string }[]
) {
  const grouped = {
    alta: findings.filter((f) => f.severity === "alta"),
    media: findings.filter((f) => f.severity === "media"),
    baixa: findings.filter((f) => f.severity === "baixa"),
  };

  const sections = [
    {
      title: "Resumo",
      content: `Total de achados: ${findings.length}\nRisco Alto: ${grouped.alta.length}\nRisco Médio: ${grouped.media.length}\nRisco Baixo: ${grouped.baixa.length}`,
    },
    ...findings.map((f) => ({
      title: `[${f.severity.toUpperCase()}] ${f.title}`,
      content: `${f.description}\nFundamento: ${f.article}`,
    })),
  ];

  exportAsPdf({
    documentTitle: "Relatório de Validação de Edital",
    legalBasis: "Lei 14.133/2021",
    sections,
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
  
  const sections = [
    {
      title: "Itens da Proposta",
      content: items
        .filter((i) => i.descricao)
        .map((i) => `${i.descricao} — Qtd: ${i.quantidade} × ${fmt(i.valorUnitario)} = ${fmt(i.quantidade * i.valorUnitario)}`)
        .join("\n"),
    },
    {
      title: "Resumo Financeiro",
      content: `Subtotal: ${fmt(subtotal)}\nMargem (${margem}%): ${fmt(subtotal * (parseFloat(margem) / 100))}\nImpostos (${impostos}%): ${fmt((subtotal + subtotal * (parseFloat(margem) / 100)) * (parseFloat(impostos) / 100))}\n\nTOTAL: ${fmt(total)}`,
    },
  ];

  exportAsPdf({
    documentTitle: "Proposta Comercial",
    sections,
  });
}

export function exportDiagnostic(result: {
  modalidade: string;
  fundamento: string;
  descricao: string;
  alertas: string[];
  recomendacoes: string[];
}) {
  exportAsPdf({
    documentTitle: "Diagnóstico de Licitação",
    legalBasis: "Lei 14.133/2021",
    sections: [
      { title: "Modalidade Recomendada", content: `${result.modalidade}\n${result.fundamento}\n\n${result.descricao}` },
      { title: "Alertas", content: result.alertas.map((a) => `⚠ ${a}`).join("\n") },
      { title: "Recomendações", content: result.recomendacoes.map((r) => `✓ ${r}`).join("\n") },
    ],
  });
}
