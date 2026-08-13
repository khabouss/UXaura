export default {
  routes: {
    'src/pages/Home.jsx': '/',
    'src/pages/Product.jsx': '/product',
    // Rendered only from Home today — if it were shared across routes,
    // it'd need one data-uxa-id per usage site instead of a file mapping.
    'src/components/Newsletter.jsx': '/',
  },
}
