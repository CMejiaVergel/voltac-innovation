"use client";

/**
 * Ultimo recurso: un fallo en el layout raiz, donde `(app)/error.tsx` ya no
 * alcanza a renderizar. Cubre tambien las paginas de fuera de la aplicacion,
 * como el login. Tiene que traer su propio <html> y <body>.
 *
 * No usa las clases del tema porque el fallo puede ser justamente que la hoja
 * de estilos no cargo: los estilos van en linea a proposito.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#12181B",
          color: "#e8e3d8",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "56ch" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#6FBFB2",
              margin: "0 0 8px",
            }}
          >
            Error
          </p>
          <h1 style={{ fontSize: 24, margin: "0 0 14px", lineHeight: 1.2 }}>
            La aplicacion no pudo cargar
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#93a09e", margin: "0 0 14px" }}>
            Si estabas guardando algo, comprueba si se guardo antes de repetirlo.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10.5,
                color: "#5e7370",
                margin: "0 0 18px",
              }}
            >
              Referencia para los registros del servidor: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#6FBFB2",
              color: "#12181B",
              border: 0,
              borderRadius: 4,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
