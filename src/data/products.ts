import type { Product } from '@/types/product';

/**
 * Mock catalog served by MSW's /api/products handler. Generated once as a
 * static fixture — the shapes here are exactly what a real product API
 * would return, so this file (not the components) is what gets replaced
 * if this ever points at a real backend.
 */
export const products: Product[] = [
  {
    "id": "p1",
    "slug": "monstera-deliciosa",
    "name": "Monstera Deliciosa",
    "price": 68,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "Bestseller",
    "rating": 4.4,
    "reviewCount": 18,
    "description": "Monstera Deliciosa brings Cheese plant, iconic split leaves to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Easy",
    "inStock": true,
    "stockCount": 10,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": false
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Bright indirect"
      },
      {
        "label": "Water",
        "value": "Weekly"
      },
      {
        "label": "Pet safe",
        "value": "Yes"
      },
      {
        "label": "Mature height",
        "value": "36in"
      }
    ],
    "createdAt": "2026-07-29"
  },
  {
    "id": "p2",
    "slug": "fiddle-leaf-fig",
    "name": "Fiddle Leaf Fig",
    "price": 95,
    "category": "Plants",
    "categorySlug": "plants",
    "rating": 4.5,
    "reviewCount": 31,
    "description": "Fiddle Leaf Fig brings dramatic violin-shaped leaves, fussy about drafts to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Advanced",
    "inStock": true,
    "stockCount": 13,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Bright indirect"
      },
      {
        "label": "Water",
        "value": "Weekly"
      },
      {
        "label": "Pet safe",
        "value": "No \u2014 toxic if ingested"
      },
      {
        "label": "Mature height",
        "value": "18in"
      }
    ],
    "createdAt": "2026-07-20"
  },
  {
    "id": "p3",
    "slug": "snake-plant-laurentii",
    "name": "Snake Plant Laurentii",
    "price": 38,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "New",
    "rating": 4.3,
    "reviewCount": 44,
    "description": "Snake Plant Laurentii brings upright striped leaves, tolerates neglect to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Easy",
    "inStock": true,
    "stockCount": 16,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Bright indirect"
      },
      {
        "label": "Water",
        "value": "Weekly"
      },
      {
        "label": "Pet safe",
        "value": "No \u2014 toxic if ingested"
      },
      {
        "label": "Mature height",
        "value": "24in"
      }
    ],
    "createdAt": "2026-07-11"
  },
  {
    "id": "p4",
    "slug": "pothos-marble-queen",
    "name": "Pothos Marble Queen",
    "price": 32,
    "category": "Plants",
    "categorySlug": "plants",
    "rating": 4,
    "reviewCount": 57,
    "description": "Pothos Marble Queen brings trailing variegated vine, grows in low light to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Easy",
    "inStock": true,
    "stockCount": 19,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": false
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Medium indirect"
      },
      {
        "label": "Water",
        "value": "Every 10\u201314 days"
      },
      {
        "label": "Pet safe",
        "value": "No \u2014 toxic if ingested"
      },
      {
        "label": "Mature height",
        "value": "42in"
      }
    ],
    "createdAt": "2026-07-02"
  },
  {
    "id": "p5",
    "slug": "bird-s-nest-fern",
    "name": "Bird's Nest Fern",
    "price": 44,
    "compareAtPrice": 55,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "Sale",
    "rating": 4.1,
    "reviewCount": 70,
    "description": "Bird's Nest Fern brings ruffled fronds, likes humidity to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Moderate",
    "inStock": true,
    "stockCount": 22,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Medium indirect"
      },
      {
        "label": "Water",
        "value": "Every 10\u201314 days"
      },
      {
        "label": "Pet safe",
        "value": "Yes"
      },
      {
        "label": "Mature height",
        "value": "24in"
      }
    ],
    "createdAt": "2026-06-23"
  },
  {
    "id": "p6",
    "slug": "calathea-orbifolia",
    "name": "Calathea Orbifolia",
    "price": 58,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "Low stock",
    "rating": 4.4,
    "reviewCount": 83,
    "description": "Calathea Orbifolia brings striped round leaves, prayer-plant family to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Moderate",
    "inStock": true,
    "stockCount": 2,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Bright indirect"
      },
      {
        "label": "Water",
        "value": "Weekly"
      },
      {
        "label": "Pet safe",
        "value": "Yes"
      },
      {
        "label": "Mature height",
        "value": "36in"
      }
    ],
    "createdAt": "2026-06-14"
  },
  {
    "id": "p7",
    "slug": "zz-plant",
    "name": "ZZ Plant",
    "price": 46,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "Bestseller",
    "rating": 4,
    "reviewCount": 96,
    "description": "ZZ Plant brings glossy dark leaves, drought tolerant to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Easy",
    "inStock": true,
    "stockCount": 28,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": false
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Low light tolerant"
      },
      {
        "label": "Water",
        "value": "When top 2in dry"
      },
      {
        "label": "Pet safe",
        "value": "Yes"
      },
      {
        "label": "Mature height",
        "value": "36in"
      }
    ],
    "createdAt": "2026-06-05"
  },
  {
    "id": "p8",
    "slug": "rubber-plant-burgundy",
    "name": "Rubber Plant Burgundy",
    "price": 62,
    "category": "Plants",
    "categorySlug": "plants",
    "rating": 4.3,
    "reviewCount": 109,
    "description": "Rubber Plant Burgundy brings deep maroon leaves, fast growing to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Easy",
    "inStock": true,
    "stockCount": 31,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Bright indirect"
      },
      {
        "label": "Water",
        "value": "Weekly"
      },
      {
        "label": "Pet safe",
        "value": "No \u2014 toxic if ingested"
      },
      {
        "label": "Mature height",
        "value": "24in"
      }
    ],
    "createdAt": "2026-05-27"
  },
  {
    "id": "p9",
    "slug": "string-of-pearls",
    "name": "String of Pearls",
    "price": 26,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "New",
    "rating": 4.1,
    "reviewCount": 122,
    "description": "String of Pearls brings trailing bead-like leaves, needs bright light to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Moderate",
    "inStock": true,
    "stockCount": 34,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Medium indirect"
      },
      {
        "label": "Water",
        "value": "Every 10\u201314 days"
      },
      {
        "label": "Pet safe",
        "value": "Yes"
      },
      {
        "label": "Mature height",
        "value": "24in"
      }
    ],
    "createdAt": "2026-05-18"
  },
  {
    "id": "p10",
    "slug": "peace-lily",
    "name": "Peace Lily",
    "price": 34,
    "category": "Plants",
    "categorySlug": "plants",
    "rating": 4.3,
    "reviewCount": 135,
    "description": "Peace Lily brings white blooms, signals thirst by drooping to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Easy",
    "inStock": true,
    "stockCount": 37,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": false
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Medium indirect"
      },
      {
        "label": "Water",
        "value": "Every 10\u201314 days"
      },
      {
        "label": "Pet safe",
        "value": "Yes"
      },
      {
        "label": "Mature height",
        "value": "18in"
      }
    ],
    "createdAt": "2026-05-09"
  },
  {
    "id": "p11",
    "slug": "boston-fern",
    "name": "Boston Fern",
    "price": 29,
    "compareAtPrice": 36,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "Sale",
    "rating": 3.9,
    "reviewCount": 148,
    "description": "Boston Fern brings classic feathery fronds, humidity lover to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Moderate",
    "inStock": true,
    "stockCount": 40,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Low light tolerant"
      },
      {
        "label": "Water",
        "value": "When top 2in dry"
      },
      {
        "label": "Pet safe",
        "value": "No \u2014 toxic if ingested"
      },
      {
        "label": "Mature height",
        "value": "24in"
      }
    ],
    "createdAt": "2026-04-30"
  },
  {
    "id": "p12",
    "slug": "areca-palm",
    "name": "Areca Palm",
    "price": 88,
    "category": "Plants",
    "categorySlug": "plants",
    "badge": "Low stock",
    "rating": 4.3,
    "reviewCount": 161,
    "description": "Areca Palm brings airy fronds, good for filtering air to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    "careLevel": "Easy",
    "inStock": true,
    "stockCount": 2,
    "variants": [
      {
        "id": "sm",
        "label": "Small (4in pot)",
        "inStock": true
      },
      {
        "id": "md",
        "label": "Medium (6in pot)",
        "inStock": true
      },
      {
        "id": "lg",
        "label": "Large (10in pot)",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Light",
        "value": "Medium indirect"
      },
      {
        "label": "Water",
        "value": "Every 10\u201314 days"
      },
      {
        "label": "Pet safe",
        "value": "Yes"
      },
      {
        "label": "Mature height",
        "value": "18in"
      }
    ],
    "createdAt": "2026-04-21"
  },
  {
    "id": "p13",
    "slug": "ceramic-vessel-ash",
    "name": "Ceramic Vessel \u2014 Ash",
    "price": 42,
    "category": "Vessels",
    "categorySlug": "vessels",
    "badge": "Bestseller",
    "rating": 4.7,
    "reviewCount": 18,
    "description": "Ceramic Vessel \u2014 Ash is made for plants that outgrew their nursery pot. Features hand-glazed stoneware, drainage hole + saucer, sized to work with our most popular plant varieties.",
    "inStock": true,
    "stockCount": 10,
    "variants": [
      {
        "id": "ash",
        "label": "Ash",
        "swatch": "#8b8378",
        "inStock": true
      },
      {
        "id": "slate",
        "label": "Slate",
        "swatch": "#4a5a5f",
        "inStock": true
      },
      {
        "id": "sand",
        "label": "Sand",
        "swatch": "#d9c9a8",
        "inStock": false
      }
    ],
    "specs": [
      {
        "label": "Material",
        "value": "Glazed ceramic"
      },
      {
        "label": "Drainage",
        "value": "Yes, includes saucer"
      },
      {
        "label": "Diameter",
        "value": "8in"
      }
    ],
    "createdAt": "2026-07-29"
  },
  {
    "id": "p14",
    "slug": "stone-planter-round",
    "name": "Stone Planter \u2014 Round",
    "price": 64,
    "category": "Vessels",
    "categorySlug": "vessels",
    "rating": 4.3,
    "reviewCount": 31,
    "description": "Stone Planter \u2014 Round is made for plants that outgrew their nursery pot. Features cast concrete finish, weatherproof for patios, sized to work with our most popular plant varieties.",
    "inStock": true,
    "stockCount": 13,
    "variants": [
      {
        "id": "ash",
        "label": "Ash",
        "swatch": "#8b8378",
        "inStock": true
      },
      {
        "id": "slate",
        "label": "Slate",
        "swatch": "#4a5a5f",
        "inStock": true
      },
      {
        "id": "sand",
        "label": "Sand",
        "swatch": "#d9c9a8",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Material",
        "value": "Cast concrete"
      },
      {
        "label": "Drainage",
        "value": "Yes, includes saucer"
      },
      {
        "label": "Diameter",
        "value": "9in"
      }
    ],
    "createdAt": "2026-07-20"
  },
  {
    "id": "p15",
    "slug": "terracotta-pot-set-of-3",
    "name": "Terracotta Pot Set of 3",
    "price": 36,
    "category": "Vessels",
    "categorySlug": "vessels",
    "badge": "New",
    "rating": 4.6,
    "reviewCount": 44,
    "description": "Terracotta Pot Set of 3 is made for plants that outgrew their nursery pot. Features unglazed clay, breathable for root health, sized to work with our most popular plant varieties.",
    "inStock": true,
    "stockCount": 16,
    "variants": [
      {
        "id": "ash",
        "label": "Ash",
        "swatch": "#8b8378",
        "inStock": true
      },
      {
        "id": "slate",
        "label": "Slate",
        "swatch": "#4a5a5f",
        "inStock": true
      },
      {
        "id": "sand",
        "label": "Sand",
        "swatch": "#d9c9a8",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Material",
        "value": "Unglazed clay"
      },
      {
        "label": "Drainage",
        "value": "Yes, includes saucer"
      },
      {
        "label": "Diameter",
        "value": "11in"
      }
    ],
    "createdAt": "2026-07-11"
  },
  {
    "id": "p16",
    "slug": "woven-plant-basket",
    "name": "Woven Plant Basket",
    "price": 56,
    "category": "Vessels",
    "categorySlug": "vessels",
    "rating": 4.4,
    "reviewCount": 57,
    "description": "Woven Plant Basket is made for plants that outgrew their nursery pot. Features natural seagrass weave, fits standard nursery pots, sized to work with our most popular plant varieties.",
    "inStock": true,
    "stockCount": 19,
    "variants": [
      {
        "id": "ash",
        "label": "Ash",
        "swatch": "#8b8378",
        "inStock": true
      },
      {
        "id": "slate",
        "label": "Slate",
        "swatch": "#4a5a5f",
        "inStock": true
      },
      {
        "id": "sand",
        "label": "Sand",
        "swatch": "#d9c9a8",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Material",
        "value": "Glazed ceramic"
      },
      {
        "label": "Drainage",
        "value": "Yes, includes saucer"
      },
      {
        "label": "Diameter",
        "value": "6in"
      }
    ],
    "createdAt": "2026-07-02"
  },
  {
    "id": "p17",
    "slug": "matte-black-cylinder-pot",
    "name": "Matte Black Cylinder Pot",
    "price": 48,
    "compareAtPrice": 60,
    "category": "Vessels",
    "categorySlug": "vessels",
    "badge": "Sale",
    "rating": 4.2,
    "reviewCount": 70,
    "description": "Matte Black Cylinder Pot is made for plants that outgrew their nursery pot. Features powder-coated steel, modern minimalist profile, sized to work with our most popular plant varieties.",
    "inStock": true,
    "stockCount": 22,
    "variants": [
      {
        "id": "ash",
        "label": "Ash",
        "swatch": "#8b8378",
        "inStock": true
      },
      {
        "id": "slate",
        "label": "Slate",
        "swatch": "#4a5a5f",
        "inStock": true
      },
      {
        "id": "sand",
        "label": "Sand",
        "swatch": "#d9c9a8",
        "inStock": false
      }
    ],
    "specs": [
      {
        "label": "Material",
        "value": "Glazed ceramic"
      },
      {
        "label": "Drainage",
        "value": "Yes, includes saucer"
      },
      {
        "label": "Diameter",
        "value": "6in"
      }
    ],
    "createdAt": "2026-06-23"
  },
  {
    "id": "p18",
    "slug": "fluted-ceramic-planter",
    "name": "Fluted Ceramic Planter",
    "price": 52,
    "category": "Vessels",
    "categorySlug": "vessels",
    "badge": "Low stock",
    "rating": 3.9,
    "reviewCount": 83,
    "description": "Fluted Ceramic Planter is made for plants that outgrew their nursery pot. Features ridged texture, available in three sizes, sized to work with our most popular plant varieties.",
    "inStock": true,
    "stockCount": 2,
    "variants": [
      {
        "id": "ash",
        "label": "Ash",
        "swatch": "#8b8378",
        "inStock": true
      },
      {
        "id": "slate",
        "label": "Slate",
        "swatch": "#4a5a5f",
        "inStock": true
      },
      {
        "id": "sand",
        "label": "Sand",
        "swatch": "#d9c9a8",
        "inStock": true
      }
    ],
    "specs": [
      {
        "label": "Material",
        "value": "Glazed ceramic"
      },
      {
        "label": "Drainage",
        "value": "Yes, includes saucer"
      },
      {
        "label": "Diameter",
        "value": "10in"
      }
    ],
    "createdAt": "2026-06-14"
  },
  {
    "id": "p19",
    "slug": "brass-plant-mister",
    "name": "Brass Plant Mister",
    "price": 28,
    "category": "Tools",
    "categorySlug": "tools",
    "badge": "Bestseller",
    "rating": 4.4,
    "reviewCount": 18,
    "description": "Brass Plant Mister: fine mist nozzle, solid brass, ages naturally. Built to last a few plant-parenting eras, not one season.",
    "inStock": true,
    "stockCount": 10,
    "variants": [],
    "specs": [
      {
        "label": "Material",
        "value": "Solid brass / carbon steel"
      },
      {
        "label": "Care",
        "value": "Hand wash, dry before storing"
      }
    ],
    "createdAt": "2026-07-29"
  },
  {
    "id": "p20",
    "slug": "precision-pruning-shears",
    "name": "Precision Pruning Shears",
    "price": 24,
    "category": "Tools",
    "categorySlug": "tools",
    "rating": 4.2,
    "reviewCount": 31,
    "description": "Precision Pruning Shears: carbon steel blade, for clean cuts that heal fast. Built to last a few plant-parenting eras, not one season.",
    "inStock": true,
    "stockCount": 13,
    "variants": [],
    "specs": [
      {
        "label": "Material",
        "value": "Solid brass / carbon steel"
      },
      {
        "label": "Care",
        "value": "Hand wash, dry before storing"
      }
    ],
    "createdAt": "2026-07-20"
  },
  {
    "id": "p21",
    "slug": "soil-moisture-meter",
    "name": "Soil Moisture Meter",
    "price": 18,
    "category": "Tools",
    "categorySlug": "tools",
    "badge": "New",
    "rating": 4,
    "reviewCount": 44,
    "description": "Soil Moisture Meter: no batteries required, reads 3 depths. Built to last a few plant-parenting eras, not one season.",
    "inStock": true,
    "stockCount": 16,
    "variants": [],
    "specs": [
      {
        "label": "Material",
        "value": "Solid brass / carbon steel"
      },
      {
        "label": "Care",
        "value": "Hand wash, dry before storing"
      }
    ],
    "createdAt": "2026-07-11"
  },
  {
    "id": "p22",
    "slug": "watering-can-1-5l",
    "name": "Watering Can \u2014 1.5L",
    "price": 32,
    "category": "Tools",
    "categorySlug": "tools",
    "rating": 4,
    "reviewCount": 57,
    "description": "Watering Can \u2014 1.5L: long spout for tight spaces, powder-coated finish. Built to last a few plant-parenting eras, not one season.",
    "inStock": true,
    "stockCount": 19,
    "variants": [],
    "specs": [
      {
        "label": "Material",
        "value": "Solid brass / carbon steel"
      },
      {
        "label": "Care",
        "value": "Hand wash, dry before storing"
      }
    ],
    "createdAt": "2026-07-02"
  },
  {
    "id": "p23",
    "slug": "bamboo-plant-stakes-set-of-6",
    "name": "Bamboo Plant Stakes (Set of 6)",
    "price": 14,
    "compareAtPrice": 18,
    "category": "Tools",
    "categorySlug": "tools",
    "badge": "Sale",
    "rating": 4,
    "reviewCount": 70,
    "description": "Bamboo Plant Stakes (Set of 6): for climbing and top-heavy stems. Built to last a few plant-parenting eras, not one season.",
    "inStock": true,
    "stockCount": 22,
    "variants": [],
    "specs": [
      {
        "label": "Material",
        "value": "Solid brass / carbon steel"
      },
      {
        "label": "Care",
        "value": "Hand wash, dry before storing"
      }
    ],
    "createdAt": "2026-06-23"
  },
  {
    "id": "p24",
    "slug": "grow-light-full-spectrum",
    "name": "Grow Light \u2014 Full Spectrum",
    "price": 74,
    "category": "Tools",
    "categorySlug": "tools",
    "badge": "Low stock",
    "rating": 4.5,
    "reviewCount": 83,
    "description": "Grow Light \u2014 Full Spectrum: clips onto shelving, timer built in. Built to last a few plant-parenting eras, not one season.",
    "inStock": true,
    "stockCount": 2,
    "variants": [],
    "specs": [
      {
        "label": "Material",
        "value": "Solid brass / carbon steel"
      },
      {
        "label": "Care",
        "value": "Hand wash, dry before storing"
      }
    ],
    "createdAt": "2026-06-14"
  }
];
