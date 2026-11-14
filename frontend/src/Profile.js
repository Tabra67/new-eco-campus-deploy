import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function Profile() {
  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [showDeactivatePopup, setShowDeactivatePopup] = useState(false);
  
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const navigate = useNavigate();

  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await axios.get("http://127.0.0.1:8000/api/users/profile/", {
        headers: { Authorization: `Token ${token}` },
      });

      const userData = response.data;
      setUser(userData);
      setFormData(userData);
      setPreviewImage(userData.profile_picture_url || null);
      setCoverPreview(userData.cover_image_url || null);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        navigate("/login");
      } else {
        setMessage("Failed to load profile.");
      }
    } finally {
      setIsLoadingProfile(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleFileChange = useCallback((e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'profile') {
          setPreviewImage(reader.result);
          setProfilePicture(file);
        } else {
          setCoverPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleCancelPreview = useCallback((type) => {
    if (type === 'profile') {
      setProfilePicture(null);
      setPreviewImage(user?.profile_picture_url || null);
    } else {
      setCoverPreview(user?.cover_image_url || null);
    }
    if (type === 'profile' && fileInputRef.current) fileInputRef.current.value = "";
  }, [user]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    const token = localStorage.getItem("authToken");
    const submitFormData = new FormData();

    // Add all editable fields
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        submitFormData.append(key, value);
      }
    });

    if (profilePicture) {
      submitFormData.append("profile_picture", profilePicture);
    }

    // Cover image only for sellers
    if (user?.role === 'seller' && coverPreview && !profilePicture) {  // Wait, cover separate
      // Note: cover_image upload needs separate handling if changed
    }

    try {
      const response = await axios.patch(
        "http://127.0.0.1:8000/api/users/profile/",
        submitFormData,
        {
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "multipart/form-data"
          },
        }
      );

      setMessage("Profile updated successfully!");
      setEditMode(false);
      localStorage.setItem("user", JSON.stringify({ ...user, ...response.data.profile }));
      await fetchUserProfile();
    } catch (err) {
      const errorData = err.response?.data;
      const errors = Object.entries(errorData || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
      setMessage(errors || "Update failed.");
    } finally {
      setIsLoading(false);
    }
  }, [formData, profilePicture, user, fetchUserProfile, navigate]);

  const updateFormField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleDeactivate = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      await axios.delete("http://127.0.0.1:8000/api/users/profile/", {
        headers: { Authorization: `Token ${token}` },
      });
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      navigate("/login");
    } catch (err) {
      setMessage("Failed to deactivate.");
    } finally {
      setIsLoading(false);
      setShowDeactivatePopup(false);
    }
  }, [navigate]);

  if (isLoadingProfile) {
    return <div style={{ textAlign: "center", marginTop: "100px" }}><p>Loading profile...</p></div>;
  }

  const roleColor = {
    buyer: '#28a745',
    seller: '#007bff',
    admin: '#dc3545'
  }[user?.role || 'buyer'];

  const Section = ({ title, children, editable = false }) => (
    <div style={{ marginBottom: '30px' }}>
      <h3 style={{ 
        color: '#333', 
        marginBottom: '15px', 
        fontSize: '1.2rem', 
        fontWeight: 600,
        paddingBottom: '10px',
        borderBottom: editable ? '2px solid #007bff' : '2px solid #eee'
      }}>
        {title} {editable && '(Editable)'} 
      </h3>
      {children}
    </div>
  );

  const DisplayField = ({ label, value, editable = false, type = 'text', field, options }) => (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
        {label}
      </label>
      {editable ? (
        type === 'textarea' ? (
          <textarea
            value={formData[field] || ''}
            onChange={(e) => updateFormField(field, e.target.value)}
            rows="3"
            style={{ 
              width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        ) : type === 'select' ? (
          <select
            value={formData[field] || ''}
            onChange={(e) => updateFormField(field, e.target.value)}
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
          >
            <option value="">Select...</option>
            {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : type === 'checkbox' ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
            <input
              type="checkbox"
              checked={!!formData[field]}
              onChange={(e) => updateFormField(field, e.target.checked)}
              style={{ width: '20px', height: '20px' }}
            />
            Enable
          </label>
        ) : (
          <input
            type={type}
            value={formData[field] || ''}
            onChange={(e) => updateFormField(field, e.target.value)}
            style={{ 
              width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px',
              boxSizing: 'border-box'
            }}
          />
        )
      ) : (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px', 
          minHeight: '40px', 
          display: 'flex', 
          alignItems: 'center',
          borderLeft: `4px solid ${roleColor}`
        }}>
          {Array.isArray(value) ? value.join(', ') : value || 'Not set'}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: "900px", margin: "20px auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "32px", color: '#333' }}>My Profile</h1>
          <div style={{ 
            background: roleColor, 
            color: 'white', 
            padding: '4px 12px', 
            borderRadius: '20px', 
            fontSize: '14px', 
            fontWeight: '600', 
            display: 'inline-block',
            marginTop: '5px'
          }}>
            {user?.role_display || user?.role?.toUpperCase()} Account
          </div>
        </div>
        <div>
          <button
            onClick={() => setEditMode(!editMode)}
            style={{
              padding: "12px 24px",
              backgroundColor: editMode ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
              marginRight: "10px"
            }}
            disabled={isLoading}
          >
            {editMode ? 'Cancel Edit' : 'Edit Profile'}
          </button>
          <Link to="/dashboard" style={{
            padding: "12px 24px",
            backgroundColor: "#6c757d",
            color: "white",
            textDecoration: "none",
            borderRadius: "6px",
            fontWeight: "500"
          }}>
            Dashboard
          </Link>
        </div>
      </div>

      {message && (
        <div style={{ 
          marginBottom: "20px", 
          padding: "15px", 
          borderRadius: "8px", 
          borderLeft: `4px solid ${message.includes('success') ? '#28a745' : '#dc3545'}`,
          backgroundColor: message.includes('success') ? '#d4edda' : '#f8d7da',
          color: message.includes('success') ? '#155724' : '#721c24'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        {/* Left Column - Basic & Location */}
        <div>
          <Section title="👤 Basic Information" editable={editMode}>
            <DisplayField label="Full Name" value={user?.full_name} field="full_name" editable={editMode} />
            <DisplayField label="Username" value={user?.username} field="username" editable={editMode} />
            <DisplayField label="Email" value={user?.email} editable={false} />
            <DisplayField label="Phone" value={user?.phone} field="phone" editable={editMode} type="tel" />
            <DisplayField label="Bio" value={user?.bio} field="bio" editable={editMode} type="textarea" />
            <DisplayField label="Role" value={user?.role_display} editable={false} />
          </Section>

          <Section title="📍 Location" editable={editMode}>
            <DisplayField label="Country" value={user?.country} field="country" editable={editMode} />
            <DisplayField label="City" value={user?.city} field="city" editable={editMode} />
            {user?.role === 'buyer' && (
              <DisplayField label="Delivery Address" value={user?.delivery_address} field="delivery_address" editable={editMode} type="textarea" />
            )}
            {user?.role === 'seller' && (
              <DisplayField label="Business Address" value={user?.business_address} field="business_address" editable={editMode} type="textarea" />
            )}
          </Section>
        </div>

        {/* Right Column - Role Specific & Images */}
        <div>
          <Section title="🖼️ Profile Images" editable={editMode}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img
                src={previewImage}
                alt="Profile"
                style={{ 
                  width: '120px', height: '120px', borderRadius: '50%', 
                  objectFit: 'cover', border: '4px solid #007bff',
                  marginBottom: '10px'
                }}
              />
              {editMode && (
                <>
                  <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'profile')} 
                    accept="image/*" style={{display: 'none'}} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} 
                    style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', 
                      borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>
                    Change Photo
                  </button>
                  {profilePicture && (
                    <button type="button" onClick={() => handleCancelPreview('profile')} 
                      style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', 
                        borderRadius: '4px', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
            {user?.role === 'seller' && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={coverPreview}
                  alt="Cover"
                  style={{ 
                    width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px',
                    marginBottom: '10px', border: '2px solid #28a745'
                  }}
                />
                {editMode && (
                  <>
                    <input type="file" ref={coverInputRef} onChange={(e) => handleFileChange(e, 'cover')} 
                      accept="image/*" style={{display: 'none'}} />
                    <button type="button" onClick={() => coverInputRef.current?.click()} 
                      style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', 
                        borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>
                      Change Cover
                    </button>
                  </>
                )}
              </div>
            )}
          </Section>

          {/* Role-specific sections */}
          {user?.role === 'buyer' && (
            <Section title="🛒 Buyer Preferences" editable={editMode}>
              <DisplayField label="Preferred Categories" value={user?.preferred_categories?.join(', ')} 
                field="preferred_categories" editable={editMode} />
            </Section>
          )}

          {user?.role === 'seller' && (
            <Section title="🏪 Store Information" editable={editMode}>
              <DisplayField label="Store Name" value={user?.store_name} field="store_name" editable={editMode} />
              <DisplayField label="Seller Type" value={user?.seller_type} field="seller_type" editable={editMode} />
              <DisplayField label="Main Category" value={user?.main_category} field="main_category" editable={editMode} />
              <DisplayField label="Subcategory" value={user?.subcategory} field="subcategory" editable={editMode} />
              <DisplayField label="Payout Method" value={user?.payout_method} field="payout_method" editable={editMode} />
              <DisplayField label="Payout Details" value={user?.payout_details} field="payout_details" editable={editMode} type="textarea" />
            </Section>
          )}

          {user?.role === 'admin' && (
            <Section title="🛡 Admin Settings" editable={editMode}>
              <DisplayField label="2FA Enabled" value={user?.is_2fa_enabled ? 'Yes' : 'No'} 
                field="is_2fa_enabled" editable={editMode} type="checkbox" />
            </Section>
          )}
        </div>
      </div>

      {editMode && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              padding: '16px 40px',
              backgroundColor: isLoading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      )}

      {/* Deactivate Section */}
      <div style={{ 
        marginTop: "60px", 
        padding: "30px", 
        backgroundColor: "#f8d7da", 
        border: "1px solid #f5c6cb", 
        borderRadius: "12px" 
      }}>
        <h3 style={{ color: "#dc3545", marginTop: 0 }}>⚠️ Danger Zone - Deactivate Account</h3>
        <p style={{ color: "#721c24", lineHeight: 1.6 }}>
          This will deactivate your account. Data preserved but login blocked until reactivated by admin.
        </p>
        <button
          onClick={() => setShowDeactivatePopup(true)}
          disabled={isLoading}
          style={{ 
            padding: "14px 28px", 
            backgroundColor: "#dc3545", 
            color: "white", 
            border: "none", 
            borderRadius: "8px", 
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "16px"
          }}
        >
          Deactivate My Account
        </button>
      </div>

      {/* Deactivate Popup */}
      {showDeactivatePopup && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white", padding: "40px", borderRadius: "16px",
            maxWidth: "450px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ color: "#dc3545", marginTop: 0 }}>Confirm Deactivation</h3>
            <p style={{ lineHeight: 1.6, color: "#555" }}>
              Are you absolutely sure? This cannot be undone without admin help.
            </p>
            <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "30px" }}>
              <button
                onClick={handleDeactivate}
                disabled={isLoading}
                style={{ 
                  padding: "14px 28px", backgroundColor: "#dc3545", color: "white",
                  border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600"
                }}
              >
                {isLoading ? "Processing..." : "Yes, Deactivate"}
              </button>
              <button
                onClick={() => setShowDeactivatePopup(false)}
                disabled={isLoading}
                style={{ 
                  padding: "14px 28px", backgroundColor: "#6c757d", color: "white",
                  border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "500"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;

