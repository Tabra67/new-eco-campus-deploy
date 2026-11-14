import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { addToCart } from './api/cart';

function MarketplacePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [wishlist, setWishlist] = useState(new Set());
  const [addingProductId, setAddingProductId] = useState(null);
  const [cartMessage, setCartMessage] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('authToken');

  const categories = ['All', 'Electronics', 'Books', 'Furniture', 'Services', 'Others'];

  const API_BASE = 'http://127.0.0.1:8000/api/marketplace';

  useEffect(() => {
    fetchProducts();
    if (token) fetchWishlist();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/marketplace/products/`;
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);
      if (params.toString()) url += `?${params}`;
      
      const { data } = await axios.get(url);
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWishlist = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/wishlist/`, {
        headers: { Authorization: `Token ${token}` }
      });
      const ids = new Set(data.map(item => item.product));
      setWishlist(ids);
    } catch (err) {
      console.error('Failed to fetch wishlist');
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategory]);

  const toggleWishlist = async (productId) => {
    try {
      await axios.post(`${API_BASE}/wishlist/${productId}/toggle/`, {}, {
        headers: { Authorization: `Token ${token}` }
      });
      setWishlist(prev => {
        const newSet = new Set(prev);
        if (newSet.has(productId)) {
          newSet.delete(productId);
        } else {
          newSet.add(productId);
        }
        return newSet;
      });
    } catch (err) {
      console.error('Wishlist toggle failed');
    }
  };

  const handleAddToCart = async (productId) => {
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      setAddingProductId(productId);
      await addToCart(productId, 1);
      setCartMessage('Added to cart!');
      setTimeout(() => setCartMessage(''), 2500);
    } catch (err) {
      setCartMessage(err.response?.data?.error || 'Failed to add to cart');
      setTimeout(() => setCartMessage(''), 3000);
    } finally {
      setAddingProductId(null);
    }
  };

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}>Loading marketplace...</div>;

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", paddingTop: '80px', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px' }}>ECO CAMPUS MARKETPLACE</h1>
            <p style={{ margin: 0, opacity: 0.9 }}>Browse {products.length} products from campus sellers</p>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <Link to="/register/role" style={{
              background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', 
              color: 'white', 
              padding: '14px 28px', 
              borderRadius: '30px', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 600, 
              textDecoration: 'none',
              fontSize: '16px',
              boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)'
            }}>
              Create free account
            </Link>
            <Link to="/login" style={{
              background: 'white', 
              color: '#667eea', 
              padding: '14px 28px', 
              borderRadius: '30px', 
              border: '2px solid #667eea', 
              cursor: 'pointer', 
              fontWeight: 600, 
              textDecoration: 'none',
              fontSize: '16px'
            }}>
              I already have one
            </Link>

          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search products... (laptop, books, etc)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1, minWidth: '300px', padding: '15px 20px', border: '2px solid #ddd', borderRadius: '25px', fontSize: '16px'
            }}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '25px',
                  border: selectedCategory === cat ? 'none' : '2px solid #ddd',
                  background: selectedCategory === cat ? '#667eea' : 'white',
                  color: selectedCategory === cat ? 'white' : '#333',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
          {products.map(product => (
            <div key={product.id} style={{
              background: 'white',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              transition: 'transform 0.3s ease'
            }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-8px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'} >
              {product.image_url && (
                <img src={product.image_url} alt={product.title} style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
              )}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#333' }}>{product.title}</h3>
                      <span style={{ background: product.category === 'Services' ? '#28a745' : '#667eea', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 }}>
                        {product.category === 'Services' ? 'Service' : 'Product'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWishlist(product.id)}
                    style={{
                      background: wishlist.has(product.id) ? '#ff6b6b' : '#f8f9fa',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      cursor: 'pointer',
                      fontSize: '20px'
                    }}
                  >
                    ❤️
                  </button>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea', marginBottom: '10px' }}>
                  Ksh {product.price}
                </div>
                <div style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                  {product.category} • {product.condition} • {product.location}
                </div>
                <div style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                  Units left: {product.units_available ?? 1}
                </div>
                {(product.units_available ?? 1) === 0 && (
                  <div style={{ color: '#dc3545', fontWeight: 600, marginBottom: '8px' }}>
                    Out of Stock
                  </div>
                )}
                {(product.units_available ?? 1) <= 2 && (product.units_available ?? 1) > 0 && (
                  <div style={{ color: '#f39c12', fontWeight: 500, marginBottom: '8px' }}>
                    Almost sold out
                  </div>
                )}
                <div style={{ color: '#28a745', fontWeight: 500, marginBottom: '15px' }}>
                  By {product.seller_name}
                </div>
                <p style={{ color: '#555', lineHeight: 1.5, marginBottom: '15px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {product.description}
                </p>
                <button
                  onClick={() => navigate(`/marketplace/product/${product.id}`)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: '10px'
                  }}
                >
                  View Details →
                </button>
                <button
                  onClick={() => handleAddToCart(product.id)}
                  disabled={(product.units_available ?? 1) <= 0 || addingProductId === product.id}
                  style={{
                    width: '100%',
                    background: (product.units_available ?? 1) <= 0 ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: (product.units_available ?? 1) <= 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  {addingProductId === product.id ? 'Adding...' : '🛍️ Add to Cart'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '80px', color: '#666' }}>
            <h2>No products found</h2>
            <p>Try adjusting your search or category filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketplacePage;
