import type { BlogPost } from '@/types/blog';

/** Mock journal content — static data, not MSW-backed (see README). */
export const blogPosts: BlogPost[] = [
  {
    "slug": "winter-light-guide",
    "title": "A realistic guide to winter light",
    "excerpt": "Most plants don't die in winter from cold \u2014 they die from a light budget nobody accounted for.",
    "content": [
      "Every autumn, the same message shows up in our inbox: a plant that was thriving all summer suddenly starts dropping leaves in November. The instinct is to blame the cold, but in most homes the temperature barely changes. What changes is light \u2014 and by a lot more than people expect.",
      "A north-facing window that reads as \"bright\" in July can lose 60-70% of its usable light by December, simply because the sun's angle drops. Your plant isn't sick. It's on a budget it can't meet.",
      "The fix isn't always a grow light, though that helps. Start by moving sensitive plants \u2014 fiddle leaf figs, calatheas \u2014 closer to the brightest window in the house, even if that means an awkward corner of the living room for four months. Rotate weekly so growth doesn't lean permanently toward the glass.",
      "And stop watering on the same schedule you used in summer. Less light means slower growth means less water uptake. Overwatering a winter-dormant plant is the second most common way people accidentally kill something that would have been fine."
    ],
    "category": "Plant Care",
    "tags": [
      "light",
      "winter",
      "care basics"
    ],
    "author": "Priya M.",
    "readTimeMinutes": 5,
    "publishedAt": "2026-08-21",
    "featured": true
  },
  {
    "slug": "repotting-without-shock",
    "title": "Repotting without shocking the plant",
    "excerpt": "The three signs a plant is ready to move up a pot size, and the two it isn't.",
    "content": [
      "Repotting is one of those tasks people either do far too often (chasing a bigger pot every few months because it feels productive) or put off for years out of fear of hurting the plant. Both instincts are understandable and both are usually wrong.",
      "Ready to repot: roots visibly circling the drainage hole, water running straight through without the soil absorbing it, or growth that's stalled despite good light and a recent feeding season.",
      "Not ready: a plant that's merely gotten taller (height isn't a root signal), or one that's just been through a stressful move \u2014 new light, new humidity. Repotting on top of relocation stress compounds the shock instead of helping.",
      "When you do repot, go up one pot size, not three. A pot that's dramatically larger than the root ball holds excess moisture the roots can't use, which is a fast path to rot."
    ],
    "category": "Plant Care",
    "tags": [
      "repotting",
      "roots",
      "care basics"
    ],
    "author": "Daniel K.",
    "readTimeMinutes": 6,
    "publishedAt": "2026-08-13",
    "featured": false
  },
  {
    "slug": "vessel-drainage-explained",
    "title": "Drainage holes are not optional",
    "excerpt": "Why a beautiful pot with no drainage is a slow-motion problem, and what to do about it.",
    "content": [
      "We get asked constantly whether a gorgeous drainage-free ceramic pot is fine to plant directly into. It isn't, and the reason is simple: soil that can't drain stays wet at the bottom long after the surface looks dry, and roots sitting in standing water suffocate before they rot.",
      "The fix isn't to skip the pot \u2014 it's to use it as a cachepot. Keep the plant in its plastic nursery pot (with drainage) and set that inside the decorative vessel. Water normally, then tip out any runoff that collects in the bottom after 20 minutes.",
      "If you really want to plant directly into a drainage-free vessel, a thick gravel layer at the bottom does not create real drainage \u2014 it just raises the water table inside the pot. It's a persistent myth worth retiring."
    ],
    "category": "Vessels & Care",
    "tags": [
      "drainage",
      "pots",
      "care basics"
    ],
    "author": "Amara O.",
    "readTimeMinutes": 4,
    "publishedAt": "2026-08-06",
    "featured": false
  },
  {
    "slug": "low-light-that-actually-works",
    "title": "Low-light plants that actually tolerate low light",
    "excerpt": "\"Low light\" gets stamped on plant tags that mean \"will survive a while\" rather than \"will thrive.\" Here's the real list.",
    "content": [
      "Plant tags are optimistic by design \u2014 a tag that says \"low light\" is trying to sell a plant, not describe a windowless hallway accurately. Most \"low-light\" plants actually mean medium indirect light, and will slowly decline in a genuinely dim room.",
      "The plants that hold up in truly low light \u2014 a few feet from a north window, or a room with only artificial light for most of the day \u2014 are a much shorter list: ZZ plant, snake plant, and pothos are the reliable three. Cast iron plant is a close fourth if you can find one.",
      "Everything else marketed as low-light \u2014 calathea, peace lily, most ferns \u2014 wants bright indirect light and will simply survive longer than a sun-loving plant in a dim spot, not thrive there."
    ],
    "category": "Plant Care",
    "tags": [
      "low light",
      "recommendations"
    ],
    "author": "Wei L.",
    "readTimeMinutes": 5,
    "publishedAt": "2026-07-29",
    "featured": false
  },
  {
    "slug": "pet-safe-plants-that-dont-look-boring",
    "title": "Pet-safe plants that don't look like a compromise",
    "excerpt": "Non-toxic doesn't have to mean plain. A working list organized by the look you're actually going for.",
    "content": [
      "The pet-safe plant list online is usually the same six spider-plant-adjacent options, repeated across a dozen articles. If you want the dramatic, architectural look of a monstera or fiddle leaf fig but have a cat that eats everything, there are real alternatives.",
      "For big dramatic leaves: try a Calathea orbifolia or a mature Boston fern \u2014 both non-toxic and both read as substantial in a room, not like an afterthought.",
      "For trailing vines (pothos is toxic, unfortunately a common mix-up): use a String of Hearts or a non-toxic Peperomia variety instead \u2014 similar cascading habit, no ASPCA warning.",
      "Always double-check against the current ASPCA plant list before buying, since \"pet safe\" advice online is inconsistent and sometimes outdated."
    ],
    "category": "Design",
    "tags": [
      "pet safe",
      "recommendations"
    ],
    "author": "Sofia R.",
    "readTimeMinutes": 6,
    "publishedAt": "2026-07-21",
    "featured": false
  },
  {
    "slug": "styling-plants-like-a-room-not-a-shelf",
    "title": "Styling plants like a room, not a shelf",
    "excerpt": "The difference between a room with plants and a plant shop is almost entirely about scale and grouping.",
    "content": [
      "The most common styling mistake isn't a wrong plant choice \u2014 it's treating every plant as a solo act, evenly spaced around a room like furniture showroom displays. Real rooms group plants the way they group books: in uneven clusters of varying height.",
      "Start with one large anchor plant per seating area \u2014 something floor-standing, 3-4 feet tall. Then build a cluster of 2-3 smaller plants at different heights nearby using plant stands or a stacked side table, rather than lining pots up in a row.",
      "Leave visible negative space between clusters. A room that's plant-dense everywhere reads as cluttered; a room with two or three confident groupings and breathing room between them reads as designed."
    ],
    "category": "Design",
    "tags": [
      "styling",
      "interior design"
    ],
    "author": "Marcus T.",
    "readTimeMinutes": 5,
    "publishedAt": "2026-07-13",
    "featured": false
  },
  {
    "slug": "why-your-plant-drops-leaves-after-a-move",
    "title": "Why your plant drops leaves after every move",
    "excerpt": "It's not you. Moving is genuinely stressful for a plant, and the leaf drop is a predictable, temporary response.",
    "content": [
      "A ficus that sheds a third of its leaves within two weeks of arriving in a new home isn't dying \u2014 it's responding to a sudden change in light direction, humidity, and airflow, all at once. This is common enough that growers have a name for it: transplant shock, even when no repotting happened.",
      "The plant is essentially recalibrating which leaves are worth the energy to maintain under the new conditions, and shedding the ones that don't pencil out. It's wasteful-looking but usually not fatal.",
      "The best response is to do nothing dramatic: don't repot, don't heavily fertilize, don't move it again chasing better light. Let it sit in one reasonably bright spot for six to eight weeks and new growth typically resumes."
    ],
    "category": "Plant Care",
    "tags": [
      "troubleshooting",
      "care basics"
    ],
    "author": "Ingrid B.",
    "readTimeMinutes": 4,
    "publishedAt": "2026-07-05",
    "featured": false
  },
  {
    "slug": "ceramic-vs-terracotta-vs-plastic",
    "title": "Ceramic vs. terracotta vs. plastic: what the material actually does",
    "excerpt": "The pot material changes watering frequency more than almost any other variable \u2014 here's the honest breakdown.",
    "content": [
      "Terracotta is porous, which means it wicks moisture out through the walls of the pot, not just the drainage hole. Plants in terracotta dry out noticeably faster than the same plant in glazed ceramic or plastic \u2014 good for succulents and anything prone to rot, less convenient if you travel often.",
      "Glazed ceramic behaves like plastic from a drainage standpoint (the glaze seals the porous clay underneath), but adds weight and, usually, a drainage hole plus saucer \u2014 check before buying, since some decorative ceramic skips drainage entirely.",
      "Plastic nursery pots are lightweight, retain moisture longest, and are what most plants ship in for a reason: predictable watering. Keeping a plant in its plastic pot and using a ceramic vessel purely as a cachepot is the easiest way to get the best of both."
    ],
    "category": "Vessels & Care",
    "tags": [
      "pots",
      "materials"
    ],
    "author": "Tomas V.",
    "readTimeMinutes": 5,
    "publishedAt": "2026-06-27",
    "featured": false
  },
  {
    "slug": "the-humidity-tray-myth",
    "title": "Does a humidity tray actually do anything?",
    "excerpt": "A popular DIY trick, tested against what's actually happening to the air around your plant.",
    "content": [
      "The pebble-and-water humidity tray is one of the most repeated pieces of plant advice online, and the honest answer is: it does something, but far less than people assume. The water evaporating from a small tray raises humidity in the immediate few inches directly above it, not the room.",
      "If your plant's leaves are more than a couple inches above the tray's surface, the effect is close to negligible. A tray works best for compact plants sitting directly on or very near it, like a small fern or moss terrarium edge.",
      "For a meaningful humidity increase across a whole plant or shelf, a small humidifier does more in one hour than a tray does in a week. Grouping plants together also helps, since transpiration from each plant slightly raises the humidity around its neighbors."
    ],
    "category": "Plant Care",
    "tags": [
      "humidity",
      "myths"
    ],
    "author": "Nadia F.",
    "readTimeMinutes": 4,
    "publishedAt": "2026-06-20",
    "featured": false
  },
  {
    "slug": "gifting-a-plant-that-survives-shipping",
    "title": "How to gift a plant that survives the trip",
    "excerpt": "Not every plant ships well. A practical list for picking a gift that arrives looking like the photo.",
    "content": [
      "Some plants are simply bad shipping candidates \u2014 thin, brittle leaves that snap in transit, or fast-wilting foliage that needs consistent humidity a cardboard box can't provide. If you're gifting sight-unseen, the plant matters as much as the packaging.",
      "Reliable shippers: snake plant, ZZ plant, pothos, and most succulents \u2014 all tolerate a few days in the dark without water and bounce back quickly. Fussier options \u2014 calathea, ferns, anything variegated and thin-leaved \u2014 arrive fine more often than not, but the margin for error is smaller.",
      "If the recipient is a first-time plant owner, bias toward the reliable list regardless of what looks most impressive in a listing photo. A plant that survives their first month matters more than one that photographs well on delivery day."
    ],
    "category": "Design",
    "tags": [
      "gifting",
      "recommendations"
    ],
    "author": "Owen P.",
    "readTimeMinutes": 5,
    "publishedAt": "2026-06-13",
    "featured": false
  }
];

export const blogCategories: string[] = [...new Set(blogPosts.map((p) => p.category))];
