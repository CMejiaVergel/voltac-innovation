import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProject } from "@/app/actions/projects";

export const metadata = { title: "Nuevo proyecto — Voltac Innovacion" };

export default async function NewProjectPage() {
  await requireUser();
  const templates = await prisma.mapTemplate.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="max-w-[720px] pt-8">
      <p className="kicker mb-2">Etapa 1 · Configurar</p>
      <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">
        Nuevo proyecto
      </h1>
      <p className="hint mt-3">
        Lo minimo para arrancar. El brief completo — problema, meta, que hacer, que evitar —
        se llena en el siguiente paso, y es el insumo que recibe el agente investigador.
      </p>

      <form action={createProject} className="panel mt-7 flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="name">
            Nombre del proyecto
          </label>
          <input
            id="name"
            name="name"
            required
            className="field"
            placeholder="Reuso de agua de rechazo — Cabot Cartagena"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="company">
              Empresa dueña del reto
            </label>
            <input
              id="company"
              name="company"
              className="field"
              placeholder="Cabot Corporation — planta Cartagena"
            />
          </div>
          <div>
            <label className="label" htmlFor="program">
              Programa o convocatoria
            </label>
            <input
              id="program"
              name="program"
              className="field"
              placeholder="Caribe Innova 2026"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="challengeText">
            Reto textual entregado por la empresa
          </label>
          <textarea
            id="challengeText"
            name="challengeText"
            rows={3}
            className="field"
            placeholder="Copialo literal. No lo parafrasees: el agente lo cita tal cual."
          />
        </div>

        <div>
          <label className="label" htmlFor="templateKey">
            Plantilla del mapa
          </label>
          <select id="templateKey" name="templateKey" className="field" defaultValue="gimi-5x5">
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
          <ul className="mt-3 flex flex-col gap-2">
            {templates.map((t) => (
              <li key={t.key} className="hint">
                <b className="text-[#c0ccca]">{t.name}.</b> {t.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="btn btn-primary">
            Crear proyecto
          </button>
          <Link href="/proyectos" className="btn">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
