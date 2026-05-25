import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const SERVICE_ACCOUNT_PATH = './leonorejoaomaria-firebase-adminsdk-fbsvc-a1cfc5dbf2.json'
initializeApp({ credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))) })
const db = getFirestore()

const snap = await db.collection('site_content').get()
for (const doc of snap.docs) {
  const { value } = doc.data()
  if (value && value.length > 0) {
    console.log(`${doc.id}: ${value.slice(0, 80)}`)
  }
}
