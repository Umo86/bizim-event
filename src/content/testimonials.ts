/**
 * Quotes from real founding businesses, added with their written permission.
 * The section on /list-your-business stays hidden while this list is empty —
 * never add invented quotes.
 */
export type Testimonial = {
  quoteTr: string;
  quoteEn: string;
  name: string;
  business: string;
  city: string;
};

export const TESTIMONIALS: Testimonial[] = [];
