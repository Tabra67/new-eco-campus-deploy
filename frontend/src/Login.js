
import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    const token = localStorage.getItem("authToken");

    if (token) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/users/login/",
        {
          email: email.trim(),
          password: password,
        }
      );

      localStorage.setItem("authToken", response.data.token);

      if (response.data.access) {
        localStorage.setItem("accessToken", response.data.access);
      }

      if (response.data.refresh) {
        localStorage.setItem("refreshToken", response.data.refresh);
      }

      localStorage.setItem("user", JSON.stringify(response.data.user));

      console.log("Login response:", response.data);

      const userRole = response.data.user?.role;

      if (userRole === "admin" || userRole === "super_admin") {
        setMessage("Please use the admin login page at /admin-login/");

        // Remove tokens because admin login uses a separate page
        localStorage.removeItem("authToken");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        setIsLoading(false);
        return;
      }

      const redirectPath =
        userRole === "seller"
          ? "/seller-dashboard"
          : "/dashboard";

      setLoginSuccess(true);

      navigate(redirectPath, { replace: true });

    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;

        if (typeof errorData === "object") {
          const errorMessages = Object.entries(errorData)
            .map(([key, value]) => {
              const messageText = Array.isArray(value)
                ? value.join(" ")
                : typeof value === "string"
                ? value
                : JSON.stringify(value);

              return `${key}: ${messageText}`;
            })
            .join(", ");

          setMessage(errorMessages);
        } else {
          setMessage(JSON.stringify(errorData));
        }

      } else {
        setMessage(
          "Server not reachable. Check your internet connection or Django server."
        );
      }

    } finally {
      setIsLoading(false);
    }
  };

  // If login was successful and redirecting
  if (loginSuccess) {
    const storedUser = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    const userRole = storedUser?.role;

    const dest =
      userRole === "seller"
        ? "Seller Dashboard"
        : "Dashboard";

    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <p style={{ color: "green", fontSize: "18px" }}>
          Login successful!
        </p>

        <p>Redirecting to {dest}...</p>

        <Link
          to={
            userRole === "seller"
              ? "/seller-dashboard"
              : "/dashboard"
          }
          style={{
            color: "#007bff",
            textDecoration: "none",
          }}
        >
          Click here to go to {dest}
        </Link>
      </div>
    );
  }

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
      <h2>Eco-Campus Login</h2>

      <p style={{ color: "#666", fontSize: "14px" }}>
        Login using your registered email address.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <input
            type="email"
            placeholder="Enter your email address"
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
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>

      <div style={{ marginTop: "20px" }}>
        <Link
          to="/forgot-password"
          style={{
            color: "#007bff",
            textDecoration: "none",
          }}
        >
          Forgot Password?
        </Link>
      </div>

      {message && (
        <p style={{ marginTop: "20px", color: "red" }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: "20px" }}>
        Don't have an account?{" "}
        <Link
          to="/register"
          style={{
            color: "#007bff",
            textDecoration: "none",
          }}
        >
          Register
        </Link>
      </p>

      <div
        style={{
          marginTop: "30px",
          paddingTop: "20px",
          borderTop: "1px solid #eee",
        }}
      >
        <Link
          to="/dashboard"
          style={{
            color: "#4CAF50",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
}

export default Login;
