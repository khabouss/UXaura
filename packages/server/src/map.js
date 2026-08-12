// The Map — every named part of the demo app, per route.
// In a real integration this is produced by a build-time scanner. Here it's
// hand-written to match the data-uxa-id attributes in apps/demo.

export const MAP = {
  appId: 'demo',
  buildId: 'v1',
  routes: {
    '/': {
      anchors: [
        {
          id: 'hero-carousel',
          name: 'Hero carousel',
          description: 'Large rotating promotional banner at the top of the homepage.',
        },
        {
          id: 'promo-banner',
          name: 'Promotions banner',
          description: 'Strip advertising the current site-wide promotion.',
        },
        {
          id: 'filters-sidebar',
          name: 'Filters sidebar',
          description: 'Left-hand sidebar with category and price filters.',
        },
        {
          id: 'product-grid',
          name: 'Product grid',
          description: 'The grid of product cards on the homepage.',
        },
      ],
    },
    '/product': {
      anchors: [
        {
          id: 'product-gallery',
          name: 'Product image gallery',
          description: 'The main image gallery for the product.',
        },
        {
          id: 'price-tag',
          name: 'Price',
          description: 'The displayed price of the product.',
          locked: true,
          lockReason: 'Pricing is protected and cannot be hidden or changed by users.',
        },
        {
          id: 'related-products',
          name: 'Related products',
          description: 'Carousel of related products shown below the main product.',
        },
        {
          id: 'reviews-section',
          name: 'Reviews section',
          description: 'Customer reviews for this product.',
        },
      ],
    },
  },
}

export function anchorsForRoute(route) {
  return MAP.routes[route]?.anchors ?? []
}

export function findAnchor(route, anchorId) {
  return anchorsForRoute(route).find((a) => a.id === anchorId)
}
