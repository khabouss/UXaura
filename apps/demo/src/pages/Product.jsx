export function Product() {
  return (
    <div className="page product-page">
      <div className="product-main">
        <div data-uxa-id="product-gallery" data-uxa-route="/product" className="product-gallery">
          <div className="gallery-main" />
          <div className="gallery-thumbs">
            <div className="gallery-thumb" />
            <div className="gallery-thumb" />
            <div className="gallery-thumb" />
          </div>
        </div>

        <div className="product-info">
          <h1>Ceramic Pour-Over Set</h1>
          <div data-uxa-id="price-tag" data-uxa-route="/product" className="price-tag">
            $48.00
          </div>
          <p>Hand-glazed ceramic, walnut stand, reusable filter included.</p>
          <button className="add-to-cart">Add to cart</button>
        </div>
      </div>

      <section data-uxa-id="related-products" data-uxa-route="/product" className="related-products">
        <h3>You might also like</h3>
        <div className="related-row">
          <div className="related-card" />
          <div className="related-card" />
          <div className="related-card" />
          <div className="related-card" />
        </div>
      </section>

      <section data-uxa-id="reviews-section" data-uxa-route="/product" className="reviews-section">
        <h3>Reviews</h3>
        <div className="review">
          <strong>Dana — ★★★★★</strong>
          <p>Beautiful set, makes great coffee every morning.</p>
        </div>
        <div className="review">
          <strong>Marcus — ★★★★☆</strong>
          <p>Great quality. Wish it came in more colors.</p>
        </div>
      </section>
    </div>
  )
}
