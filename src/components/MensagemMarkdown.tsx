import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// Resposta da IA em markdown. O projeto não tem o plugin de tipografia do
// Tailwind (as classes "prose" não existem), então o estilo de títulos, listas
// e negrito é declarado aqui, direto nos filhos.
export function MensagemMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:my-2 [&_strong]:font-semibold",
        "[&_h1]:font-semibold [&_h1]:text-base [&_h1]:mt-4 [&_h1]:mb-1.5",
        "[&_h2]:font-semibold [&_h2]:text-[15px] [&_h2]:mt-4 [&_h2]:mb-1.5",
        "[&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5",
        "[&_a]:underline [&_a]:underline-offset-2 [&_hr]:my-3 [&_hr]:border-border",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1",
        className,
      )}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
