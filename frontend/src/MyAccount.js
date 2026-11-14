import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Profile from "./Profile";  // Reuse existing Profile component

function MyAccount() {
  const [activeSection, setActiveSection] = useState('profile');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState({
    profile: true,
    orders: true,
    wishlist: true
  });
  const [error, setError] = useState('');
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  
  const navigate = useNavigate();
  const token = localStorage.getItem('authToken');
  const API_BASE = 'http://127.0.0.1:8000/api';

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/users/profile/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setUser(data);
      setLoading(prev => ({...prev, profile: false}));
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('authToken');
        navigate('/login');
      } else {
        setError('Failed to load profile');
        setLoading(prev => ({...prev, profile: false}));
      }
    }
  }, [navigate]);

  // Fetch orders (for Orders & Unbox)
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/marketplace/orders/`, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('ORDERS loaded:', data.length);
      setOrders(data);
      setLoading(prev => ({...prev, orders: false}));
    } catch (err) {
      console.error('FETCH_ORDERS ERROR:', err.response?.status, err.response?.data || err.message);
      setError('Failed to load orders');
      setLoading(prev => ({...prev, orders: false}));
    }
  }, [navigate]);

  // Fetch messages for Unbox
  const fetchMessages = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/marketplace/messages/bidirectional/`, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('MESSAGES loaded:', data.length);
      setOrders(data);  // Reuse orders state for Unbox display
      setLoading(prev => ({...prev, orders: false}));
    } catch (err) {
      console.error('FETCH_MESSAGES ERROR:', err.response?.status, err.response?.data || err.message);
      setError('Failed to load messages');
      setLoading(prev => ({...prev, orders: false}));
    }
  };

  // Fetch wishlist
  const fetchWishlist = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/marketplace/wishlist/`, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('WISHLIST loaded:', data.length);
      setWishlist(data);
      setLoading(prev => ({...prev, wishlist: false}));
    } catch (err) {
      console.error('FETCH_WISHLIST ERROR:', err.response?.status, err.response?.data || err.message);
      setError('Failed to load wishlist');
      setLoading(prev => ({...prev, wishlist: false}));
    }
  }, [navigate]);

  // Toggle wishlist item
  const toggleWishlistItem = useCallback(async (productId) => {
    try {
      await axios.post(`${API_BASE}/marketplace/wishlist/${productId}/toggle/`, {}, {
        headers: { Authorization: `Token ${token}` }
      });
      // Refresh wishlist
      fetchWishlist();
    } catch (err) {
      setError('Failed to update wishlist');
    }
  }, [navigate]);

  // Deactivate account
  const handleDeactivate = async () => {
    setIsDeactivating(true);
    try {
      await axios.delete(`${API_BASE}/users/profile/`, {
        headers: { Authorization: `Token ${token}` }
      });
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/login', { state: { message: 'Account deactivated successfully.' } });
    } catch (err) {
      setError('Failed to deactivate account');
    } finally {
      setIsDeactivating(false);
      setShowDeactivateModal(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchOrders();
      fetchWishlist();
    } else {
      navigate('/login');
    }
  }, []); // Fixed exhaustive-deps

  const navItems = [
    { id: 'profile', label: 'Edit Profile', icon: '👤' },
    { id: 'orders', label: 'Orders', icon: '📦' },
    { id: 'unbox', label: 'Unbox', icon: '📬' },
    { id: 'wishlist', label: 'Wishlist', icon: '❤️' },
    { id: 'deactivate', label: 'Deactivate Account', icon: '⚠️' },
    { id: 'logout', label: 'Logout', icon: '🚪' }
  ];

  const statusColors = {
    pending: { color: '#ffc107', label: 'Pending' },
    confirmed: { color: '#28a745', label: 'Confirmed' },
    delivered: { color: '#17a2b8', label: 'Delivered' },
    completed: { color: '#6f42c1', label: 'Completed' }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return !loading.profile ? <Profile /> : <div>Loading profile...</div>;
      
      case 'orders':
        if (loading.orders) return <div>Loading orders...</div>;
        return (
          <div>
            <h2>My Orders</h2>
            {orders.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                <h3>No orders yet</h3>
                <p>Start shopping to see your orders here!</p>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                    <h3>{order.product_title}</h3>
                    <span style={{
                      background: statusColors[order.status]?.color || '#6c757d',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {statusColors[order.status]?.label || order.status}
                    </span>
                  </div>
                  <div style={{display: 'flex', gap: '16px', color: '#666'}}>
                    <span>Qty: 1</span>
                    <span>Seller: {order.seller_name}</span>
                    <span>Ksh {order.price}</span>
                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      
      case 'unbox':
        if (loading.orders) return <div>Loading updates...</div>;
        return (
          <div>
            <h2>Unbox Updates</h2>
            {orders.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                <h3>No updates yet</h3>
                <p>Complete your first order to see updates here!</p>
              </div>
            ) : (
              orders.slice().reverse().map(order => (
                <div key={order.id} style={{
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  borderLeft: `4px solid ${statusColors[order.status]?.color || '#6c757d'}`,
                  padding: '20px',
                  marginBottom: '16px',
                  borderRadius: '8px'
                }}>
                  <div style={{fontWeight: '600', marginBottom: '4px'}}>
                    {order.product_title} {statusColors[order.status]?.label || order.status} ✅
                  </div>
                  <div style={{color: '#666', fontSize: '14px'}}>
                    Order by {order.seller_name} • Ksh {order.price} • {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      
      case 'wishlist':
        if (loading.wishlist) return <div>Loading wishlist...</div>;
        return (
          <div>
            <h2>Wishlist</h2>
            {wishlist.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                <div style={{fontSize: '48px', marginBottom: '16px'}}>❤️</div>
                <h3>Your wishlist is empty</h3>
                <p>Add items from the marketplace!</p>
              </div>
            ) : (
              wishlist.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  gap: '16px',
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  alignItems: 'center'
                }}>
                  <div style={{flexShrink: 0}}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#666',
                      fontSize: '24px'
                    }}>
                      🛍️
                    </div>
                  </div>
                  <div style={{flex: 1}}>
                    <h3 style={{margin: '0 0 4px 0'}}>{item.product_title}</h3>
                    <div style={{color: '#666'}}>By {item.seller_name}</div>
                  </div>
                  <button
                    onClick={() => toggleWishlistItem(item.product)}
                    style={{
                      background: '#ff6b6b',
                      color: 'white',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '25px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Remove ❤️
                  </button>
                </div>
              ))
            )}
          </div>
        );
      
      case 'deactivate':
        return (
          <div style={{maxWidth: '500px', margin: '0 auto'}}>
            <h2 style={{color: '#dc3545'}}>Deactivate Account</h2>
            <div style={{
              background: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#721c24'}}>
                ⚠️ Warning: This action cannot be undone
              </div>
              <ul style={{color: '#721c24', margin: '0', paddingLeft: '20px'}}>
                <li>Your account will be deactivated (is_active = false)</li>
                <li>You'll need to contact support to reactivate</li>
                <li>Your data will be preserved but inaccessible</li>
              </ul>
            </div>
            <button
              onClick={() => setShowDeactivateModal(true)}
              disabled={!token}
              style={{
                width: '100%',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: token ? 'pointer' : 'not-allowed'
              }}
            >
              {token ? 'Deactivate My Account' : 'Login Required'}
            </button>
          </div>
        );
      
      case 'logout':
        return (
          <div style={{textAlign: 'center', maxWidth: '400px', margin: '0 auto'}}>
            <h2>Logout</h2>
            <div style={{fontSize: '18px', color: '#666', marginBottom: '24px'}}>
              Are you sure you want to logout?
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              style={{
                width: '100%',
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                padding: '16px',
                borderRadius: '25px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              Logout
            </button>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-block',
                background: '#6c757d',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '25px',
                textDecoration: 'none',
                fontWeight: '500'
              }}
            >
              Cancel
            </Link>
          </div>
        );
      
      default:
        return <div>Select a section</div>;
    }
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      paddingTop: '20px'
    }}>
      {/* Header */}
      <div style={{maxWidth: '1400px', margin: '0 auto 20px', padding: '0 20px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <Link 
            to="/dashboard" 
            style={{
              background: '#6c757d',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '25px',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            ← Back to Dashboard
          </Link>
          <h1 style={{margin: 0, fontSize: '28px', color: '#333'}}>
            My Account
          </h1>
        </div>
      </div>

      {error && (
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto 20px',
          padding: '0 20px'
        }}>
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px 16px',
            borderRadius: '8px',
            borderLeft: '4px solid #dc3545'
          }}>
            {error} <button onClick={() => setError('')} style={{marginLeft: 'auto', background: 'none', border: 'none', color: '#721c24', cursor: 'pointer'}}>×</button>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        gap: '0',
        height: 'calc(100vh - 120px)',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <div style={{
          width: '280px',
          background: 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%)',
          borderRadius: '16px',
          padding: '24px 0',
          flexShrink: 0,
          overflowY: 'auto'
        }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                width: '100%',
                background: activeSection === item.id 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : 'transparent',
                color: activeSection === item.id ? 'white' : '#ccc',
                border: 'none',
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: activeSection === item.id ? '600' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (activeSection !== item.id) {
                  e.target.style.background = 'rgba(255,255,255,0.1)';
                  e.target.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== item.id) {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#ccc';
                }
              }}
            >
              <span style={{fontSize: '20px'}}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          marginLeft: '20px',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {renderContent()}
        </div>
      </div>

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90vw',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{color: '#dc3545', marginTop: 0}}>Confirm Deactivation</h3>
            <p style={{lineHeight: 1.6}}>
              This will <strong>deactivate your account</strong>. You'll lose access but your data will be preserved.
              <br/><br/>
              Are you absolutely sure?
            </p>
            <div style={{display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button
                onClick={() => setShowDeactivateModal(false)}
                disabled={isDeactivating}
                style={{
                  padding: '12px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isDeactivating ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                style={{
                  padding: '12px 24px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isDeactivating ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {isDeactivating ? 'Deactivating...' : 'Yes, Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            maxWidth: '400px',
            width: '90vw'
          }}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div style={{display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px'}}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: '12px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Stay
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '12px 24px',
                  background: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Responsive Overlay - Simplified for demo */}
      <style jsx>{`
        @media (max-width: 768px) {
          .main-layout {
            flex-direction: column;
          }
          .sidebar {
            width: 100%;
            max-height: 60vh;
          }
          .content-area {
            margin-left: 0;
            margin-top: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default MyAccount;

