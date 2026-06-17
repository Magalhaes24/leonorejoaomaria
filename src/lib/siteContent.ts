import { db } from './firebase'
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore'

// All editable content keys
export const CONTENT_KEYS = {
  // Navbar
  NAVBAR_BRAND: 'navbar.brand',

  // Home – Hero
  HOME_HERO_TAG: 'home.hero.tag',
  HOME_HERO_COUPLE_NAME: 'home.hero.couple_name',
  HOME_HERO_PHOTO_1: 'home.hero.photo_1',
  HOME_HERO_PHOTO_2: 'home.hero.photo_2',
  HOME_HERO_PHOTO_3: 'home.hero.photo_3',
  HOME_HERO_LOCATION_CHURCH: 'home.hero.location_church',
  HOME_HERO_LOCATION_COCKTAIL: 'home.hero.location_cocktail',

  // Home – Ceremony Venue
  HOME_VENUE_CEREMONY_NAME: 'home.venue.ceremony.name',
  HOME_VENUE_CEREMONY_ADDRESS: 'home.venue.ceremony.address',
  HOME_VENUE_CEREMONY_TIME: 'home.venue.ceremony.time',
  HOME_VENUE_CEREMONY_IMAGE: 'home.venue.ceremony.image',
  HOME_VENUE_CEREMONY_GMAPS: 'home.venue.ceremony.gmaps',
  HOME_VENUE_CEREMONY_APPLE: 'home.venue.ceremony.apple',
  HOME_VENUE_CEREMONY_WAZE: 'home.venue.ceremony.waze',

  // Home – Cocktail Venue
  HOME_VENUE_COCKTAIL_NAME: 'home.venue.cocktail.name',
  HOME_VENUE_COCKTAIL_ADDRESS: 'home.venue.cocktail.address',
  HOME_VENUE_COCKTAIL_TIME: 'home.venue.cocktail.time',
  HOME_VENUE_COCKTAIL_IMAGE: 'home.venue.cocktail.image',
  HOME_VENUE_COCKTAIL_GMAPS: 'home.venue.cocktail.gmaps',
  HOME_VENUE_COCKTAIL_APPLE: 'home.venue.cocktail.apple',
  HOME_VENUE_COCKTAIL_WAZE: 'home.venue.cocktail.waze',

  // Home – Hero labels
  HOME_HERO_CHURCH_LABEL: 'home.hero.church_label',
  HOME_HERO_COCKTAIL_LABEL: 'home.hero.cocktail_label',

  // Home – Countdown
  HOME_COUNTDOWN_TITLE: 'home.countdown.title',
  HOME_COUNTDOWN_DAYS: 'home.countdown.days',
  HOME_COUNTDOWN_HOURS: 'home.countdown.hours',
  HOME_COUNTDOWN_MINUTES: 'home.countdown.minutes',
  HOME_COUNTDOWN_SECONDS: 'home.countdown.seconds',

  // Home – List Section
  HOME_LIST_TAG: 'home.list.tag',
  HOME_LIST_TITLE: 'home.list.title',
  HOME_LIST_DESCRIPTION: 'home.list.description',
  HOME_LIST_IMAGE: 'home.list.image',
  HOME_LIST_CTA: 'home.list.cta',

  // Home – Boleias modal
  HOME_BOLEIAS_INTRO_TAG: 'home.boleias.intro_tag',
  HOME_BOLEIAS_TITLE: 'home.boleias.title',
  HOME_BOLEIAS_DESCRIPTION: 'home.boleias.description',
  HOME_BOLEIAS_NAME_LABEL: 'home.boleias.name_label',
  HOME_BOLEIAS_PHONE_LABEL: 'home.boleias.phone_label',
  HOME_BOLEIAS_SEATS_LABEL: 'home.boleias.seats_label',
  HOME_BOLEIAS_WHEN_LABEL: 'home.boleias.when_label',
  HOME_BOLEIAS_NOTES_LABEL: 'home.boleias.notes_label',
  HOME_BOLEIAS_SUCCESS_TITLE: 'home.boleias.success_title',
  HOME_BOLEIAS_SUCCESS_MESSAGE: 'home.boleias.success_message',

  // Home – Alergias modal
  HOME_ALLERGIES_MODAL_INTRO_TAG: 'home.allergies_modal.intro_tag',
  HOME_ALLERGIES_MODAL_TITLE: 'home.allergies_modal.title',
  HOME_ALLERGIES_MODAL_DESCRIPTION: 'home.allergies_modal.description',
  HOME_ALLERGIES_MODAL_NAME_LABEL: 'home.allergies_modal.name_label',
  HOME_ALLERGIES_MODAL_RESTRICTIONS_LABEL: 'home.allergies_modal.restrictions_label',
  HOME_ALLERGIES_MODAL_OTHER_LABEL: 'home.allergies_modal.other_label',
  HOME_ALLERGIES_MODAL_NOTES_LABEL: 'home.allergies_modal.notes_label',
  HOME_ALLERGIES_MODAL_SUCCESS_TITLE: 'home.allergies_modal.success_title',
  HOME_ALLERGIES_MODAL_SUCCESS_MESSAGE: 'home.allergies_modal.success_message',

  // Home – Transport
  HOME_TRANSPORT_TAG: 'home.transport.tag',
  HOME_TRANSPORT_TITLE: 'home.transport.title',
  HOME_TRANSPORT_DESCRIPTION: 'home.transport.description',
  HOME_TRANSPORT_CTA: 'home.transport.cta',

  // Home – Allergies
  HOME_ALLERGIES_TAG: 'home.allergies.tag',
  HOME_ALLERGIES_TITLE: 'home.allergies.title',
  HOME_ALLERGIES_DESCRIPTION: 'home.allergies.description',
  HOME_ALLERGIES_CTA: 'home.allergies.cta',

  // Home – Presença
  HOME_PRESENCA_TAG: 'home.presenca.tag',
  HOME_PRESENCA_TITLE: 'home.presenca.title',
  HOME_PRESENCA_DESCRIPTION: 'home.presenca.description',
  HOME_PRESENCA_CTA: 'home.presenca.cta',
  HOME_PRESENCA_IMAGE: 'home.presenca.image',
  HOME_PRESENCA_MODAL_TAG: 'home.presenca_modal.tag',
  HOME_PRESENCA_MODAL_TITLE: 'home.presenca_modal.title',
  HOME_PRESENCA_MODAL_NAME_LABEL: 'home.presenca_modal.name_label',
  HOME_PRESENCA_MODAL_NAME_PLACEHOLDER: 'home.presenca_modal.name_placeholder',
  HOME_PRESENCA_MODAL_PRESENCA_LABEL: 'home.presenca_modal.presenca_label',
  HOME_PRESENCA_MODAL_CANCEL: 'home.presenca_modal.cancel',
  HOME_PRESENCA_MODAL_SUBMIT: 'home.presenca_modal.submit',
  HOME_PRESENCA_MODAL_LOADING: 'home.presenca_modal.loading',
  HOME_PRESENCA_MODAL_SUCCESS_TITLE: 'home.presenca_modal.success_title',
  HOME_PRESENCA_MODAL_SUCCESS_MESSAGE: 'home.presenca_modal.success_message',

  // Home – Venue action buttons
  HOME_VENUE_ACTIONS_GMAPS: 'home.venue_actions.google_maps',
  HOME_VENUE_ACTIONS_APPLE: 'home.venue_actions.apple_maps',
  HOME_VENUE_ACTIONS_WAZE: 'home.venue_actions.waze',

  // Home – Footer
  HOME_FOOTER_DATE: 'home.footer.date',

  // Layout order
  LAYOUT_HOME_ORDER: 'layout.home_order',
  LAYOUT_LISTA_ORDER: 'layout.lista_order',

  // Venue layout orientation
  HOME_VENUE_CEREMONY_REVERSE: 'home.venue.ceremony.reverse_layout',
  HOME_VENUE_COCKTAIL_REVERSE: 'home.venue.cocktail.reverse_layout',

  // List section layout (image side)
  HOME_LIST_REVERSE: 'home.list.reverse_layout',

  // Lista – Hero
  LISTA_HERO_TITLE: 'lista.hero.title',
  LISTA_HERO_SUBTITLE: 'lista.hero.subtitle',
  LISTA_HERO_IMAGE: 'lista.hero.image',

  // Lista – Payment
  LISTA_PAYMENT_CONTACT1_LABEL: 'lista.payment.contact1.label',
  LISTA_PAYMENT_CONTACT1_NUMBER: 'lista.payment.contact1.number',
  LISTA_PAYMENT_CONTACT2_LABEL: 'lista.payment.contact2.label',
  LISTA_PAYMENT_CONTACT2_NUMBER: 'lista.payment.contact2.number',
  LISTA_PAYMENT_REVOLUT: 'lista.payment.revolut',

  // Lista – Gifts
  LISTA_GIFT_CONTRIBUTE: 'lista.gift.contribute',
  LISTA_GIFT_FULL: 'lista.gift.full',
  LISTA_TOGGLE_SHOW_MORE: 'lista.toggle.show_more',
  LISTA_TOGGLE_SHOW_LESS: 'lista.toggle.show_less',

  // Lista – Payment extras
  LISTA_PAYMENT_IBAN: 'lista.payment.iban',
  LISTA_PAYMENT_OPEN_LABEL: 'lista.payment.open_label',

  // Lista – Honeymoon
  LISTA_HONEYMOON_TAG: 'lista.honeymoon.tag',
  LISTA_HONEYMOON_TITLE: 'lista.honeymoon.title',
  LISTA_HONEYMOON_IMAGE: 'lista.honeymoon.image',
  LISTA_HONEYMOON_SUCCESS_TITLE: 'lista.honeymoon.success_title',
  LISTA_HONEYMOON_SUCCESS_MESSAGE: 'lista.honeymoon.success_message',
  LISTA_HONEYMOON_AMOUNT_LABEL: 'lista.honeymoon.amount_label',
  LISTA_HONEYMOON_AMOUNT_PLACEHOLDER: 'lista.honeymoon.amount_placeholder',
  LISTA_HONEYMOON_NAME_LABEL: 'lista.honeymoon.name_label',
  LISTA_HONEYMOON_NAME_PLACEHOLDER: 'lista.honeymoon.name_placeholder',
  LISTA_HONEYMOON_MESSAGE_LABEL: 'lista.honeymoon.message_label',
  LISTA_HONEYMOON_MESSAGE_PLACEHOLDER: 'lista.honeymoon.message_placeholder',
  LISTA_HONEYMOON_SUBMIT: 'lista.honeymoon.submit_label',
  LISTA_HONEYMOON_LOADING: 'lista.honeymoon.loading_label',
} as const

export type ContentKey = (typeof CONTENT_KEYS)[keyof typeof CONTENT_KEYS]

export type ContentType = 'text' | 'image' | 'url' | 'html'

export interface ContentDefault {
  value: string
  type: ContentType
  label: string
  section: string
}

// Default values — used as fallback when Supabase has no entry yet
export const CONTENT_DEFAULTS: Record<ContentKey, ContentDefault> = {
  'navbar.brand': { value: 'JLo.', type: 'text', label: 'Nome do site', section: 'Navbar' },

  'home.hero.tag': { value: '19 DE SETEMBRO DE 2026', type: 'text', label: 'Tag do hero', section: 'Hero' },
  'home.hero.couple_name': { value: 'Leonor e João Maria', type: 'text', label: 'Nome do casal', section: 'Hero' },
  'home.hero.photo_1': { value: '', type: 'image', label: 'Foto 1 (hero)', section: 'Hero' },
  'home.hero.photo_2': { value: '', type: 'image', label: 'Foto 2 (hero)', section: 'Hero' },
  'home.hero.photo_3': { value: '', type: 'image', label: 'Foto 3 (hero)', section: 'Hero' },
  'home.hero.location_church': { value: 'Igreja Matriz da Azambuja', type: 'text', label: 'Localização Igreja', section: 'Hero' },
  'home.hero.location_cocktail': { value: 'Herdade do Crescido', type: 'text', label: 'Localização Cocktail', section: 'Hero' },
  'home.hero.church_label': { value: 'Igreja', type: 'text', label: 'Tipo de cerimónia', section: 'Hero' },
  'home.hero.cocktail_label': { value: 'Cocktail', type: 'text', label: 'Tipo de cocktail', section: 'Hero' },

  'home.venue.ceremony.name': { value: 'Igreja Matriz da Azambuja', type: 'text', label: 'Nome da cerimónia', section: 'Cerimónia' },
  'home.venue.ceremony.address': { value: 'Largo da Igreja, 2050-326 Azambuja', type: 'text', label: 'Morada da cerimónia', section: 'Cerimónia' },
  'home.venue.ceremony.time': { value: '15h00', type: 'text', label: 'Hora da cerimónia', section: 'Cerimónia' },
  'home.venue.ceremony.image': { value: '', type: 'image', label: 'Imagem da cerimónia', section: 'Cerimónia' },
  'home.venue.ceremony.gmaps': { value: 'https://www.google.com/maps/dir/?api=1&destination=Igreja+Matriz+da+Azambuja,+2050-326+Azambuja,+Portugal', type: 'url', label: 'Google Maps (cerimónia)', section: 'Cerimónia' },
  'home.venue.ceremony.apple': { value: 'https://maps.apple.com/?daddr=Igreja+Matriz+da+Azambuja,+Azambuja,+Portugal', type: 'url', label: 'Apple Maps (cerimónia)', section: 'Cerimónia' },
  'home.venue.ceremony.waze': { value: 'https://waze.com/ul?q=Igreja+Matriz+da+Azambuja+Azambuja+Portugal&navigate=yes', type: 'url', label: 'Waze (cerimónia)', section: 'Cerimónia' },

  'home.venue.cocktail.name': { value: 'Herdade do Crescido', type: 'text', label: 'Nome do cocktail', section: 'Cocktail' },
  'home.venue.cocktail.address': { value: 'Herdade do Crescido, Valada do Ribatejo, 2070-512 Cartaxo', type: 'text', label: 'Morada do cocktail', section: 'Cocktail' },
  'home.venue.cocktail.time': { value: '17h30', type: 'text', label: 'Hora do cocktail', section: 'Cocktail' },
  'home.venue.cocktail.image': { value: '', type: 'image', label: 'Imagem do cocktail', section: 'Cocktail' },
  'home.venue.cocktail.gmaps': { value: 'https://www.google.com/maps/dir/?api=1&destination=Herdade+do+Crescido,+Valada+do+Ribatejo,+2070-512+Cartaxo,+Portugal', type: 'url', label: 'Google Maps (cocktail)', section: 'Cocktail' },
  'home.venue.cocktail.apple': { value: 'https://maps.apple.com/?daddr=Herdade+do+Crescido,+Valada+do+Ribatejo,+Cartaxo,+Portugal', type: 'url', label: 'Apple Maps (cocktail)', section: 'Cocktail' },
  'home.venue.cocktail.waze': { value: 'https://waze.com/ul?q=Herdade+do+Crescido+Valada+do+Ribatejo+Cartaxo+Portugal&navigate=yes', type: 'url', label: 'Waze (cocktail)', section: 'Cocktail' },

  'home.countdown.title': { value: 'Contagem decrescente', type: 'text', label: 'Título da contagem', section: 'Contagem' },
  'home.countdown.days': { value: 'Dias', type: 'text', label: 'Label "Dias"', section: 'Contagem' },
  'home.countdown.hours': { value: 'Horas', type: 'text', label: 'Label "Horas"', section: 'Contagem' },
  'home.countdown.minutes': { value: 'Minutos', type: 'text', label: 'Label "Minutos"', section: 'Contagem' },
  'home.countdown.seconds': { value: 'Segundos', type: 'text', label: 'Label "Segundos"', section: 'Contagem' },

  'home.list.tag': { value: 'Lista', type: 'text', label: 'Tag da secção Lista', section: 'Lista (teaser)' },
  'home.list.title': { value: 'Contribua para o nosso novo capítulo.', type: 'text', label: 'Título da lista', section: 'Lista (teaser)' },
  'home.list.description': { value: 'Se quiser contribuir para a nossa nova casa ou para a nossa lua de mel, preparámos uma pequena lista.', type: 'text', label: 'Descrição da lista', section: 'Lista (teaser)' },
  'home.list.image': { value: '', type: 'image', label: 'Imagem da lista', section: 'Lista (teaser)' },
  'home.list.cta': { value: 'Ver lista', type: 'text', label: 'CTA da lista', section: 'Lista (teaser)' },

  'home.boleias.intro_tag': { value: 'Transportes', type: 'text', label: 'Tag do modal boleias', section: 'Modal Boleias' },
  'home.boleias.title': { value: 'Oferece boleia?', type: 'text', label: 'Título do modal boleias', section: 'Modal Boleias' },
  'home.boleias.description': { value: 'Registe a sua disponibilidade para ajudar outros convidados.', type: 'text', label: 'Descrição do modal boleias', section: 'Modal Boleias' },
  'home.boleias.name_label': { value: 'O seu nome *', type: 'text', label: 'Label nome (boleias)', section: 'Modal Boleias' },
  'home.boleias.phone_label': { value: 'Telemóvel (opcional)', type: 'text', label: 'Label telemóvel (boleias)', section: 'Modal Boleias' },
  'home.boleias.seats_label': { value: 'Lugares disponíveis *', type: 'text', label: 'Label lugares (boleias)', section: 'Modal Boleias' },
  'home.boleias.when_label': { value: 'Para quando? *', type: 'text', label: 'Label quando (boleias)', section: 'Modal Boleias' },
  'home.boleias.notes_label': { value: 'Notas (opcional)', type: 'text', label: 'Label notas (boleias)', section: 'Modal Boleias' },
  'home.boleias.success_title': { value: 'Obrigado!', type: 'text', label: 'Título de sucesso (boleias)', section: 'Modal Boleias' },
  'home.boleias.success_message': { value: 'Registámos a disponibilidade.', type: 'text', label: 'Mensagem de sucesso (boleias)', section: 'Modal Boleias' },

  'home.allergies_modal.intro_tag': { value: 'Alergias e intolerâncias', type: 'text', label: 'Tag do modal alergias', section: 'Modal Alergias' },
  'home.allergies_modal.title': { value: 'Restrições alimentares', type: 'text', label: 'Título do modal alergias', section: 'Modal Alergias' },
  'home.allergies_modal.description': { value: 'Indique-nos se tem alguma alergia ou intolerância para que possamos preparar a ementa.', type: 'text', label: 'Descrição do modal alergias', section: 'Modal Alergias' },
  'home.allergies_modal.name_label': { value: 'O seu nome *', type: 'text', label: 'Label nome (alergias)', section: 'Modal Alergias' },
  'home.allergies_modal.restrictions_label': { value: 'Restrições *', type: 'text', label: 'Label restrições (alergias)', section: 'Modal Alergias' },
  'home.allergies_modal.other_label': { value: 'Outra restrição', type: 'text', label: 'Label outra restrição (alergias)', section: 'Modal Alergias' },
  'home.allergies_modal.notes_label': { value: 'Notas adicionais (opcional)', type: 'text', label: 'Label notas (alergias)', section: 'Modal Alergias' },
  'home.allergies_modal.success_title': { value: 'Obrigado!', type: 'text', label: 'Título de sucesso (alergias)', section: 'Modal Alergias' },
  'home.allergies_modal.success_message': { value: 'Registámos as restrições alimentares.', type: 'text', label: 'Mensagem de sucesso (alergias)', section: 'Modal Alergias' },

  'home.transport.tag': { value: 'Transportes', type: 'text', label: 'Tag de transportes', section: 'Transportes' },
  'home.transport.title': { value: 'Vem de carro?', type: 'text', label: 'Título dos transportes', section: 'Transportes' },
  'home.transport.description': { value: 'Se pode oferecer ou precisa de boleia para a cerimónia ou para o regresso, registe-se aqui. Vamos tentar ligar quem precisa de transporte a quem pode ajudar.', type: 'text', label: 'Descrição dos transportes', section: 'Transportes' },
  'home.transport.cta': { value: 'Registar boleia', type: 'text', label: 'CTA de transportes', section: 'Transportes' },

  'home.allergies.tag': { value: 'Alergias e intolerâncias', type: 'text', label: 'Tag de alergias', section: 'Alergias' },
  'home.allergies.title': { value: 'Alguma restrição alimentar?', type: 'text', label: 'Título das alergias', section: 'Alergias' },
  'home.allergies.description': { value: 'Para garantir que toda a gente desfruta da refeição com segurança, pedimos que nos indique quaisquer alergias ou intolerâncias alimentares.', type: 'text', label: 'Descrição das alergias', section: 'Alergias' },
  'home.allergies.cta': { value: 'Registar alergias', type: 'text', label: 'CTA de alergias', section: 'Alergias' },

  'home.presenca.tag': { value: 'Confirmação', type: 'text', label: 'Tag da secção presença', section: 'Presença' },
  'home.presenca.title': { value: 'Vai ao casamento?', type: 'text', label: 'Título da secção presença', section: 'Presença' },
  'home.presenca.description': { value: 'Confirme a sua presença para que possamos preparar tudo com cuidado.', type: 'text', label: 'Descrição da secção presença', section: 'Presença' },
  'home.presenca.cta': { value: 'Confirmar presença', type: 'text', label: 'CTA da secção presença', section: 'Presença' },
  'home.presenca.image': { value: '', type: 'image', label: 'Imagem da secção presença', section: 'Presença' },
  'home.presenca_modal.tag': { value: 'Confirmação de presença', type: 'text', label: 'Tag do modal de presença', section: 'Presença' },
  'home.presenca_modal.title': { value: 'Eu vou. E você?', type: 'text', label: 'Título do modal de presença', section: 'Presença' },
  'home.presenca_modal.name_label': { value: 'Nome *', type: 'text', label: 'Label do campo nome', section: 'Presença' },
  'home.presenca_modal.name_placeholder': { value: 'Nome completo', type: 'text', label: 'Placeholder do campo nome', section: 'Presença' },
  'home.presenca_modal.presenca_label': { value: 'Vou *', type: 'text', label: 'Label das opções de presença', section: 'Presença' },
  'home.presenca_modal.cancel': { value: 'Cancelar', type: 'text', label: 'Botão cancelar', section: 'Presença' },
  'home.presenca_modal.submit': { value: 'Confirmar', type: 'text', label: 'Botão confirmar', section: 'Presença' },
  'home.presenca_modal.loading': { value: 'A guardar...', type: 'text', label: 'Texto de carregamento', section: 'Presença' },
  'home.presenca_modal.success_title': { value: 'Obrigado!', type: 'text', label: 'Título de sucesso', section: 'Presença' },
  'home.presenca_modal.success_message': { value: 'Recebemos a confirmação.', type: 'text', label: 'Mensagem de sucesso', section: 'Presença' },

  'home.venue_actions.google_maps': { value: 'Google Maps', type: 'text', label: 'Botão Google Maps', section: 'Locais' },
  'home.venue_actions.apple_maps': { value: 'Mapas', type: 'text', label: 'Botão Apple Maps', section: 'Locais' },
  'home.venue_actions.waze': { value: 'Waze', type: 'text', label: 'Botão Waze', section: 'Locais' },

  'home.footer.date': { value: '19 setembro · 2026', type: 'text', label: 'Data do rodapé', section: 'Rodapé' },

  'layout.home_order': { value: 'countdown,ceremony,cocktail,list,info,presenca', type: 'text', label: 'Ordem das secções (Home)', section: 'Layout' },
  'layout.lista_order': { value: 'gifts,honeymoon', type: 'text', label: 'Ordem das secções (Lista)', section: 'Layout' },
  'home.venue.ceremony.reverse_layout': { value: 'false', type: 'text', label: 'Layout invertido (cerimónia)', section: 'Layout' },
  'home.venue.cocktail.reverse_layout': { value: 'true', type: 'text', label: 'Layout invertido (cocktail)', section: 'Layout' },
  'home.list.reverse_layout': { value: 'false', type: 'text', label: 'Layout invertido (lista teaser)', section: 'Layout' },

  'lista.hero.title': { value: 'Lista', type: 'text', label: 'Título da lista', section: 'Lista – Hero' },
  'lista.hero.subtitle': { value: 'Leonor e João Maria · 2026', type: 'text', label: 'Subtítulo da lista', section: 'Lista – Hero' },
  'lista.hero.image': { value: '', type: 'image', label: 'Imagem hero da lista', section: 'Lista – Hero' },

  'lista.payment.contact1.label': { value: 'João Maria', type: 'text', label: 'Nome contacto 1', section: 'Pagamento' },
  'lista.payment.contact1.number': { value: '913 576 010', type: 'text', label: 'Número MB Way 1', section: 'Pagamento' },
  'lista.payment.contact2.label': { value: 'Leonor', type: 'text', label: 'Nome contacto 2', section: 'Pagamento' },
  'lista.payment.contact2.number': { value: '918 121 374', type: 'text', label: 'Número MB Way 2', section: 'Pagamento' },
  'lista.payment.revolut': { value: 'joaommagalhaes', type: 'text', label: 'Tag Revolut', section: 'Pagamento' },
  'lista.payment.iban': { value: 'PT50 0023 0000 45479638251 94', type: 'text', label: 'IBAN', section: 'Pagamento' },
  'lista.payment.open_label': { value: 'Ver métodos de pagamento', type: 'text', label: 'Botão métodos de pagamento', section: 'Pagamento' },

  'lista.gift.contribute': { value: 'Contribuir', type: 'text', label: 'Botão Contribuir', section: 'Presentes' },
  'lista.gift.full': { value: 'Completo', type: 'text', label: 'Badge "Completo"', section: 'Presentes' },
  'lista.toggle.show_more': { value: 'Ver mais', type: 'text', label: 'Botão ver mais', section: 'Presentes' },
  'lista.toggle.show_less': { value: 'Ver menos', type: 'text', label: 'Botão ver menos', section: 'Presentes' },

  'lista.honeymoon.tag': { value: 'Lua de mel', type: 'text', label: 'Tag lua de mel', section: 'Lua de Mel' },
  'lista.honeymoon.title': { value: 'Ajude-nos a voar', type: 'text', label: 'Título lua de mel', section: 'Lua de Mel' },
  'lista.honeymoon.image': { value: '', type: 'image', label: 'Imagem lua de mel', section: 'Lua de Mel' },
  'lista.honeymoon.success_title': { value: 'Muito obrigado!', type: 'text', label: 'Título de sucesso', section: 'Lua de Mel' },
  'lista.honeymoon.success_message': { value: 'A contribuição de €{amount} significa muito para nós.', type: 'text', label: 'Mensagem de sucesso (usa {amount} para o valor)', section: 'Lua de Mel' },
  'lista.honeymoon.amount_label': { value: 'Escolha um valor', type: 'text', label: 'Label do campo valor', section: 'Lua de Mel' },
  'lista.honeymoon.amount_placeholder': { value: 'Valor', type: 'text', label: 'Placeholder valor', section: 'Lua de Mel' },
  'lista.honeymoon.name_label': { value: 'O seu nome *', type: 'text', label: 'Label do campo nome', section: 'Lua de Mel' },
  'lista.honeymoon.name_placeholder': { value: 'Nome completo', type: 'text', label: 'Placeholder nome', section: 'Lua de Mel' },
  'lista.honeymoon.message_label': { value: 'Deixe uma mensagem (opcional)', type: 'text', label: 'Label do campo mensagem', section: 'Lua de Mel' },
  'lista.honeymoon.message_placeholder': { value: 'Desejamos-vos uma aventura maravilhosa!', type: 'text', label: 'Placeholder mensagem', section: 'Lua de Mel' },
  'lista.honeymoon.submit_label': { value: 'Registar contribuição', type: 'text', label: 'Texto do botão enviar', section: 'Lua de Mel' },
  'lista.honeymoon.loading_label': { value: 'A processar...', type: 'text', label: 'Texto de carregamento', section: 'Lua de Mel' },
}

export interface SiteContentRow {
  key: string
  value: string
  type: ContentType
  label: string
  section: string
  updated_at?: string
}

// Fetch all content from Firestore — returns a key→value map
// Falls back to empty Map on error (defaults will apply)
export async function fetchSiteContent(): Promise<Map<string, string>> {
  try {
    const snapshot = await getDocs(collection(db, 'site_content'))
    const map = new Map<string, string>()
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      map.set(docSnap.id, data.value ?? '')
    }
    return map
  } catch (err) {
    console.warn('[siteContent] fetchSiteContent error:', err)
    return new Map()
  }
}

// Upsert a single content item
export async function upsertSiteContent(key: string, value: string): Promise<void> {
  const defaults = CONTENT_DEFAULTS[key as ContentKey]
  await setDoc(doc(db, 'site_content', key), {
    value,
    type: defaults?.type ?? 'text',
    label: defaults?.label ?? key,
    section: defaults?.section ?? '',
    updated_at: new Date().toISOString(),
  }, { merge: true })
}

// Upsert multiple items at once
export async function upsertSiteContentBatch(
  items: Array<{ key: string; value: string }>,
): Promise<void> {
  const batch = writeBatch(db)
  for (const { key, value } of items) {
    const defaults = CONTENT_DEFAULTS[key as ContentKey]
    batch.set(doc(db, 'site_content', key), {
      value,
      type: defaults?.type ?? 'text',
      label: defaults?.label ?? key,
      section: defaults?.section ?? '',
      updated_at: new Date().toISOString(),
    }, { merge: true })
  }
  await batch.commit()
}
