import { SOLUTION_FOCI } from "@/lib/gimi";
import { leerJson } from "@/lib/organizaciones";
import { Bloque, Campo } from "@/components/v2/ui";

export type ValoresReto = {
  challengeText?: string;
  problema?: string;
  porQueMotivante?: string;
  meta?: string;
  solutionFoci?: string;
  queHacer?: string;
  queEvitar?: string;
  restricciones?: string;
};

const lineas = (raw?: string) => leerJson<string[]>(raw, []).join("\n");

/** Campos del reto (ejercicio 2.1.3 «Diseñe el alcance del desafío», CG.pdf). */
export function CamposReto({ v }: { v: ValoresReto }) {
  const foci = leerJson<string[]>(v.solutionFoci, []);
  return (
    <>
      <Bloque titulo="El problema y por qué motiva">
        <Campo
          name="challengeText"
          label="Enunciado del reto"
          help="Una frase. Si la organización lo entregó, va literal."
          defaultValue={v.challengeText}
          rows={2}
        />
        <Campo name="problema" label="¿Qué problema se busca resolver?" defaultValue={v.problema} rows={4} required />
        <Campo name="porQueMotivante" label="¿Por qué es motivante?" defaultValue={v.porQueMotivante} rows={3} />
      </Bloque>

      <Bloque titulo="¿A qué se refieren las soluciones?" porQue="Marquen todas las que apliquen.">
        <div className="grid gap-2 sm:grid-cols-2">
          {SOLUTION_FOCI.map((f) => (
            <label key={f.key} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
              <input type="checkbox" name="solutionFoci" value={f.key} defaultChecked={foci.includes(f.key)} className="mt-0.5 accent-[#6FBFB2]" />
              {f.label}
            </label>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="La meta" porQue="Con cifra y fecha.">
        <Campo name="meta" label="¿Cuál es la meta?" defaultValue={v.meta} rows={3} required />
      </Bloque>

      <Bloque titulo="Límites del reto">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo name="queHacer" label="Qué hacer" help="Una por línea." defaultValue={lineas(v.queHacer)} rows={4} />
          <Campo name="queEvitar" label="Qué evitar" help="Una por línea." defaultValue={lineas(v.queEvitar)} rows={4} />
        </div>
        <Campo name="restricciones" label="Restricciones duras" help="Económicas, legales o técnicas." defaultValue={v.restricciones} rows={2} />
      </Bloque>
    </>
  );
}
