import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'fs'

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT ?? './leonorejoaomaria-firebase-adminsdk-fbsvc-a1cfc5dbf2.json'
const ADMIN_UID = 'zsUan7zY2DaT00zbDMzzkPj0Ujs2'

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
initializeApp({ credential: cert(serviceAccount) })

await getAuth().setCustomUserClaims(ADMIN_UID, { admin: true })
console.log(`✅  Custom claim { admin: true } set on UID ${ADMIN_UID}`)
