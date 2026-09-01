export interface PolicySection {
  heading: string;
  body: string;
}

export interface Policy {
  slug: string;
  title: string;
  updatedAt: string;
  sections: PolicySection[];
}

export const policies: Policy[] = [
  {
    slug: 'shipping',
    title: 'Shipping Policy',
    updatedAt: '2026-07-01',
    sections: [
      {
        heading: 'Processing time',
        body: 'Orders ship within 1–2 business days of being placed. You\u2019ll get a shipping confirmation as soon as your order leaves our partner nursery or warehouse.',
      },
      {
        heading: 'Delivery estimates',
        body: 'Delivery windows depend on your ZIP code — enter it at checkout or in your cart for an exact estimate. As a rough guide, most orders arrive within 2–6 business days.',
      },
      {
        heading: 'Free shipping threshold',
        body: 'Orders over $75 ship free. Orders under that threshold are charged a flat rate based on your region, shown before you check out.',
      },
      {
        heading: 'Plant-specific packaging',
        body: 'Live plants ship with internal bracing to keep soil and stems in place, plus breathable air holes — not sealed in plastic, which causes more damage than it prevents.',
      },
    ],
  },
  {
    slug: 'returns',
    title: 'Return Policy',
    updatedAt: '2026-07-01',
    sections: [
      {
        heading: 'Plants',
        body: 'Live plants are final sale once delivered, since they can\u2019t be resold. They\u2019re covered separately by our 30-day health guarantee: if a plant arrives unwell or dies within 30 days despite following the included care card, we replace it once at no charge.',
      },
      {
        heading: 'Vessels & tools',
        body: 'Vessels and tools can be returned within 14 days of delivery if unused, undamaged, and in original packaging. Contact us for a return authorization before sending anything back.',
      },
      {
        heading: 'Refund timing',
        body: 'Once we receive a return, refunds are issued to the original payment method within 5–7 business days.',
      },
      {
        heading: 'Damaged on arrival',
        body: 'If anything arrives damaged, photograph it within 48 hours and reach out through Contact — we\u2019ll sort out a replacement or refund without asking you to ship it back first.',
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    updatedAt: '2026-06-15',
    sections: [
      {
        heading: 'What we collect',
        body: 'Name, email, shipping address, and order history when you place an order or create an account. If you contact us, we keep the message and your reply details to resolve the request.',
      },
      {
        heading: 'What we don\u2019t do',
        body: 'We don\u2019t sell your personal information to third parties, and we don\u2019t share it beyond what\u2019s needed to fulfill and ship an order (payment processing, carrier handoff).',
      },
      {
        heading: 'Cookies',
        body: 'We use functional cookies for cart persistence and session state — nothing for third-party ad tracking.',
      },
      {
        heading: 'Your rights',
        body: 'You can request a copy of your data or ask us to delete your account at any time through Contact.',
      },
      {
        heading: 'About this page',
        body: 'This is a portfolio project, not a real store — this policy is illustrative content, not a binding legal document.',
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    updatedAt: '2026-06-15',
    sections: [
      {
        heading: 'Using this site',
        body: 'By using this site you agree to provide accurate information when placing an order or creating an account, and not to misuse the site (attempting to disrupt service, scraping at scale, etc.).',
      },
      {
        heading: 'Pricing & availability',
        body: 'Prices and stock levels are shown in real time but aren\u2019t guaranteed until an order is confirmed — an item can occasionally sell out between browsing and checkout.',
      },
      {
        heading: 'Accounts',
        body: 'You\u2019re responsible for keeping your account credentials secure. Guest checkout is always available if you\u2019d rather not create an account.',
      },
      {
        heading: 'About this page',
        body: 'This is a portfolio project, not a real store — these terms are illustrative content, not a binding legal document.',
      },
    ],
  },
];
