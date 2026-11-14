import MessagesPage from "./components/messages/MessagesPage";

function MessagesRoutePage({ role }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "20px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <MessagesPage role={role} />
      </div>
    </div>
  );
}

export default MessagesRoutePage;

