import { PAGINATION_WEIGHT_UNIT_PX } from './constants';

export function toPageWeight(px) {
  const value = Math.max(0, Number(px) || 0);
  return Math.max(1, Math.ceil(value / PAGINATION_WEIGHT_UNIT_PX));
}

export function toPageCapacity(px) {
  const value = Math.max(0, Number(px) || 0);
  return Math.max(1, Math.floor(value / PAGINATION_WEIGHT_UNIT_PX));
}
