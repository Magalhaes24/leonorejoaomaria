import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyBy-L2t-rpItN_UFT9T2MxwYcZjXgELzHo',
  authDomain: 'leonorejoaomaria.firebaseapp.com',
  projectId: 'leonorejoaomaria',
  storageBucket: 'leonorejoaomaria.firebasestorage.app',
  messagingSenderId: '1062503720915',
  appId: '1:1062503720915:web:6fd57557919e94b6ae3126',
  measurementId: 'G-53H0RLPVB2',
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
