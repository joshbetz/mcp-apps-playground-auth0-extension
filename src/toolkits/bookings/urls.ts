import { getPublicBaseUrl } from '../../server/context.ts';

export function getTravelBaseUrl(): string {
  return `${getPublicBaseUrl()}/mock/travel`;
}
