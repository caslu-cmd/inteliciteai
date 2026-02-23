import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";

export default function PlaceholderPage() {
  const location = useLocation();
  const name = location.pathname.split("/").pop() || "Página";
  const title = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 mb-6">
        <Construction className="h-8 w-8 text-accent" />
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground max-w-md">
        Este módulo está em desenvolvimento. Em breve você poderá utilizá-lo aqui.
      </p>
    </div>
  );
}
