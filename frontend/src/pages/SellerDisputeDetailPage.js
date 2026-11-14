import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchDisputeDetail,
  respondToDispute,
  postDisputeMessage,
  uploadDisputeEvidence,
} from "../api/disputes";
import DisputeCard from "../components/DisputeCard";
import TrustInline from "../components/TrustBadge";

export default function SellerDisputeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dispute, setDispute] = useState(null);
  const [response, setResponse] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetchDisputeDetail(id)
      .then((res) => setDispute(res.data))
      .catch(() => setError("Could not load dispute."));
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleRespond = async () => {
    if (!response.trim()) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("message", response);
      if (file) form.append("attachment", file);
      await respondToDispute(id, form);
      setResponse("");
      setFile(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to submit response.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvidence = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const form = new FormData();
    form.append("file", f);
    form.append("evidence_type", "image");
    await uploadDisputeEvidence(id, form);
    load();
  };

  if (!dispute && !error) return <p style={{ padding: 24 }}>Loading…</p>;
  if (error && !dispute) return <p style={{ padding: 24, color: "#b91c1c" }}>{error}</p>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <button type="button" onClick={() => navigate("/seller/disputes")} style={{ marginBottom: 16, border: "none", background: "none", cursor: "pointer" }}>
        ← Back to disputes
      </button>

      <DisputeCard dispute={dispute} view="seller" />

      <section style={{ marginTop: 24, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
        <h3 style={{ margin: "0 0 12px" }}>Buyer complaint</h3>
        <p>{dispute.detailed_description || dispute.description}</p>
        {dispute.buyer_trust && (
          <div style={{ marginTop: 12 }}>
            <TrustInline trust={dispute.buyer_trust} />
          </div>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Conversation</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {(dispute.messages || []).map((m) => (
            <div key={m.id} style={{ padding: 10, background: "#f8fafc", borderRadius: 8 }}>
              <strong>{m.sender_name}</strong>
              <p style={{ margin: "4px 0 0" }}>{m.message}</p>
              <small style={{ color: "#94a3b8" }}>{new Date(m.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 20, padding: 18, border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>Seller response</h3>
        <textarea
          rows={5}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Explain your side and proposed resolution…"
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
        />
        <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0])} style={{ marginTop: 10 }} />
        <input type="file" accept="image/*,.pdf" onChange={handleEvidence} style={{ marginTop: 8, display: "block" }} />
        <button
          type="button"
          onClick={handleRespond}
          disabled={submitting}
          style={{ marginTop: 12, padding: "10px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Submit Response
        </button>
      </section>
    </div>
  );
}
