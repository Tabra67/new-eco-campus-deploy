import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation, Link } from "react-router-dom";

function VerifyResetOTP() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get email from query parameter if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    if (!email || !code) {
      setMessage("Please enter both email and verification code.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/users/password-reset/verify/",
        {
          email: email,
          code: code,
        }
      );

      setMessage(response.data.message);
      setIsVerified(true);
      
      // Redirect to reset password page after successful verification
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
      }, 1500);
    } catch (err) {
      if (err.response) {
        setMessage(err.response.data.error || "Verification failed.");
      } else {
        setMessage("Server not reachable. Check Django server.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setMessage("Please enter your email address first.");
      return;
    }

    setMessage("");
    setIsLoading(true);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/users/password-reset/request/",
        {
          email: email,
        }
      );

      setMessage(response.data.message);
    } catch (err) {
      if (err.response) {
        setMessage(err.response.data.error || "Failed to resend code.");
      } else {
        setMessage("Server not reachable. Check Django server.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px", maxWidth: "400px", margin: "100px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Verify Reset Code</h2>
      <p>Enter the verification code sent to your email</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <input
            type="email"
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="Verification Code (6 digits)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            pattern="[0-9]{6}"
            required
            style={{ width: "100%", padding: "10px", boxSizing: "border-box" }}
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading || isVerified}
          style={{ width: "100%", padding: "12px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          {isLoading ? "Verifying..." : isVerified ? "Verified!" : "Verify Code"}
        </button>
      </form>

      <br />

      <button
        onClick={handleResendCode}
        disabled={isLoading || isVerified}
        style={{ width: "100%", padding: "12px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
      >
        {isLoading ? "Sending..." : "Resend Code"}
      </button>

      <p style={{ marginTop: "20px", color: isVerified ? "green" : "red" }}>
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

export default VerifyResetOTP;

