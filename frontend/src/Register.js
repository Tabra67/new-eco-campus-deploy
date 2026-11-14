
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_ROOT = (
  process.env.REACT_APP_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      await axios.post(`${API_ROOT}/api/users/register/`, {
        username,
        email,
        password,
        password_confirm: passwordConfirm,
      });

      setMessage(
        "Registration successful! Check your email for verification code."
      );

      setTimeout(() => {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;

        if (typeof errorData === "object") {
          const errorMessages = Object.entries(errorData)
            .map(([key, value]) => {
              const formattedValue = Array.isArray(value)
                ? value.join(", ")
                : typeof value === "object"
                  ? JSON.stringify(value)
                  : value;

              return `${key}: ${formattedValue}`;
            })
            .join(", ");

          setMessage(errorMessages);
        } else {
          setMessage(JSON.stringify(errorData));
        }
      } else {
        setMessage("Server not reachable. Check your internet connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Eco-Campus Register</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <br />
        <br />

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
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <br />
        <br />

        <input
          type="password"
          placeholder="Confirm Password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
        />

        <br />
        <br />

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Registering..." : "Register"}
        </button>
      </form>

      <p style={{ color: message.toLowerCase().includes("success") ? "green" : "red" }}>
        {message}
      </p>
    </div>
  );
}

export default Register;
