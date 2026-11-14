import { useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "30px" }}>
    <h3
      style={{
        color: "#333",
        marginBottom: "15px",
        fontSize: "1.1rem",
        fontWeight: 600,
        borderBottom: "2px solid #f0f0f0",
        paddingBottom: "8px",
      }}
    >
      {title}
    </h3>
    {children}
  </div>
);

const RegisterForm = ({ role = "buyer" }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
    full_name: "",
    phone: "",
    country: "",
    city: "",
    delivery_address: "",
    preferred_categories: "",
    store_name: "",
    seller_type: "",
    main_category: "",
    subcategory: "",
    business_address: "",
    payout_method: "",
    payout_details: "",
    is_2fa_enabled: false,
  });

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleCheckboxChange = useCallback((e) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (formData.password !== formData.password_confirm) {
      setMessage("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      ...formData,
      role,
      password_confirm: formData.password_confirm,
    };

    if (role === "buyer") {
      payload.preferred_categories = formData.preferred_categories
        .split(",")
        .map((cat) => cat.trim())
        .filter(Boolean);
      delete payload.store_name;
      delete payload.seller_type;
      delete payload.main_category;
      delete payload.subcategory;
      delete payload.business_address;
      delete payload.payout_method;
      delete payload.payout_details;
      delete payload.is_2fa_enabled;
    } else if (role === "seller") {
      delete payload.delivery_address;
      delete payload.preferred_categories;
      delete payload.is_2fa_enabled;
    } else if (role === "admin") {
      payload.is_2fa_enabled = formData.is_2fa_enabled;
      delete payload.delivery_address;
      delete payload.preferred_categories;
      delete payload.store_name;
      delete payload.seller_type;
      delete payload.main_category;
      delete payload.subcategory;
      delete payload.business_address;
      delete payload.payout_method;
      delete payload.payout_details;
    }

    try {
      await axios.post("http://127.0.0.1:8000/api/users/register/", payload);

      setMessage(
        `Registration successful as ${role.toUpperCase()}! Check your email for verification code.`
      );

      setTimeout(() => {
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
      }, 2000);
    } catch (err) {
      console.error(err);
      if (err.response?.data) {
        const errors = err.response.data;
        if (typeof errors === "object") {
          const errorMsg = Object.entries(errors)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ");
          setMessage(errorMsg);
        } else {
          setMessage(errors);
        }
      } else {
        setMessage("Server error. Check Django server is running.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    padding: "15px 20px",
    border: "2px solid #e1e5e9",
    borderRadius: "12px",
    fontSize: "16px",
    transition: "border-color 0.3s",
    width: "100%",
    boxSizing: "border-box",
  };

  const focusStyle = (e) => (e.target.style.borderColor = "#667eea");
  const blurStyle = (e) => (e.target.style.borderColor = "#e1e5e9");

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "40px auto",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        background: "white",
        textAlign: "left",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <h2
        style={{
          marginBottom: "10px",
          color: "#333",
          fontSize: "2rem",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {role.charAt(0).toUpperCase() + role.slice(1)} Registration
      </h2>
      <p
        style={{
          color: "#666",
          marginBottom: "30px",
          fontSize: "1rem",
          textAlign: "center",
        }}
      >
        Complete your profile to join Eco-Campus Marketplace
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <Section title="Basic Information">
          <input
            name="full_name"
            type="text"
            placeholder="Full Name"
            value={formData.full_name}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <input
            name="username"
            type="text"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <input
            name="email"
            type="email"
            placeholder="University Email"
            value={formData.email}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <input
            name="phone"
            type="tel"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            style={inputStyle}
          />
        </Section>

        <Section title="Password">
          <input
            name="password"
            type="password"
            placeholder="Password (min 8 chars)"
            value={formData.password}
            onChange={handleChange}
            style={inputStyle}
            required
            minLength="8"
          />
          <input
            name="password_confirm"
            type="password"
            placeholder="Confirm Password"
            value={formData.password_confirm}
            onChange={handleChange}
            style={inputStyle}
            required
          />
        </Section>

        <Section title="Location">
          <input
            name="country"
            type="text"
            placeholder="Country"
            value={formData.country}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            name="city"
            type="text"
            placeholder="City"
            value={formData.city}
            onChange={handleChange}
            style={inputStyle}
          />
        </Section>

        {role === "buyer" && (
          <Section title="Buyer Preferences">
            <textarea
              name="delivery_address"
              placeholder="Delivery Address"
              value={formData.delivery_address}
              onChange={handleChange}
              style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <input
              name="preferred_categories"
              type="text"
              placeholder="Preferred Categories (comma separated: electronics,books)"
              value={formData.preferred_categories}
              onChange={handleChange}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </Section>
        )}

        {role === "seller" && (
          <Section title="Store Information">
            <input
              name="store_name"
              type="text"
              placeholder="Store Name"
              value={formData.store_name}
              onChange={handleChange}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
              required
            />
            <input
              name="seller_type"
              type="text"
              placeholder="Seller Type (Individual, Business)"
              value={formData.seller_type}
              onChange={handleChange}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <input
              name="main_category"
              type="text"
              placeholder="Main Category"
              value={formData.main_category}
              onChange={handleChange}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <input
              name="subcategory"
              type="text"
              placeholder="Subcategory"
              value={formData.subcategory}
              onChange={handleChange}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <textarea
              name="business_address"
              placeholder="Business Address"
              value={formData.business_address}
              onChange={handleChange}
              style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <input
              name="payout_method"
              type="text"
              placeholder="Payout Method (MPESA, Bank)"
              value={formData.payout_method}
              onChange={handleChange}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <input
              name="payout_details"
              type="text"
              placeholder="Payout Details (Phone/Bank info)"
              value={formData.payout_details}
              onChange={handleChange}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </Section>
        )}

        {role === "admin" && (
          <Section title="Admin Settings">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "16px",
              }}
            >
              <input
                name="is_2fa_enabled"
                type="checkbox"
                checked={formData.is_2fa_enabled}
                onChange={handleCheckboxChange}
                style={{ width: "20px", height: "20px" }}
              />
              Enable 2FA
            </label>
          </Section>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            background: isSubmitting
              ? "#6c757d"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            padding: "16px",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseDown={(e) =>
            !isSubmitting && (e.target.style.transform = "scale(0.98)")
          }
          onMouseUp={(e) =>
            !isSubmitting && (e.target.style.transform = "scale(1)")
          }
        >
          {isSubmitting
            ? "Creating Account..."
            : `Create ${role.charAt(0).toUpperCase() + role.slice(1)} Account`}
        </button>
      </form>

      {message && (
        <div
          style={{
            marginTop: "25px",
            padding: "20px",
            borderRadius: "12px",
            color: message.includes("success") ? "#28a745" : "#dc3545",
            backgroundColor: message.includes("success") ? "#d4edda" : "#f8d7da",
            borderLeft: `5px solid ${
              message.includes("success") ? "#28a745" : "#dc3545"
            }`,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ marginTop: "30px", fontSize: "0.95rem", textAlign: "center" }}>
        <span style={{ color: "#666" }}>Already have an account? </span>
        <a href="/login" style={{ color: "#667eea", textDecoration: "none", fontWeight: 500 }}>
          Sign in
        </a>
      </div>
    </div>
  );
};

export default RegisterForm;
