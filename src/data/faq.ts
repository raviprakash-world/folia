export interface FaqEntry {
  category: string;
  question: string;
  answer: string;
}

export const faqEntries: FaqEntry[] = [
  {
    category: 'Orders & Shipping',
    question: 'How long does shipping take?',
    answer: 'Most orders ship within 1–2 business days. Delivery is typically 2–4 business days for closer regions and 4–6 for farther ones — you can get an exact estimate at checkout by entering your ZIP code.',
  },
  {
    category: 'Orders & Shipping',
    question: 'Do you ship internationally?',
    answer: "Not currently — we only ship within the countries listed at checkout. We're working on expanding this.",
  },
  {
    category: 'Orders & Shipping',
    question: 'Can I change my shipping address after ordering?',
    answer: "Yes, as long as the order hasn't shipped yet. Contact us with your order number and the new address.",
  },
  {
    category: 'Orders & Shipping',
    question: 'My order arrived and something is missing. What do I do?',
    answer: 'Reach out through the Contact page with your order number within 7 days of delivery and we\u2019ll sort it out — no need to send anything back first.',
  },
  {
    category: 'Plant Care',
    question: 'What if my plant arrives damaged?',
    answer: 'Photograph it within 48 hours of delivery and reach out through Contact. We replace it at no cost under the 30-day health guarantee.',
  },
  {
    category: 'Plant Care',
    question: 'Do plants come with care instructions?',
    answer: 'Yes — every plant ships with a care card specific to that species, covering light, watering frequency, and common issues to watch for.',
  },
  {
    category: 'Plant Care',
    question: 'What is the 30-day health guarantee?',
    answer: "If a plant arrives unwell or dies within 30 days of delivery despite following the included care instructions, we'll replace it once at no charge.",
  },
  {
    category: 'Returns',
    question: 'Can I return a plant?',
    answer: 'Plants are final sale once delivered, since they can\u2019t be resold — but they\u2019re covered by the 30-day health guarantee above if something goes wrong.',
  },
  {
    category: 'Returns',
    question: 'Can I return a vessel or tool?',
    answer: 'Yes — vessels and tools can be returned within 14 days of delivery if unused and in original packaging. See the full Return Policy for details.',
  },
  {
    category: 'Returns',
    question: 'How long do refunds take to process?',
    answer: 'Once a return is received, refunds are issued to the original payment method within 5–7 business days.',
  },
  {
    category: 'Account',
    question: 'Do I need an account to order?',
    answer: "No — guest checkout is fully supported. An account just lets you see order history and save details for next time.",
  },
  {
    category: 'Account',
    question: 'How do I reset my password?',
    answer: 'Use the "Forgot password" link on the login page. You\u2019ll get a reset link by email — for security, we don\u2019t confirm whether an email is registered either way.',
  },
  {
    category: 'Account',
    question: 'Can I merge my guest cart into my account after logging in?',
    answer: "Right now guest and account carts are kept separate. This is on the roadmap — see the project README for details.",
  },
];

export const faqCategories: string[] = [...new Set(faqEntries.map((e) => e.category))];
