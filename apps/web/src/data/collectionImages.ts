/** One representative catalog photo per curated collection and per category. */
export const collectionImages: Record<string, string> = {
  'low-light-plants': 'snake-plant-laurentii',
  'statement-vessels': 'fluted-ceramic-planter',
  gifting: 'peace-lily',
  'pet-friendly': 'spider-plant',
  flowering: 'hibiscus',
  baskets: 'woven-plant-basket',
  'new-home': 'money-plant-golden-pothos',
  office: 'zz-plant',
};

export const categoryImages: Record<string, string> = {
  plants: 'monstera-deliciosa',
  'outdoor-plants': 'hibiscus',
  vessels: 'fluted-ceramic-planter',
  'soil-fertilisers': 'organic-potting-mix',
  tools: 'hand-trowel',
  'home-decor': 'wooden-plant-stand',
};

export const productPhoto = (name?: string) => (name ? `/demo/products/${name}.jpg` : undefined);
