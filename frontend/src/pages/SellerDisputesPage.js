import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchSellerDisputes } from "../api/disputes";
import DisputeCard from "../components/DisputeCard";

export default function SellerDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchSellerDisputes()
      .then((res) => setDisputes(res.data || []))
      .catch(() => setError("Failed to load disputes."));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <button type="button" onClick={() => navigate("/seller-dashboard")} style={{ marginBottom: 16, border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>
        ← Seller Dashboard
      </button>
      <h1 style={{ margin: "0 0 6px", color: "#0f172a" }}>My Disputes</h1>
      <p style={{ margin: "0 0 20px", color: "#64748b" }}>Track open and resolved disputes.</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <div style={{ display: "grid", gap: 14 }}>
        {disputes.length === 0 ? (
          <p style={{ color: "#64748b" }}>No disputes found.</p>
        ) : (
          disputes.map((d) => (
            <DisputeCard
              key={d.id}
              dispute={d}
              view="seller"
              detailLink={`/seller/disputes/${d.id}`}
            />
          ))
        )}
      </div>
      <p style={{ marginTop: 16 }}>
        <Link to="/seller/trust-center" style={{ color: "#2563eb" }}>Trust Center →</Link>
      </p>
    </div>
  );
}
