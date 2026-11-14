
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation, Link } from "react-router-dom";

const API_ROOT = (
  process.env.REACT_APP_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

function ResetPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    const codeParam = params.get("code");

    if (emailParam) setEmail(emailParam);
    if (codeParam) setCode(codeParam);
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_ROOT}/api/users/password-reset/complete/`,
        {
          email,
          code,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }
      );

      setMessage(
        response.data.message || "Password reset successfully!"
      );
      setIsSuccess(true);

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;

        if (typeof errorData === "object" && errorData !== null) {
          const errorMessages = Object.entries(errorData)
            .map(([key, value]) => {
              if (Array.isArray(value)) {
                return `${key}: ${value.join(", ")}`;
              }

              return `${key}: ${
                typeof value === "object"
                  ? JSON.stringify(value)
                  : value
              }`;
            })
            .join(", ");

          setMessage(errorMessages);
        } else {
          setMessage(JSON.stringify(errorData));
        }
      } else {
        setMessage(
          "Server not reachable. Check your internet connection."
        );
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
      <h2>Reset Password</h2>
      <p>Enter your new password</p>

      {!isSuccess ? (
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

          <div style={{ marginBottom: "15px" }}>
            <input
              type="text"
              placeholder="Verification Code (6 digits)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              pattern="[0-9]{6}"
              required
              style={{
                width: "100%",
                padding: "10px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: "100%",
                padding: "10px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      ) : (
        <div style={{ color: "green", marginTop: "20px" }}>
          <p>{message}</p>
          <p>Redirecting to login page...</p>
        </div>
      )}

      {!isSuccess && message && (
        <p style={{ marginTop: "20px", color: "red" }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: "20px" }}>
        <Link
          to="/login"
          style={{ color: "#007bff", textDecoration: "none" }}
        >
          Back to Login
        </Link>
      </p>
    </div>
  );
}

export default ResetPassword;
