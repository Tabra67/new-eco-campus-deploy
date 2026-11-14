import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/users/register/",
        {
          username: username,
          email: email,
          password: password,
          password_confirm: passwordConfirm,
        }
      );

      setMessage(
        "Registration successful! Check your email for verification code."
      );
      
      // Optionally redirect to verification page
      setTimeout(() => {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err) {
      if (err.response) {
        // Handle validation errors
        const errorData = err.response.data;
        if (typeof errorData === "object") {
          // Convert error object to string
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

        <button type="submit">Register</button>
      </form>

      <p style={{ color: message.includes("success") ? "green" : "red" }}>
        {message}
      </p>
    </div>
  );
}

export default Register;

