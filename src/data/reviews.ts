import type { Review } from '@/types/product';

/** Mock reviews served by MSW's /api/reviews handler, keyed by productId. */
export const reviews: Review[] = [
  {
    "id": "r1",
    "productId": "p1",
    "author": "Priya M.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-07-27",
    "verified": false
  },
  {
    "id": "r2",
    "productId": "p1",
    "author": "Daniel K.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-07-16",
    "verified": true
  },
  {
    "id": "r3",
    "productId": "p2",
    "author": "Daniel K.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-07-23",
    "verified": true
  },
  {
    "id": "r4",
    "productId": "p2",
    "author": "Amara O.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-07-12",
    "verified": true
  },
  {
    "id": "r5",
    "productId": "p2",
    "author": "Wei L.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-07-01",
    "verified": true
  },
  {
    "id": "r6",
    "productId": "p3",
    "author": "Amara O.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-07-19",
    "verified": true
  },
  {
    "id": "r7",
    "productId": "p3",
    "author": "Wei L.",
    "rating": 4,
    "title": "Solid pick",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-07-08",
    "verified": true
  },
  {
    "id": "r8",
    "productId": "p3",
    "author": "Sofia R.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-27",
    "verified": false
  },
  {
    "id": "r9",
    "productId": "p3",
    "author": "Marcus T.",
    "rating": 5,
    "title": "Arrived in great shape",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-06-16",
    "verified": true
  },
  {
    "id": "r10",
    "productId": "p4",
    "author": "Wei L.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-07-15",
    "verified": true
  },
  {
    "id": "r11",
    "productId": "p4",
    "author": "Sofia R.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-07-04",
    "verified": false
  },
  {
    "id": "r12",
    "productId": "p5",
    "author": "Sofia R.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-07-11",
    "verified": false
  },
  {
    "id": "r13",
    "productId": "p5",
    "author": "Marcus T.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-06-30",
    "verified": true
  },
  {
    "id": "r14",
    "productId": "p5",
    "author": "Ingrid B.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-19",
    "verified": true
  },
  {
    "id": "r15",
    "productId": "p6",
    "author": "Marcus T.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-07-07",
    "verified": true
  },
  {
    "id": "r16",
    "productId": "p6",
    "author": "Ingrid B.",
    "rating": 4,
    "title": "Solid pick",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-06-26",
    "verified": true
  },
  {
    "id": "r17",
    "productId": "p6",
    "author": "Tomas V.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-15",
    "verified": true
  },
  {
    "id": "r18",
    "productId": "p6",
    "author": "Nadia F.",
    "rating": 5,
    "title": "Arrived in great shape",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-06-04",
    "verified": false
  },
  {
    "id": "r19",
    "productId": "p7",
    "author": "Ingrid B.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-07-03",
    "verified": true
  },
  {
    "id": "r20",
    "productId": "p7",
    "author": "Tomas V.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-06-22",
    "verified": true
  },
  {
    "id": "r21",
    "productId": "p8",
    "author": "Tomas V.",
    "rating": 3,
    "title": "It\u2019s fine",
    "body": "It\u2019s okay \u2014 smaller than the photos implied but healthy enough.",
    "date": "2026-06-29",
    "verified": true
  },
  {
    "id": "r22",
    "productId": "p8",
    "author": "Nadia F.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-06-18",
    "verified": false
  },
  {
    "id": "r23",
    "productId": "p8",
    "author": "Owen P.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-07",
    "verified": true
  },
  {
    "id": "r24",
    "productId": "p9",
    "author": "Nadia F.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-06-25",
    "verified": false
  },
  {
    "id": "r25",
    "productId": "p9",
    "author": "Owen P.",
    "rating": 3,
    "title": "Does the job",
    "body": "Fine overall, care instructions could have been more specific to my climate.",
    "date": "2026-06-14",
    "verified": true
  },
  {
    "id": "r26",
    "productId": "p9",
    "author": "Priya M.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-03",
    "verified": true
  },
  {
    "id": "r27",
    "productId": "p9",
    "author": "Daniel K.",
    "rating": 5,
    "title": "Arrived in great shape",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-05-23",
    "verified": true
  },
  {
    "id": "r28",
    "productId": "p10",
    "author": "Owen P.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-21",
    "verified": true
  },
  {
    "id": "r29",
    "productId": "p10",
    "author": "Priya M.",
    "rating": 4,
    "title": "Solid pick",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-06-10",
    "verified": true
  },
  {
    "id": "r30",
    "productId": "p11",
    "author": "Priya M.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-17",
    "verified": true
  },
  {
    "id": "r31",
    "productId": "p11",
    "author": "Daniel K.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-06-06",
    "verified": true
  },
  {
    "id": "r32",
    "productId": "p11",
    "author": "Amara O.",
    "rating": 4,
    "title": "Happy with it",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-05-26",
    "verified": false
  },
  {
    "id": "r33",
    "productId": "p12",
    "author": "Daniel K.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-06-13",
    "verified": true
  },
  {
    "id": "r34",
    "productId": "p12",
    "author": "Amara O.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-06-02",
    "verified": false
  },
  {
    "id": "r35",
    "productId": "p12",
    "author": "Wei L.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-05-22",
    "verified": true
  },
  {
    "id": "r36",
    "productId": "p12",
    "author": "Sofia R.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-05-11",
    "verified": true
  },
  {
    "id": "r37",
    "productId": "p13",
    "author": "Amara O.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-09",
    "verified": false
  },
  {
    "id": "r38",
    "productId": "p13",
    "author": "Wei L.",
    "rating": 4,
    "title": "Solid pick",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-05-29",
    "verified": true
  },
  {
    "id": "r39",
    "productId": "p14",
    "author": "Wei L.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-06-05",
    "verified": true
  },
  {
    "id": "r40",
    "productId": "p14",
    "author": "Sofia R.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-05-25",
    "verified": true
  },
  {
    "id": "r41",
    "productId": "p14",
    "author": "Marcus T.",
    "rating": 4,
    "title": "Happy with it",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-05-14",
    "verified": true
  },
  {
    "id": "r42",
    "productId": "p15",
    "author": "Sofia R.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-06-01",
    "verified": true
  },
  {
    "id": "r43",
    "productId": "p15",
    "author": "Marcus T.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-05-21",
    "verified": true
  },
  {
    "id": "r44",
    "productId": "p15",
    "author": "Ingrid B.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-05-10",
    "verified": false
  },
  {
    "id": "r45",
    "productId": "p15",
    "author": "Tomas V.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-04-29",
    "verified": true
  },
  {
    "id": "r46",
    "productId": "p16",
    "author": "Marcus T.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-05-28",
    "verified": true
  },
  {
    "id": "r47",
    "productId": "p16",
    "author": "Ingrid B.",
    "rating": 4,
    "title": "Solid pick",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-05-17",
    "verified": false
  },
  {
    "id": "r48",
    "productId": "p17",
    "author": "Ingrid B.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-05-24",
    "verified": false
  },
  {
    "id": "r49",
    "productId": "p17",
    "author": "Tomas V.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-05-13",
    "verified": true
  },
  {
    "id": "r50",
    "productId": "p17",
    "author": "Nadia F.",
    "rating": 4,
    "title": "Happy with it",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-05-02",
    "verified": true
  },
  {
    "id": "r51",
    "productId": "p18",
    "author": "Tomas V.",
    "rating": 3,
    "title": "It\u2019s fine",
    "body": "It\u2019s okay \u2014 smaller than the photos implied but healthy enough.",
    "date": "2026-05-20",
    "verified": true
  },
  {
    "id": "r52",
    "productId": "p18",
    "author": "Nadia F.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-05-09",
    "verified": true
  },
  {
    "id": "r53",
    "productId": "p18",
    "author": "Owen P.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-04-28",
    "verified": true
  },
  {
    "id": "r54",
    "productId": "p18",
    "author": "Priya M.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-04-17",
    "verified": false
  },
  {
    "id": "r55",
    "productId": "p19",
    "author": "Nadia F.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-05-16",
    "verified": true
  },
  {
    "id": "r56",
    "productId": "p19",
    "author": "Owen P.",
    "rating": 3,
    "title": "Does the job",
    "body": "Fine overall, care instructions could have been more specific to my climate.",
    "date": "2026-05-05",
    "verified": true
  },
  {
    "id": "r57",
    "productId": "p20",
    "author": "Owen P.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-05-12",
    "verified": true
  },
  {
    "id": "r58",
    "productId": "p20",
    "author": "Priya M.",
    "rating": 4,
    "title": "Solid pick",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-05-01",
    "verified": false
  },
  {
    "id": "r59",
    "productId": "p20",
    "author": "Daniel K.",
    "rating": 3,
    "title": "It\u2019s fine",
    "body": "It\u2019s okay \u2014 smaller than the photos implied but healthy enough.",
    "date": "2026-04-20",
    "verified": true
  },
  {
    "id": "r60",
    "productId": "p21",
    "author": "Priya M.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-05-08",
    "verified": false
  },
  {
    "id": "r61",
    "productId": "p21",
    "author": "Daniel K.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-04-27",
    "verified": true
  },
  {
    "id": "r62",
    "productId": "p21",
    "author": "Amara O.",
    "rating": 4,
    "title": "Happy with it",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-04-16",
    "verified": true
  },
  {
    "id": "r63",
    "productId": "p21",
    "author": "Wei L.",
    "rating": 3,
    "title": "Does the job",
    "body": "Fine overall, care instructions could have been more specific to my climate.",
    "date": "2026-04-05",
    "verified": true
  },
  {
    "id": "r64",
    "productId": "p22",
    "author": "Daniel K.",
    "rating": 4,
    "title": "Good, minor issue",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-05-04",
    "verified": true
  },
  {
    "id": "r65",
    "productId": "p22",
    "author": "Amara O.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-04-23",
    "verified": true
  },
  {
    "id": "r66",
    "productId": "p23",
    "author": "Amara O.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-04-30",
    "verified": true
  },
  {
    "id": "r67",
    "productId": "p23",
    "author": "Wei L.",
    "rating": 4,
    "title": "Solid pick",
    "body": "Good quality, just took a little longer to arrive than the estimate suggested.",
    "date": "2026-04-19",
    "verified": true
  },
  {
    "id": "r68",
    "productId": "p23",
    "author": "Sofia R.",
    "rating": 5,
    "title": "Would buy again",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-04-08",
    "verified": false
  },
  {
    "id": "r69",
    "productId": "p24",
    "author": "Wei L.",
    "rating": 5,
    "title": "Exceeded expectations",
    "body": "Arrived healthy and bigger than I expected. No shock, no drooping \u2014 settled in within a week.",
    "date": "2026-04-26",
    "verified": true
  },
  {
    "id": "r70",
    "productId": "p24",
    "author": "Sofia R.",
    "rating": 5,
    "title": "Exactly as described",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-04-15",
    "verified": false
  },
  {
    "id": "r71",
    "productId": "p24",
    "author": "Marcus T.",
    "rating": 4,
    "title": "Happy with it",
    "body": "One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.",
    "date": "2026-04-04",
    "verified": true
  },
  {
    "id": "r72",
    "productId": "p24",
    "author": "Ingrid B.",
    "rating": 5,
    "title": "Arrived in great shape",
    "body": "Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.",
    "date": "2026-03-24",
    "verified": true
  }
];
