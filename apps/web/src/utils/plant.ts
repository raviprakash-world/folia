const PLANT_CATEGORIES = ['plants', 'outdoor-plants'];

/** True for living plants (as opposed to planters, soil, tools and décor). */
export const isPlant = (categorySlug: string) => PLANT_CATEGORIES.includes(categorySlug);
