import { Brand } from "@/components/Brand";

/** Marco de las páginas de cuenta que se ven sin sesión, igual al del login. */
export function PaginaPublica({ titulo, bajada, children, ancho = 420 }: { titulo: string; bajada?: React.ReactNode; children: React.ReactNode; ancho?: number }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full" style={{ maxWidth: ancho }}>
        <Brand size="lg" />
        <h1 className="mt-7 text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">{titulo}</h1>
        {bajada && <p className="hint mt-3">{bajada}</p>}
        <div className="panel mt-6">{children}</div>
      </div>
    </main>
  );
}
