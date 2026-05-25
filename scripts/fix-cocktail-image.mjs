import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const SERVICE_ACCOUNT_PATH = './leonorejoaomaria-firebase-adminsdk-fbsvc-a1cfc5dbf2.json'
initializeApp({ credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))) })
const db = getFirestore()

await db.collection('site_content').doc('home.venue.cocktail.image').update({ value: '' })
console.log('✅  Cleared home.venue.cocktail.image — will now use the bundled default image')
