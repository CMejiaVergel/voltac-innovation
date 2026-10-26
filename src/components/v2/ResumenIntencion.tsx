/**
 * La intención de innovar en las tres frases del IMBOK (pp. 29, 31 y 32). Es lo
 * que el equipo debe poder decir de memoria y la vara con que se mide el Fit.
 */
export function ResumenIntencion({ frases }: { frases: { razon: string; brecha: string; perfil: string } }) {
  const lista = [frases.razon, frases.brecha, frases.perfil].filter(Boolean);
  if (!lista.length) return null;
  return (
    <section className="mb-6 rounded-[4px] border border-[rgba(111,191,178,0.4)] bg-[rgba(111,191,178,0.07)] px-5 py-4">
      <h2 className="kicker mb-2">Intención de innovar</h2>
      <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-[#e8e3d8]">
        {lista.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </section>
  );
}
