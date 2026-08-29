import Image from "next/image";

/**
 * Marca de la aplicacion.
 *
 * El logo se presenta como isotipo sobre una pastilla clara, no como el
 * lockup completo: en el logo original la palabra "VOLT" es azul marino y
 * sobre el fondo oscuro de la aplicacion desapareceria. La pastilla le
 * devuelve al isotipo el fondo claro para el que fue diseñado, y el nombre se
 * compone con la tipografia de la interfaz respetando la jerarquia de colores
 * del original: azul para VOLTAC, verde azulado para INNOVATION.
 */
export function Brand({
  size = "sm",
  showWordmark = true,
}: {
  size?: "sm" | "lg";
  showWordmark?: boolean;
}) {
  const chip = size === "lg" ? 56 : 30;
  const pad = size === "lg" ? 10 : 5;

  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex shrink-0 items-center justify-center rounded-[7px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
        style={{ width: chip, height: chip, padding: pad }}
      >
        <Image
          src="/brand/isotipo.png"
          alt="Voltac"
          width={562}
          height={346}
          priority
          className="h-auto w-full"
        />
      </span>

      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-bold tracking-[-0.02em] text-[#e8e3d8] ${
              size === "lg" ? "text-[22px]" : "text-[15px]"
            }`}
          >
            VOLTAC
          </span>
          <span
            className={`font-mono uppercase tracking-[0.22em] text-accent ${
              size === "lg" ? "mt-1.5 text-[10px]" : "mt-1 text-[7.5px]"
            }`}
          >
            Innovation
          </span>
        </span>
      )}
    </span>
  );
}
