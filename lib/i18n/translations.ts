export const translations = {
  fr: {
    // Header
    'app.title': 'Millewee',
    'app.subtitle': 'Cafe-Brasserie',

    // Navigation
    'nav.menu': 'Menu',
    'nav.dishes': 'Plats',
    'nav.drinks': 'Boissons',
    'nav.cart': 'Panier',

    // Cart
    'cart.title': 'Votre Commande',
    'cart.empty': 'Votre panier est vide',
    'cart.total': 'Total',
    'cart.items': 'articles',
    'cart.item': 'article',
    'cart.add': 'Ajouter',
    'cart.remove': 'Retirer',
    'cart.clear': 'Vider le panier',
    'cart.comment': 'Remarque',
    'cart.commentPlaceholderDish': 'Ex: sans oignon, bien cuit...',
    'cart.commentPlaceholderDrink': 'Ex: bien fraiche, avec deux verres...',
    'cart.quantity': 'Quantite',

    // Actions
    'action.order': 'Commandez !',
    'action.ordering': 'Envoi en cours...',
    'action.close': 'Fermer',
    'action.paymentSoon': 'Paiement bientot disponible',

    // Menu
    'menu.specials': 'Plats de la Semaine',
    'menu.allCategories': 'Tout',
    'menu.noItems': 'Aucun element dans cette categorie',

    // Badges
    'badge.popular': 'Populaire',
    'badge.new': 'Nouveau',
    'badge.discount': 'Promo',
    'badge.special': 'Special',

    // Allergens
    'allergens.title': 'Allergenes',

    // Item details
    'item.variants': 'Choix',
    'item.sizes': 'Taille',
    'item.selections': 'Options',
    'item.description': 'Description',

    // Table
    'table.label': 'Table',

    // Misc
    'misc.loading': 'Chargement...',
    'misc.error': 'Erreur de chargement',
  },
  en: {
    // Header
    'app.title': 'Millewee',
    'app.subtitle': 'Cafe-Brasserie',

    // Navigation
    'nav.menu': 'Menu',
    'nav.dishes': 'Dishes',
    'nav.drinks': 'Drinks',
    'nav.cart': 'Cart',

    // Cart
    'cart.title': 'Your Order',
    'cart.empty': 'Your cart is empty',
    'cart.total': 'Total',
    'cart.items': 'items',
    'cart.item': 'item',
    'cart.add': 'Add',
    'cart.remove': 'Remove',
    'cart.clear': 'Clear cart',
    'cart.comment': 'Note',
    'cart.commentPlaceholderDish': 'E.g. no onion, well done...',
    'cart.commentPlaceholderDrink': 'E.g. well chilled, with two glasses...',
    'cart.quantity': 'Quantity',

    // Actions
    'action.order': 'Place Order',
    'action.ordering': 'Sending...',
    'action.close': 'Close',
    'action.paymentSoon': 'Payment coming soon',

    // Menu
    'menu.specials': 'Weekly Specials',
    'menu.allCategories': 'All',
    'menu.noItems': 'No items in this category',

    // Badges
    'badge.popular': 'Popular',
    'badge.new': 'New',
    'badge.discount': 'Promo',
    'badge.special': 'Special',

    // Allergens
    'allergens.title': 'Allergens',

    // Item details
    'item.variants': 'Choice',
    'item.sizes': 'Size',
    'item.selections': 'Options',
    'item.description': 'Description',

    // Table
    'table.label': 'Table',

    // Misc
    'misc.loading': 'Loading...',
    'misc.error': 'Loading error',
  },
  lb: {
    // Header
    'app.title': 'Millewee',
    'app.subtitle': 'Cafe-Brasserie',

    // Navigation
    'nav.menu': 'Menu',
    'nav.dishes': 'Platen',
    'nav.drinks': 'Gedrenksen',
    'nav.cart': 'Kuerf',

    // Cart
    'cart.title': 'Aer Bestellung',
    'cart.empty': 'Aere Kuerf ass eidel',
    'cart.total': 'Total',
    'cart.items': 'Artikelen',
    'cart.item': 'Artikel',
    'cart.add': 'Dobaisetzen',
    'cart.remove': 'Ewechhuelen',
    'cart.clear': 'Kuerf eidel maachen',
    'cart.comment': 'Bemierkung',
    'cart.commentPlaceholderDish': 'Z.B. ouni Zwiwwel, gutt duerchgebroden...',
    'cart.commentPlaceholderDrink': 'Z.B. gutt kal, mat zwee Glieser...',
    'cart.quantity': 'Quantiteit',

    // Actions
    'action.order': 'Bestellen!',
    'action.ordering': 'Gett gescheckt...',
    'action.close': 'Zoumaachen',
    'action.paymentSoon': 'Bezuelen geschwenn disponibel',

    // Menu
    'menu.specials': 'Platen vun der Woch',
    'menu.allCategories': 'Alles',
    'menu.noItems': 'Keng Elementer an dëser Kategorie',

    // Badges
    'badge.popular': 'Beléift',
    'badge.new': 'Nei',
    'badge.discount': 'Promo',
    'badge.special': 'Spezial',

    // Allergens
    'allergens.title': 'Allergenen',

    // Item details
    'item.variants': 'Choix',
    'item.sizes': 'Gréisst',
    'item.selections': 'Optiounen',
    'item.description': 'Beschreiwung',

    // Table
    'table.label': 'Dësch',

    // Misc
    'misc.loading': 'Lueden...',
    'misc.error': 'Feeler beim Lueden',
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.fr;

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'fr', name: 'Francais', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'en', name: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'lb', name: 'Letzebuergesch', flag: '\u{1F1F1}\u{1F1FA}' },
];
