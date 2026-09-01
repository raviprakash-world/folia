import { authHandlers } from './authHandlers';
import { contactHandlers } from './contactHandlers';
import { addressHandlers } from './addressHandlers';
import { trackingHandlers } from './trackingHandlers';
import { catalogHandlers } from './catalogHandlers';
import { reviewsHandlers } from './reviewsHandlers';

export const handlers = [
  ...catalogHandlers,
  ...reviewsHandlers,

  ...authHandlers,
  ...contactHandlers,
  ...addressHandlers,
  ...trackingHandlers,
];
