
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { initiateMpesaCheckout, pollMpesaPayment } from './api/orders';
import { addToCart } from './api/cart';
import { fetchSellerTrust } from './api/trust';
import PaymentFormCard from './components/PaymentFormCard';
import TrustInline from './components/TrustBadge';
import { formatKsh } from './utils/currency';

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    phase: 'idle',
    submitting: false
  });
  const [phone, setPhone] = useState('');
  const [sellerTrust, setSellerTrust] = useState(null);

  const token = localStorage.getItem('authToken');

  // Use Render backend when deployed and localhost during development.
  const API_ROOT = (
    process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'
  ).replace(/\/+$/, '');

  const API_BASE = `${API_ROOT}/api/marketplace`;
  const MEDIA_BASE_URL = API_ROOT;

  // Fetch product details
  const fetchProduct = useCallback(async () => {
    setLoading(true);

    try {
      // Try product detail first, fallback to marketplace filter.
      try {
        const { data } = await axios.get(`${API_BASE}/products/${id}/`);

        setProduct(data);

        if (data?.seller) {
          fetchSellerTrust(data.seller)
            .then((r) => setSellerTrust(r.data))
            .catch(() => {});
        }
      } catch {
        // Fallback to marketplace list filter.
        const { data } = await axios.get(
          `${API_BASE}/marketplace/products/`
        );

        const foundProduct = data.find(p => p.id == id);

        if (foundProduct) {
          setProduct(foundProduct);
        } else {
          setError('Product not found');
        }
      }
    } catch (err) {
      console.error(
        'FETCH_PRODUCT ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, id]);

  // Check whether the product is already in the wishlist.
  const checkWishlist = useCallback(async () => {
    if (!token) return;

    try {
      const { data } = await axios.get(`${API_BASE}/wishlist/`, {
        headers: {
          Authorization: `Token ${token}`
        }
      });

      setInWishlist(
        data.some(item => item.product === parseInt(id, 10))
      );
    } catch (err) {
      console.error(
        'WISHLIST_CHECK ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );
    }
  }, [API_BASE, token, id]);

  useEffect(() => {
    // Increment view count on page load (non-blocking).
    axios.patch(`${API_BASE}/products/${id}/increment-view/`)
      .then(res => console.log('VIEW incremented:', res.data.views))
      .catch(err => console.error(
        'VIEW INCREMENT ERROR:',
        err.response?.status
      ));

    fetchProduct();

    if (token) {
      checkWishlist();
    }
  }, [id, API_BASE, token, fetchProduct, checkWishlist]);

  // Toggle wishlist.
  const toggleWishlist = async () => {
    if (!token) {
      setError('Please login to add items to your wishlist');
      navigate('/login');
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE}/wishlist/${id}/toggle/`,
        {},
        {
          headers: {
            Authorization: `Token ${token}`
          }
        }
      );

      setInWishlist(!inWishlist);
      setSuccess(res.data.message || 'Wishlist updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(
        'WISHLIST_UPDATE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      setError('Failed to update wishlist');
    }
  };

  // Open payment modal.
  const openPaymentModal = () => {
    const units = product.units_available ?? 1;

    if (units <= 0) {
      setError('This item is out of stock');
      return;
    }

    if (!token) {
      setError('Please login to place order');
      navigate('/login');
      return;
    }

    if (quantity > units) {
      setError(`Only ${units} unit(s) available`);
      return;
    }

    setError('');

    setPaymentModal({
      open: true,
      phase: 'idle',
      submitting: false
    });
  };

  // Add product to cart.
  const handleAddToCart = async () => {
    if ((product.units_available ?? 1) <= 0) {
      setError('This item is out of stock');
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    setAddingToCart(true);
    setError('');

    try {
      await addToCart(parseInt(id, 10), quantity);

      setSuccess('Added to cart!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err.response?.data?.error || 'Failed to add to cart'
      );
    } finally {
      setAddingToCart(false);
    }
  };

  // Close payment modal.
  const closePaymentModal = () => {
    setPaymentModal({
      open: false,
      phase: 'idle',
      submitting: false
    });

    setPhone('');
  };

  // Submit M-Pesa payment.
  const submitPayment = useCallback(async () => {
    if (!phone.trim()) {
      setError('Enter your M-Pesa phone number');
      return;
    }

    setPaymentModal(p => ({
      ...p,
      submitting: true,
      phase: 'initiating'
    }));

    setError('');

    try {
      const stk = await initiateMpesaCheckout({
        productId: parseInt(id, 10),
        quantity,
        phone: phone.trim()
      });

      const checkoutId = stk.checkout_request_id;

      if (!checkoutId) {
        throw new Error('Could not start M-Pesa payment');
      }

      setPaymentModal(p => ({
        ...p,
        phase: 'waiting'
      }));

      let attempts = 0;

      const waitForPayment = async () => {
        const status = await pollMpesaPayment(checkoutId);

        if (status.status === 'completed') {
          setPaymentModal(p => ({
            ...p,
            phase: 'success',
            submitting: false
          }));

          setSuccess(
            'Payment successful! Your order is confirmed and funds are in escrow.'
          );

          setTimeout(() => navigate('/dashboard'), 2000);
          return;
        }

        if (
          ['failed', 'cancelled', 'timeout'].includes(status.status)
        ) {
          setError(
            status.message || 'Payment was not completed.'
          );

          setPaymentModal(p => ({
            ...p,
            phase: 'failed',
            submitting: false
          }));

          return;
        }

        if (attempts >= 30) {
          setError(
            'Payment is taking longer than expected. Check your orders in the dashboard.'
          );

          setPaymentModal(p => ({
            ...p,
            phase: 'failed',
            submitting: false
          }));

          return;
        }

        attempts += 1;
        setTimeout(waitForPayment, 2000);
      };

      waitForPayment();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.message ||
        'Payment could not be started'
      );

      setPaymentModal(p => ({
        ...p,
        phase: 'failed',
        submitting: false
      }));
    }
  }, [id, quantity, phone, navigate]);

  if (loading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '50px'
      }}>
        Loading product...
      </div>
    );
  }

  if (!product) {
    return <div>Product not found</div>;
  }

  return (
    <div style={{
      fontFamily: "'Segoe UI', sans-serif",
      paddingTop: '80px',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa'
    }}>
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0 }}>Product Details</h1>
          </div>

          <div>
            <button
              onClick={() => navigate('/marketplace')}
              style={{
                marginRight: '10px',
                background: 'white',
                color: '#667eea',
                padding: '10px 20px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ← Back to Marketplace
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'white',
                color: '#667eea',
                padding: '10px 20px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '40px 20px'
      }}>
        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#d4edda',
            color: '#155724',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            {success}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '40px',
          alignItems: 'start'
        }}>
          {/* Product Image */}
          <div>
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.title}
                style={{
                  width: '100%',
                  height: '400px',
                  objectFit: 'cover',
                  borderRadius: '16px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1)'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '400px',
                background: '#f8f9fa',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999'
              }}>
                No image
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#333'
                }}>
                  {product.title}
                </h1>

                <div style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#667eea',
                  marginTop: '10px'
                }}>
                  {formatKsh(product.price)}
                </div>
              </div>

              <button
                onClick={toggleWishlist}
                style={{
                  background: inWishlist ? '#ff6b6b' : '#f8f9fa',
                  border: '2px solid #ddd',
                  borderRadius: '50%',
                  width: '50px',
                  height: '50px',
                  cursor: 'pointer',
                  fontSize: '24px'
                }}
              >
                ❤️
              </button>
            </div>

            <div style={{
              display: 'flex',
              gap: '15px',
              marginBottom: '25px',
              flexWrap: 'wrap'
            }}>
              <span style={{
                background: '#e9ecef',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                {product.category}
              </span>

              <span style={{
                background: '#e9ecef',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                {product.condition}
              </span>

              <span style={{
                background: '#e9ecef',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                {product.location}
              </span>

              <span style={{
                background: '#e9ecef',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                Units left: {product.units_available ?? 1}
              </span>
            </div>

            {(product.units_available ?? 1) > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 600,
                  color: '#333'
                }}>
                  Quantity
                </label>

                <input
                  type="number"
                  min={1}
                  max={product.units_available ?? 1}
                  value={quantity}
                  onChange={(e) => setQuantity(
                    Math.max(
                      1,
                      Math.min(
                        product.units_available ?? 1,
                        Number(e.target.value) || 1
                      )
                    )
                  )}
                  style={{
                    width: '120px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #ddd'
                  }}
                />
              </div>
            )}

            {sellerTrust && (
              <div style={{
                marginBottom: 24,
                padding: 18,
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                borderRadius: 14,
                border: '1px solid #bbf7d0',
                boxShadow: '0 8px 24px rgba(22, 163, 74, 0.08)'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#15803d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 10
                }}>
                  Seller trust check
                </div>

                <h3 style={{
                  color: '#0f172a',
                  margin: '0 0 10px',
                  fontSize: '1.15rem'
                }}>
                  {product.seller_name}
                </h3>

                <TrustInline trust={sellerTrust} />

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 10,
                  marginTop: 14,
                  fontSize: '0.85rem',
                  color: '#334155'
                }}>
                  <div>
                    <strong>Trust score</strong>
                    <br />
                    {Number(sellerTrust.trust_score || 0).toFixed(0)}
                  </div>

                  <div>
                    <strong>Risk</strong>
                    <br />
                    {sellerTrust.risk_level}
                  </div>

                  <div>
                    <strong>Sales</strong>
                    <br />
                    {sellerTrust.completed_sales ?? 0}
                  </div>

                  <div>
                    <strong>Reviews</strong>
                    <br />
                    {sellerTrust.total_reviews ?? 0} ({sellerTrust.average_rating ?? '—'}★)
                  </div>

                  <div>
                    <strong>Dispute rate</strong>
                    <br />
                    {sellerTrust.dispute_rate ?? 0}%
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '30px' }}>
              {!sellerTrust && (
                <h3 style={{
                  color: '#333',
                  marginBottom: '15px'
                }}>
                  Seller: {product.seller_name}
                </h3>
              )}

              <p style={{
                color: '#666',
                lineHeight: 1.6
              }}>
                {product.description}
              </p>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={openPaymentModal}
                disabled={(product.units_available ?? 1) <= 0}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  background: (product.units_available ?? 1) <= 0
                    ? '#ccc'
                    : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '18px',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: (product.units_available ?? 1) <= 0
                    ? 'not-allowed'
                    : 'pointer'
                }}
              >
                🛒 {(product.units_available ?? 1) <= 0
                  ? 'Out of Stock'
                  : 'Place Order Now'}
              </button>

              <button
                onClick={handleAddToCart}
                disabled={
                  (product.units_available ?? 1) <= 0 || addingToCart
                }
                style={{
                  flex: 1,
                  minWidth: '220px',
                  background: (product.units_available ?? 1) <= 0
                    ? '#ccc'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '18px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: (product.units_available ?? 1) <= 0
                    ? 'not-allowed'
                    : 'pointer'
                }}
              >
                {addingToCart ? 'Adding...' : '🛍️ Add to Cart'}
              </button>

              <button
                onClick={() => {
                  const storedUser = JSON.parse(
                    localStorage.getItem("user") || "{}"
                  );

                  const buyerId = String(
                    storedUser?.id ??
                    storedUser?.userId ??
                    storedUser?.username ??
                    "buyer-anon"
                  );

                  const sellerId = String(
                    product?.seller ??
                    product?.seller_id ??
                    product?.seller_name ??
                    "seller-unknown"
                  );

                  navigate("/dashboard", {
                    state: {
                      openMessages: true,
                      chatContext: {
                        buyerId,
                        sellerId,
                        sellerName: product?.seller_name || "Seller",
                        sellerAvatar: product?.seller_avatar || "",
                        orderId: null,
                        productId: product?.id ?? null,
                        orderName: product?.title || "Product Inquiry",
                        orderType: product?.category || "Product"
                      }
                    }
                  });
                }}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  background: '#e2e8f0',
                  color: '#1e293b',
                  border: 'none',
                  padding: '18px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                💬 Message Seller
              </button>
            </div>
          </div>
        </div>
      </div>

      {paymentModal.open && (
        <PaymentFormCard
          order={{
            productName: `${product.title} × ${quantity}`,
            productImage: product.image_url || (
              product.image
                ? `${MEDIA_BASE_URL}${product.image}`
                : null
            ),
            sellerName: product.seller_name,
            productPrice: Number(product.price) * quantity,
            escrowFee: Number(product.price) * quantity * 0.05,
            discountAmount: 0,
            totalAmount: Number(product.price) * quantity * 1.05
          }}
          phone={phone}
          onPhoneChange={setPhone}
          onSubmit={submitPayment}
          onClose={closePaymentModal}
          onBack={closePaymentModal}
          submitting={paymentModal.submitting}
          phase={paymentModal.phase}
          sellerTrust={sellerTrust}
          backLabel="← Back to product"
        />
      )}
    </div>
  );
}

export default ProductDetailPage;
