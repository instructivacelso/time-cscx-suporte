'use client';

/**
 * Último recurso: erro que acontece no próprio layout raiz.
 * Precisa trazer <html> e <body> próprios e não pode depender do CSS do app.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          background: '#f7f6f4',
          color: '#231f1d',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Algo deu errado por aqui</h1>
          <p style={{ fontSize: 14, color: '#6b6660', lineHeight: 1.6, margin: '0 0 20px' }}>
            O CSCX não conseguiu carregar esta página. Tente novamente em instantes.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#e85806',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Tentar de novo
          </button>
          {error?.digest && (
            <p style={{ fontSize: 11, color: '#9b958c', marginTop: 20 }}>
              Código do erro: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
