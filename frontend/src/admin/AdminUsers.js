import { useEffect, useState } from "react";
import { banAdminUser, deleteAdminUser, fetchAdminUsers } from "../api/admin";

const ADMIN_ROLES = ["admin", "super_admin"];

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchAdminUsers()
      .then((res) => setUsers(res.data))
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleBan = async (id) => {
    if (!window.confirm("Ban this user? They will not be able to log in.")) return;
    try {
      await banAdminUser(id);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Ban failed.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this user?")) return;
    try {
      await deleteAdminUser(id);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Delete failed.");
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">Users</h2>
      <p className="admin-page-subtitle">Manage buyer and seller accounts.</p>
      {error && <div className="admin-error">{error}</div>}
      {loading ? (
        <p>Loading users…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td className={u.is_active ? "status-active" : "status-banned"}>
                  {u.is_active ? "ACTIVE" : "BANNED"}
                </td>
                <td>
                  {!ADMIN_ROLES.includes(u.role) && (
                    <>
                      {u.is_active && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-warning"
                          onClick={() => handleBan(u.id)}
                        >
                          Ban
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        onClick={() => handleDelete(u.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminUsers;
