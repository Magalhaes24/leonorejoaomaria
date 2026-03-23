/*
Firestore schema (single source of truth, bilingual fields):

collection: site
  doc: restaurant
    name: { pt: string, en: string }
    tagline: { pt: string, en: string }
    heroTitle: { pt: string, en: string }
    heroSubtitle: { pt: string, en: string }
    heroCta: { pt: string, en: string }
    story: { pt: string, en: string }
    chefNote: { pt: string, en: string }
    values: Array<{ pt: string, en: string }>
    atmosphere: { pt: string, en: string }
    address: { pt: string, en: string }
    phone: string
    email: string
    mapEmbedUrl: string
    social: { instagram?: string, facebook?: string }

collection: hours
  doc: default
    entries: Array<{
      label: { pt: string, en: string },
      open: string,
      close: string
    }>
    note: { pt: string, en: string }

collection: highlights
  doc: auto
    title: { pt: string, en: string }
    description: { pt: string, en: string }
    price: string
    image: string

collection: testimonials
  doc: auto
    name: string
    role: { pt: string, en: string }
    quote: { pt: string, en: string }

collection: menuCategories
  doc: auto
    name: { pt: string, en: string }
    order: number
    items: Array<{
      name: { pt: string, en: string },
      description: { pt: string, en: string },
      price: string,
      tags: Array<{ pt: string, en: string }>
    }>

collection: contactRequests
  doc: auto
    name: string
    email: string
    message: string
    language: "pt" | "en"
    createdAt: timestamp

collection: reservations
  doc: auto
    name: string
    email: string
    phone: string
    date: string
    time: string
    guests: number
    notes: string
    status: "pending" | "confirmed" | "cancelled"
    language: "pt" | "en"
    createdAt: timestamp
*/
