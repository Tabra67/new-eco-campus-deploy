import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

function VerifyEmail() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
        "http://127.0.0.1:8000/api/users/verify-email/",
        {
          email: email,
          code: code,
        }
      );

      setMessage(response.data.message);
      
      // Redirect to login after successful verification
      setTimeout(() => {
        navigate("/login");
      }, 2000);
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
        "http://127.0.0.1:8000/api/users/resend-otp/",
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
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Verify Your Email</h2>
      <p>Enter the verification code sent to your email</p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="University Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <br />
        <br />

        <input
          type="text"
          placeholder="Verification Code (6 digits)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          pattern="[0-9]{6}"
          required
        />

        <br />
        <br />

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Verifying..." : "Verify Email"}
        </button>
      </form>

      <br />

      <button
        onClick={handleResendCode}
        disabled={isLoading}
        style={{ backgroundColor: "#6c757d" }}
      >
        {isLoading ? "Sending..." : "Resend Code"}
      </button>

      <p style={{ color: message.includes("success") ? "green" : "red" }}>
        {message}
      </p>
    </div>
  );
}

export default VerifyEmail;

