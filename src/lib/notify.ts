// Notificação por email ao admin via Web3Forms.
//
// Setup (uma vez):
//   1. Vai a https://web3forms.com e regista a access key com o email do admin.
//   2. Define VITE_WEB3FORMS_KEY no .env.local (dev) e nos GitHub Secrets (deploy).
//
// A chave é segura para o frontend: o Web3Forms só entrega ao email registado para
// essa chave, por isso não pode ser usada para enviar para outros destinatários.
const WEB3FORMS_ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined

type Field = string | number | undefined | null

/**
 * Envia um email de notificação ao admin. Nunca lança: falhas são silenciadas
 * para que uma notificação falhada nunca bloqueie a submissão do convidado.
 */
export async function notifyAdmin(subject: string, fields: Record<string, Field>): Promise<void> {
  if (!WEB3FORMS_ACCESS_KEY) return

  const message = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject,
        from_name: 'Site Leonor & João Maria',
        message,
      }),
    })
  } catch {
    // Silenciado de propósito — ver doc acima.
  }
}
