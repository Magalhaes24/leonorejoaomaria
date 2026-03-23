import { addDoc, collection, doc, setDoc } from "firebase/firestore";

  const demoImages = {
    plating: new URL("../assets/img/plating-chef.jpg", import.meta.url).href,
    interior: new URL("../assets/img/table-interior.jpg", import.meta.url).href,
    service: new URL("../assets/img/table-food.jpg", import.meta.url).href,
    exterior: new URL("../assets/img/exterior.jpg", import.meta.url).href,
    kitchen: new URL("../assets/img/kitchen.jpg", import.meta.url).href,
  };

export const seedContent = async (db) => {
  if (!db) return;

  await setDoc(
    doc(db, "site", "restaurant"),
    {
      name: { pt: "Lumeo", en: "Lumeo" },
      tagline: {
        pt: "Cozinha sazonal à beira do Tejo.",
        en: "Seasonal dining by the Tagus.",
      },
      heroTitle: {
        pt: "Uma mesa luminosa, uma pausa tranquila.",
        en: "A luminous table, a quiet pause.",
      },
      heroSubtitle: {
        pt: "Pratos de origem atlântica, serviço atento e um ambiente minimalista pensado ao detalhe.",
        en: "Atlantic-forward plates, attentive service, and a minimal space tuned to detail.",
      },
      heroCta: { pt: "Reservar mesa", en: "Book a table" },
      story: {
        pt: "Lumeo nasceu da vontade de criar um restaurante onde o tempo abranda. O menu acompanha a maré: peixe do dia, vegetais de produtores locais e técnicas suaves para preservar a essência dos sabores.",
        en: "Lumeo was built to slow time. The menu follows the tide: daily catch, local produce, and gentle techniques that preserve the soul of each ingredient.",
      },
      chefNote: {
        pt: "A cozinha é direta e elegante, com foco no essencial. Cada prato é terminado no momento, com textura e temperatura perfeitas.",
        en: "The kitchen is direct and elegant, focused on essentials. Every plate is finished to order with precise texture and temperature.",
      },
      values: [
        { pt: "Sazonalidade e transparência.", en: "Seasonality and transparency." },
        { pt: "Serviço silencioso e preciso.", en: "Quiet, precise service." },
        { pt: "Detalhe em cada gesto.", en: "Care in every gesture." },
      ],
      atmosphere: {
        pt: "Vidro, pedra e madeira clara criam um espaço sereno, com luz quente e acústica suave.",
        en: "Glass, stone, and light wood create a calm room with warm light and soft acoustics.",
      },
      address: { pt: "Rua do Arsenal 18, Lisboa", en: "Rua do Arsenal 18, Lisbon" },
      phone: "+351 210 456 220",
      email: "reservas@lumeo.pt",
      mapEmbedUrl: "https://share.google/b7uzW2u59ftLE1y8W",
      social: {
        instagram: "https://instagram.com/lumeorestaurant",
        facebook: "https://facebook.com/lumeorestaurant",
      },
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "hours", "default"),
    {
      entries: [
        {
          label: { pt: "Segunda a Quinta", en: "Monday to Thursday" },
          open: "12:30",
          close: "23:00",
        },
        {
          label: { pt: "Sexta e Sábado", en: "Friday & Saturday" },
          open: "12:30",
          close: "00:00",
        },
        {
          label: { pt: "Domingo", en: "Sunday" },
          open: "12:30",
          close: "22:00",
        },
      ],
      slotDurationMinutes: 30,
      maxReservationsPerSlot: 12,
      maxGuestsPerSlot: 36,
      note: {
        pt: "Última reserva às 21:30. Menu de degustação disponível mediante pedido.",
        en: "Last booking at 21:30. Tasting menu available on request.",
      },
    },
    { merge: true }
  );

  await Promise.all([
    setDoc(
      doc(db, "highlights", "coastal-tasting"),
      {
        title: { pt: "Degustação Atlântica", en: "Atlantic Tasting" },
        description: {
          pt: "Cinco momentos de mar e costa com finalização à mesa.",
          en: "Five coastal moments finished tableside.",
        },
        price: "€85",
        image: demoImages.plating,
      },
      { merge: true }
    ),
      setDoc(
        doc(db, "highlights", "glasshouse-lunch"),
        {
          title: { pt: "Almoço no Jardim", en: "Glasshouse Lunch" },
        description: {
          pt: "Menu executivo leve com entrada, prato e sobremesa.",
          en: "Light executive menu with starter, main, and dessert.",
        },
        price: "€32",
          image: demoImages.kitchen,
        },
        { merge: true }
      ),
    setDoc(
      doc(db, "highlights", "chef-table"),
      {
        title: { pt: "Chef Table", en: "Chef Table" },
        description: {
          pt: "Uma experiência intimista para 6 pessoas.",
          en: "An intimate experience for 6 guests.",
        },
        price: "€120",
        image: demoImages.exterior,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "highlights", "cellar-pairing"),
      {
        title: { pt: "Harmonização da Adega", en: "Cellar Pairing" },
        description: {
          pt: "Seis vinhos escolhidos para acompanhar o menu.",
          en: "Six wines curated to pair with the menu.",
        },
        price: "€48",
        image: demoImages.interior,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "highlights", "sunset-aperitif"),
      {
        title: { pt: "Aperitivo ao Pôr-do-sol", en: "Sunset Aperitif" },
        description: {
          pt: "Cocktail de assinatura e petiscos leves no terraço.",
          en: "Signature cocktail with light bites on the terrace.",
        },
        price: "€22",
        image: demoImages.service,
      },
      { merge: true }
    ),
  ]);

  await Promise.all([
    setDoc(
      doc(db, "testimonials", "ines"),
      {
        name: "Ines Carvalho",
        role: { pt: "Diretora criativa", en: "Creative director" },
        quote: {
          pt: "Tudo e silencioso e perfeito, da iluminacao ao ultimo prato.",
          en: "Everything feels quiet and perfect, from lighting to the final plate.",
        },
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "testimonials", "miguel"),
      {
        name: "Miguel Santos",
        role: { pt: "Chef convidado", en: "Guest chef" },
        quote: {
          pt: "Uma cozinha limpa, precisa e com respeito pelo produto.",
          en: "A clean, precise kitchen with deep respect for ingredients.",
        },
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "testimonials", "laura"),
      {
        name: "Laura Meireles",
        role: { pt: "Empresaria", en: "Entrepreneur" },
        quote: {
          pt: "O ambiente e tao memoravel quanto o menu.",
          en: "The atmosphere is as memorable as the menu.",
        },
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "testimonials", "andre"),
      {
        name: "Andre Pires",
        role: { pt: "Arquiteto", en: "Architect" },
        quote: {
          pt: "Um espaco com luz perfeita e uma cozinha de grande rigor.",
          en: "A space with perfect light and a kitchen of deep precision.",
        },
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "testimonials", "sofia"),
      {
        name: "Sofia Ramos",
        role: { pt: "Gestora de projetos", en: "Project manager" },
        quote: {
          pt: "O menu de degustacao e uma viagem tranquila e memoravel.",
          en: "The tasting menu is a calm, memorable journey.",
        },
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "testimonials", "helena"),
      {
        name: "Helena Costa",
        role: { pt: "Editora cultural", en: "Culture editor" },
        quote: {
          pt: "Ha um equilibrio raro entre rigor e conforto em cada detalhe.",
          en: "There is a rare balance of rigor and comfort in every detail.",
        },
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "testimonials", "tiago"),
      {
        name: "Tiago Moreira",
        role: { pt: "Sommelier", en: "Sommelier" },
        quote: {
          pt: "A carta de vinhos e precisa e inesperada.",
          en: "The wine list feels precise and full of surprises.",
        },
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "testimonials", "rita"),
      {
        name: "Rita Azevedo",
        role: { pt: "Diretora de hotel", en: "Hotel director" },
        quote: {
          pt: "O servico e discreto e sempre presente no momento certo.",
          en: "Service is discreet and always there at the right moment.",
        },
      },
      { merge: true }
    ),
  ]);

  await Promise.all([
    setDoc(
      doc(db, "menuCategories", "starters"),
      {
        name: { pt: "Entradas", en: "Starters" },
        order: 1,
        items: [
          {
            name: { pt: "Tartaro de lirio", en: "Amberjack tartare" },
            description: {
              pt: "Citricos, pepino e azeite de coentros.",
              en: "Citrus, cucumber, and coriander oil.",
            },
            price: "€18",
            tags: [
              { pt: "Fresco", en: "Fresh" },
              { pt: "Sem gluten", en: "Gluten-free" },
            ],
          },
          {
            name: { pt: "Caldo de mar", en: "Sea broth" },
            description: {
              pt: "Mariscos, algas e pao de massa mae.",
              en: "Shellfish, seaweed, and sourdough.",
            },
            price: "€16",
            tags: [{ pt: "Quente", en: "Warm" }],
          },
          {
            name: { pt: "Ostra e pera", en: "Oyster & pear" },
            description: {
              pt: "Vinagrete de algas e ervas citricas.",
              en: "Seaweed vinaigrette and citrus herbs.",
            },
            price: "€14",
            tags: [{ pt: "Frio", en: "Chilled" }],
          },
          {
            name: { pt: "Salada de polvo", en: "Octopus salad" },
            description: {
              pt: "Batata nova, paprika fumada.",
              en: "New potato and smoked paprika.",
            },
            price: "€17",
            tags: [{ pt: "Classico", en: "Classic" }],
          },
          {
            name: { pt: "Espargos grelhados", en: "Grilled asparagus" },
            description: {
              pt: "Manteiga noisette e lascas de queijo curado.",
              en: "Brown butter and aged cheese shavings.",
            },
            price: "€15",
            tags: [{ pt: "Vegetariano", en: "Vegetarian" }],
          },
          {
            name: { pt: "Carpaccio de vieira", en: "Scallop carpaccio" },
            description: {
              pt: "Azeite de citrinos e flor de sal.",
              en: "Citrus oil and sea salt.",
            },
            price: "€19",
            tags: [{ pt: "Fresco", en: "Fresh" }],
          },
          {
            name: { pt: "Broa e manteiga de algas", en: "Cornbread & seaweed butter" },
            description: {
              pt: "Servida quente com sal marinho.",
              en: "Served warm with sea salt.",
            },
            price: "€6",
            tags: [{ pt: "Entrada", en: "Starter" }],
          },
          {
            name: { pt: "Gamba rosa", en: "Pink prawn" },
            description: {
              pt: "Caldo de carabineiro e citrinos.",
              en: "Scarlet prawn broth and citrus.",
            },
            price: "€20",
            tags: [{ pt: "Mar", en: "Sea" }],
          },
          {
            name: { pt: "Crudo de atum", en: "Tuna crudo" },
            description: {
              pt: "Soja leve, sementes de sesamo e cebolinho.",
              en: "Light soy, sesame seeds, and chives.",
            },
            price: "€18",
            tags: [{ pt: "Fresco", en: "Fresh" }],
          },
          {
            name: { pt: "Ceviche de robalo", en: "Sea bass ceviche" },
            description: {
              pt: "Leite de tigre e coentros frescos.",
              en: "Citrus leche de tigre and fresh coriander.",
            },
            price: "€17",
            tags: [{ pt: "Citricos", en: "Citrus" }],
          },
          {
            name: { pt: "Burrata e tomate confitado", en: "Burrata & slow tomato" },
            description: {
              pt: "Azeite de manjericao e croutons.",
              en: "Basil oil and croutons.",
            },
            price: "€16",
            tags: [{ pt: "Vegetariano", en: "Vegetarian" }],
          },
          {
            name: { pt: "Sopa fria de ervilhas", en: "Chilled pea soup" },
            description: {
              pt: "Iogurte e hortela.",
              en: "Yogurt and mint.",
            },
            price: "€13",
            tags: [{ pt: "Leve", en: "Light" }],
          },
        ],
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "menuCategories", "mains"),
      {
        name: { pt: "Pratos principais", en: "Mains" },
        order: 2,
        items: [
          {
            name: { pt: "Robalo em brasa", en: "Charred sea bass" },
            description: {
              pt: "Manteiga noisette, funcho e limao.",
              en: "Brown butter, fennel, and lemon.",
            },
            price: "€28",
            tags: [{ pt: "Assado", en: "Charred" }],
          },
          {
            name: { pt: "Lombo de vaca", en: "Aged beef loin" },
            description: {
              pt: "Pure de aipo, molho de vinho tinto.",
              en: "Celeriac puree, red wine jus.",
            },
            price: "€32",
            tags: [{ pt: "Classico", en: "Classic" }],
          },
          {
            name: { pt: "Arroz de carabineiro", en: "Scarlet prawn rice" },
            description: {
              pt: "Caldo intenso de marisco e lima.",
              en: "Intense shellfish broth and lime.",
            },
            price: "€34",
            tags: [{ pt: "Assinatura", en: "Signature" }],
          },
          {
            name: { pt: "Bacalhau confitado", en: "Confit cod" },
            description: {
              pt: "Pil pil, couve salteada.",
              en: "Pil pil sauce and sauteed kale.",
            },
            price: "€29",
            tags: [{ pt: "Tradicao", en: "Tradition" }],
          },
          {
            name: { pt: "Cogumelos e cevada", en: "Mushroom & barley" },
            description: {
              pt: "Creme de ervas e cebola tostada.",
              en: "Herb cream and toasted onion.",
            },
            price: "€24",
            tags: [{ pt: "Vegetariano", en: "Vegetarian" }],
          },
          {
            name: { pt: "Pato com beterraba", en: "Duck & beet" },
            description: {
              pt: "Molho de frutos vermelhos e tomilho.",
              en: "Red berry jus and thyme.",
            },
            price: "€30",
            tags: [{ pt: "Assinatura", en: "Signature" }],
          },
          {
            name: { pt: "Linguine do mar", en: "Sea linguine" },
            description: {
              pt: "Amêijoa, coentros e limao.",
              en: "Clams, coriander, and lemon.",
            },
            price: "€26",
            tags: [{ pt: "Mar", en: "Sea" }],
          },
          {
            name: { pt: "Polvo na brasa", en: "Charred octopus" },
            description: {
              pt: "Batata roxa, aioli de alho negro.",
              en: "Purple potato and black garlic aioli.",
            },
            price: "€31",
            tags: [{ pt: "Assado", en: "Charred" }],
          },
          {
            name: { pt: "Risotto de limao", en: "Lemon risotto" },
            description: {
              pt: "Manteiga de ervas e limao confitado.",
              en: "Herb butter and preserved lemon.",
            },
            price: "€25",
            tags: [{ pt: "Vegetariano", en: "Vegetarian" }],
          },
          {
            name: { pt: "Cordeiro lento", en: "Slow-cooked lamb" },
            description: {
              pt: "Cenoura assada e molho de iogurte.",
              en: "Roasted carrot and yogurt sauce.",
            },
            price: "€33",
            tags: [{ pt: "Lento", en: "Slow" }],
          },
          {
            name: { pt: "Ravioli de ricotta", en: "Ricotta ravioli" },
            description: {
              pt: "Espinafres, avela e manteiga de salva.",
              en: "Spinach, hazelnut, and sage butter.",
            },
            price: "€24",
            tags: [{ pt: "Vegetariano", en: "Vegetarian" }],
          },
          {
            name: { pt: "Filete de pregado", en: "Turbot fillet" },
            description: {
              pt: "Molho de champagne e ervilhas.",
              en: "Champagne sauce and peas.",
            },
            price: "€36",
            tags: [{ pt: "Assinatura", en: "Signature" }],
          },
          {
            name: { pt: "Frango do campo", en: "Farm chicken" },
            description: {
              pt: "Pure de pastinaca e molho de limao.",
              en: "Parsnip puree and lemon jus.",
            },
            price: "€27",
            tags: [{ pt: "Conforto", en: "Comfort" }],
          },
        ],
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "menuCategories", "desserts"),
      {
        name: { pt: "Sobremesas", en: "Desserts" },
        order: 3,
        items: [
          {
            name: { pt: "Citricos e iogurte", en: "Citrus & yogurt" },
            description: {
              pt: "Mel, ervas frescas e merengue.",
              en: "Honey, fresh herbs, and meringue.",
            },
            price: "€12",
            tags: [{ pt: "Leve", en: "Light" }],
          },
          {
            name: { pt: "Chocolate do mar", en: "Sea salt chocolate" },
            description: {
              pt: "Caramelo salgado e flor de sal.",
              en: "Salted caramel and sea salt.",
            },
            price: "€12",
            tags: [{ pt: "Rico", en: "Rich" }],
          },
          {
            name: { pt: "Pera e amendoa", en: "Pear & almond" },
            description: {
              pt: "Creme leve e crocante de amendoa.",
              en: "Light cream and almond crunch.",
            },
            price: "€11",
            tags: [{ pt: "Suave", en: "Soft" }],
          },
          {
            name: { pt: "Tarte de figo", en: "Fig tart" },
            description: {
              pt: "Gelado de baunilha e mel.",
              en: "Vanilla ice cream and honey.",
            },
            price: "€12",
            tags: [{ pt: "Sazonal", en: "Seasonal" }],
          },
          {
            name: { pt: "Panna cotta de lavanda", en: "Lavender panna cotta" },
            description: {
              pt: "Compota de frutos vermelhos.",
              en: "Red berry compote.",
            },
            price: "€11",
            tags: [{ pt: "Aroma", en: "Aromatic" }],
          },
          {
            name: { pt: "Queijos artesanais", en: "Artisan cheeses" },
            description: {
              pt: "Selecao do dia com frutos secos.",
              en: "Daily selection with dried fruit.",
            },
            price: "€14",
            tags: [{ pt: "Selecao", en: "Selection" }],
          },
          {
            name: { pt: "Mil folhas de baunilha", en: "Vanilla mille-feuille" },
            description: {
              pt: "Creme leve e caramelo salgado.",
              en: "Light cream and salted caramel.",
            },
            price: "€12",
            tags: [{ pt: "Classico", en: "Classic" }],
          },
          {
            name: { pt: "Gelado de azeite", en: "Olive oil gelato" },
            description: {
              pt: "Flor de sal e azeite novo.",
              en: "Sea salt and new harvest olive oil.",
            },
            price: "€10",
            tags: [{ pt: "Assinatura", en: "Signature" }],
          },
          {
            name: { pt: "Mousse de chocolate", en: "Chocolate mousse" },
            description: {
              pt: "Texturas de cacau e crumble.",
              en: "Cocoa textures and crumble.",
            },
            price: "€11",
            tags: [{ pt: "Rico", en: "Rich" }],
          },
          {
            name: { pt: "Tarte de amendoa", en: "Almond tart" },
            description: {
              pt: "Lima e creme de leite.",
              en: "Lime and cream.",
            },
            price: "€11",
            tags: [{ pt: "Suave", en: "Soft" }],
          },
          {
            name: { pt: "Pudim de ovos", en: "Egg custard" },
            description: {
              pt: "Caramelo claro e flor de sal.",
              en: "Light caramel and sea salt.",
            },
            price: "€10",
            tags: [{ pt: "Tradicao", en: "Tradition" }],
          },
        ],
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "menuCategories", "drinks"),
      {
        name: { pt: "Bebidas", en: "Drinks" },
        order: 4,
        items: [
          {
            name: { pt: "Vinhos do Atlantico", en: "Atlantic wines" },
            description: {
              pt: "Selecao de pequenos produtores.",
              en: "Selection from small producers.",
            },
            price: "€9",
            tags: [{ pt: "Copo", en: "Glass" }],
          },
          {
            name: { pt: "Cocktail Lumeo", en: "Lumeo cocktail" },
            description: {
              pt: "Gin, lucia-lima e espuma citrica.",
              en: "Gin, lemon verbena, and citrus foam.",
            },
            price: "€11",
            tags: [{ pt: "Assinatura", en: "Signature" }],
          },
          {
            name: { pt: "Mocktail salino", en: "Saline mocktail" },
            description: {
              pt: "Citricos, sal marinho e hortela.",
              en: "Citrus, sea salt, and mint.",
            },
            price: "€8",
            tags: [{ pt: "Sem alcool", en: "Zero proof" }],
          },
          {
            name: { pt: "Espumante bruto", en: "Brut sparkling" },
            description: {
              pt: "Notas florais e mineralidade.",
              en: "Floral notes and minerality.",
            },
            price: "€10",
            tags: [{ pt: "Copo", en: "Glass" }],
          },
          {
            name: { pt: "Chá frio de jasmim", en: "Jasmine iced tea" },
            description: {
              pt: "Infusao leve com citrinos.",
              en: "Light infusion with citrus.",
            },
            price: "€6",
            tags: [{ pt: "Sem alcool", en: "Zero proof" }],
          },
          {
            name: { pt: "Aperol Spritz", en: "Aperol Spritz" },
            description: {
              pt: "Espumante e laranja fresca.",
              en: "Sparkling wine and fresh orange.",
            },
            price: "€12",
            tags: [{ pt: "Classico", en: "Classic" }],
          },
          {
            name: { pt: "Espresso", en: "Espresso" },
            description: {
              pt: "Cafe artesanal de torra clara.",
              en: "Single origin, light roast.",
            },
            price: "€3",
            tags: [{ pt: "Quente", en: "Hot" }],
          },
          {
            name: { pt: "Porto branco", en: "White port" },
            description: {
              pt: "Servido fresco com citrinos.",
              en: "Served chilled with citrus.",
            },
            price: "€8",
            tags: [{ pt: "Copo", en: "Glass" }],
          },
          {
            name: { pt: "Negroni classico", en: "Classic negroni" },
            description: {
              pt: "Gin, vermute e campari.",
              en: "Gin, vermouth, and Campari.",
            },
            price: "€12",
            tags: [{ pt: "Classico", en: "Classic" }],
          },
          {
            name: { pt: "Agua com gas", en: "Sparkling water" },
            description: {
              pt: "Garrafa 750ml.",
              en: "750ml bottle.",
            },
            price: "€4",
            tags: [{ pt: "Sem alcool", en: "Zero proof" }],
          },
          {
            name: { pt: "Kombucha de cha verde", en: "Green tea kombucha" },
            description: {
              pt: "Fermentacao natural e ligeira acidez.",
              en: "Naturally fermented with gentle acidity.",
            },
            price: "€7",
            tags: [{ pt: "Sem alcool", en: "Zero proof" }],
          },
        ],
      },
      { merge: true }
    ),
  ]);

  await addDoc(collection(db, "reservations"), {
    name: "Ana Rodrigues",
    email: "ana.rodrigues@email.pt",
    phone: "+351 911 234 567",
    date: "2026-06-12",
    time: "20:30",
    guests: 2,
    notes: "Mesa junto a janela.",
    status: "confirmed",
    language: "pt",
  });
  await addDoc(collection(db, "reservations"), {
    name: "Joao Mendes",
    email: "joao.mendes@email.pt",
    phone: "+351 913 221 540",
    date: "2026-06-18",
    time: "19:00",
    guests: 4,
    notes: "Aniversario, preferencia por mesa discreta.",
    status: "pending",
    language: "pt",
  });
  await addDoc(collection(db, "reservations"), {
    name: "Emily Parker",
    email: "emily.parker@email.com",
    phone: "+351 925 880 102",
    date: "2026-06-20",
    time: "20:00",
    guests: 2,
    notes: "Window seat if possible.",
    status: "confirmed",
    language: "en",
  });

  await addDoc(collection(db, "contactRequests"), {
    name: "Daniel Sousa",
    email: "daniel.sousa@email.pt",
    message: "Gostava de organizar um jantar privado para 10 pessoas.",
    language: "pt",
  });
  await addDoc(collection(db, "contactRequests"), {
    name: "Maria Silva",
    email: "maria.silva@email.pt",
    message: "Existe menu vegetariano para um jantar de grupo?",
    language: "pt",
  });
  await addDoc(collection(db, "contactRequests"), {
    name: "James Carter",
    email: "james.carter@email.com",
    message: "Do you offer a wine pairing with the tasting menu?",
    language: "en",
  });
};
