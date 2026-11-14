
import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const API_ROOT =
        process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

      const response = await axios.post(
        `${API_ROOT}/api/users/password-reset/request/`,
        {
          email: email,
        }
      );

      setMessage(response.data.message);
      setEmailSent(true);

      setTimeout(() => {
        navigate(`/verify-reset-otp?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;

        if (typeof errorData === "object") {
          const errorMessages = Object.entries(errorData)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");

          setMessage(errorMessages);
        } else {
          setMessage(JSON.stringify(errorData));
        }
      } else {
        setMessage("Server not reachable. Check Django server.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "100px",
        maxWidth: "400px",
        margin: "100px auto",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "8px",
      }}
    >
      <h2>Forgot Password</h2>
      <p>Enter your university email to receive a password reset code</p>

      {!emailSent ? (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <input
              type="email"
              placeholder="University Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isLoading ? "Sending..." : "Send Reset Code"}
          </button>
        </form>
      ) : (
        <div style={{ color: "green", marginTop: "20px" }}>
          <p>{message}</p>
          <p>Redirecting to verification page...</p>
        </div>
      )}

      <p
        style={{
          marginTop: "20px",
          color:
            message.includes("successful") || emailSent ? "green" : "red",
        }}
      >
        {message}
      </p>

      <p style={{ marginTop: "20px" }}>
        Remember your password?{" "}
        <Link to="/login" style={{ color: "#007bff", textDecoration: "none" }}>
          Login
        </Link>
      </p>
    </div>
  );
}

export default ForgotPassword;
