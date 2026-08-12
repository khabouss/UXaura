import { Newsletter } from '../components/Newsletter.jsx'

const PRODUCTS = [
  { name: 'Canvas Tote', price: '$28', color: '#e8ded0' },
  { name: 'Wool Scarf', price: '$45', color: '#cfd8e3' },
  { name: 'Ceramic Mug', price: '$18', color: '#e3d0d0' },
  { name: 'Leather Wallet', price: '$62', color: '#ded0c8' },
  { name: 'Linen Shirt', price: '$54', color: '#d8e0d0' },
  { name: 'Desk Lamp', price: '$39', color: '#e0dcc8' },
]

export function Home() {
  return (
    <div className="page">
      <div data-uxa-id="promo-banner" className="promo-banner">
        🎉 Summer sale — up to 40% off select items. Ends soon.
      </div>

      <div data-uxa-id="hero-carousel" className="hero-carousel">
        <h1>New arrivals for every season</h1>
        <p>Curated picks, refreshed weekly.</p>
      </div>

      <div className="layout">
        <aside data-uxa-id="filters-sidebar" className="filters-sidebar">
          <h3>Filters</h3>
          <label>
            <input type="checkbox" /> In stock
          </label>
          <label>
            <input type="checkbox" /> On sale
          </label>
          <h4>Category</h4>
          <label>
            <input type="checkbox" /> Clothing
          </label>
          <label>
            <input type="checkbox" /> Accessories
          </label>
          <label>
            <input type="checkbox" /> Home
          </label>
          <h4>Price</h4>
          <label>
            <input type="checkbox" /> Under $25
          </label>
          <label>
            <input type="checkbox" /> $25–$100
          </label>
          <label>
            <input type="checkbox" /> $100+
          </label>
        </aside>

        <section data-uxa-id="product-grid" className="product-grid">
          {PRODUCTS.map((p) => (
            <div className="product-card" key={p.name}>
              <div className="product-thumb" style={{ background: p.color }} />
              <div className="product-name">{p.name}</div>
              <div className="product-price">{p.price}</div>
            </div>
          ))}
        </section>
      </div>

      <Newsletter />
    </div>
  )
}
