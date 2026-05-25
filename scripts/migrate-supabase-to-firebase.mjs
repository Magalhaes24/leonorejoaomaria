/**
 * Migration script: Supabase → Firebase Firestore
 *
 * Usage:
 *   node scripts/migrate-supabase-to-firebase.mjs
 *
 * Requires:
 *   npm install @supabase/supabase-js firebase-admin
 *
 * Set the FIREBASE_SERVICE_ACCOUNT env var (or edit the path below) to point
 * to your Firebase service-account JSON file. Download it from:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

import { createClient } from '@supabase/supabase-js'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

// ── Supabase config ────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ozrnwqvvhtqtwtaiymow.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_rwYPE2_hbM5h0KCu7J6Uxw_pR48PjhQ'

// ── Firebase Admin config ──────────────────────────────────────────────────
// Option 1: set FIREBASE_SERVICE_ACCOUNT env var to path of service account JSON
// Option 2: paste path here directly
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT ?? './firebase-service-account.json'

// ──────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
} catch {
  console.error(`\n❌  Could not read service account file: ${SERVICE_ACCOUNT_PATH}`)
  console.error('   Download it from Firebase Console → Project Settings → Service Accounts')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function fetchTable(table) {
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw new Error(`Supabase error fetching ${table}: ${error.message}`)
  return data ?? []
}

async function writeCollection(collectionName, rows, idField = 'id') {
  const col = db.collection(collectionName)
  let count = 0
  for (const row of rows) {
    const { [idField]: rowId, ...rest } = row
    // Convert Supabase timestamps to Firestore Timestamps
    for (const key of Object.keys(rest)) {
      if (typeof rest[key] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(rest[key])) {
        rest[key] = new Date(rest[key])
      }
    }
    await col.doc(rowId).set(rest, { merge: true })
    count++
  }
  return count
}

async function writeSiteContent(rows) {
  const col = db.collection('site_content')
  let count = 0
  for (const row of rows) {
    const { key, ...rest } = row
    if (rest.updated_at && typeof rest.updated_at === 'string') {
      rest.updated_at = new Date(rest.updated_at)
    }
    await col.doc(key).set(rest, { merge: true })
    count++
  }
  return count
}

async function main() {
  console.log('🚀  Starting Supabase → Firestore migration…\n')

  // site_content
  try {
    const rows = await fetchTable('site_content')
    const n = await writeSiteContent(rows)
    console.log(`✅  site_content: ${n} documents`)
  } catch (e) {
    console.error(`❌  site_content: ${e.message}`)
  }

  // gifts
  try {
    const rows = await fetchTable('gifts')
    const n = await writeCollection('gifts', rows)
    console.log(`✅  gifts: ${n} documents`)
  } catch (e) {
    console.error(`❌  gifts: ${e.message}`)
  }

  // gift_contributions
  try {
    const rows = await fetchTable('gift_contributions')
    const n = await writeCollection('gift_contributions', rows)
    console.log(`✅  gift_contributions: ${n} documents`)
  } catch (e) {
    console.error(`❌  gift_contributions: ${e.message}`)
  }

  // honeymoon_contributions
  try {
    const rows = await fetchTable('honeymoon_contributions')
    const n = await writeCollection('honeymoon_contributions', rows)
    console.log(`✅  honeymoon_contributions: ${n} documents`)
  } catch (e) {
    console.error(`❌  honeymoon_contributions: ${e.message}`)
  }

  // alergias
  try {
    const rows = await fetchTable('alergias')
    const n = await writeCollection('alergias', rows)
    console.log(`✅  alergias: ${n} documents`)
  } catch (e) {
    console.error(`❌  alergias: ${e.message}`)
  }

  // boleias
  try {
    const rows = await fetchTable('boleias')
    const n = await writeCollection('boleias', rows)
    console.log(`✅  boleias: ${n} documents`)
  } catch (e) {
    console.error(`❌  boleias: ${e.message}`)
  }

  console.log('\n✅  Migration complete!')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
