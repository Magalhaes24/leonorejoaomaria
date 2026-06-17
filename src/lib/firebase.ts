import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

// As chaves vêm de variáveis de ambiente (.env.local em dev, GitHub Secrets em CI).
// Nota: a config web do Firebase é, por design, pública — acaba sempre no bundle.
// A segurança real vem das Firestore Security Rules, não de esconder estas chaves.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string,
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

export interface Gift {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string | null
  created_at: string
}

export interface GiftContribution {
  id?: string
  gift_id: string
  contributor_name: string
  amount: number
  created_at?: string
}

export interface HoneymoonContribution {
  id?: string
  contributor_name: string
  message?: string
  amount: number
  created_at?: string
}

export interface Boleia {
  id?: string
  nome: string
  telefone?: string | null
  lugares: number
  sentido: string
  notas?: string | null
  created_at?: string
}

export interface Alergia {
  id?: string
  nome: string
  restricoes: string[]
  notas?: string | null
  created_at?: string
}

export interface Presenca {
  id?: string
  nome: string
  presenca: 'tudo' | 'missa' | 'festa' | 'nao'
  created_at?: string
}
