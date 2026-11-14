import { Link } from 'react-router-dom';
import './App.css'; // Reuse existing styles

const RegisterRoleSelectionPage = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      padding: '20px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          color: '#333',
          marginBottom: '10px',
          fontWeight: 700
        }}>
          Register as
        </h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>
          Choose your account type to get started
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '30px',
        maxWidth: '1000px',
        width: '100%'
      }}>
        {/* Buyer Card */}
        <Link 
          to="/register/buyer" 
          style={{ textDecoration: 'none' }}
          className="role-card"
        >
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '40px 30px',
            borderRadius: '20px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-10px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
          }}
        >
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🛒</div>
            <h2 style={{ fontSize: '2rem', marginBottom: '10px', fontWeight: 600 }}>
              Buyer
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: '20px' }}>
              Browse and purchase items from campus sellers
            </p>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '8px 20px',
              borderRadius: '25px',
              fontSize: '0.9rem',
              fontWeight: 500
            }}>
              Perfect for students
            </span>
          </div>
        </Link>

        {/* Seller Card */}
        <Link 
          to="/register/seller" 
          style={{ textDecoration: 'none' }}
          className="role-card"
        >
          <div style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            padding: '40px 30px',
            borderRadius: '20px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(245, 87, 108, 0.3)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-10px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(245, 87, 108, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(245, 87, 108, 0.3)';
          }}
        >
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🏪</div>
            <h2 style={{ fontSize: '2rem', marginBottom: '10px', fontWeight: 600 }}>
              Seller
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: '20px' }}>
              List your items and reach campus buyers instantly
            </p>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '8px 20px',
              borderRadius: '25px',
              fontSize: '0.9rem',
              fontWeight: 500
            }}>
              Earn from your stuff
            </span>
          </div>
        </Link>

        {/* Admin Card */}
        <Link 
          to="/register/admin" 
          style={{ textDecoration: 'none' }}
          className="role-card"
        >
          <div style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            padding: '40px 30px',
            borderRadius: '20px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(79, 172, 254, 0.3)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-10px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(79, 172, 254, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(79, 172, 254, 0.3)';
          }}
        >
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚙️</div>
            <h2 style={{ fontSize: '2rem', marginBottom: '10px', fontWeight: 600 }}>
              Admin
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: '20px' }}>
              Manage platform operations and moderation
            </p>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '8px 20px',
              borderRadius: '25px',
              fontSize: '0.9rem',
              fontWeight: 500
            }}>
              Platform management
            </span>
          </div>
        </Link>
      </div>

      <div style={{ marginTop: '50px', textAlign: 'center' }}>
        <Link 
          to="/login" 
          style={{
            color: '#667eea',
            textDecoration: 'none',
            fontSize: '1.1rem',
            fontWeight: 500
          }}
        >
          Already have an account? Login here →
        </Link>
      </div>
    </div>
  );
};

export default RegisterRoleSelectionPage;

