
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_ROOT = (
  process.env.REACT_APP_API_URL ||
  "https://new-eco-campus-deploy.onrender.com"
).replace(/\/+$/, "");

function SellerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showProductForm, setShowProductForm] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const [addForm, setAddForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "Others",
    condition: "New",
    location: "",
    units_available: "",
  });

  const [serviceForm, setServiceForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "Services",
    service_type: "",
    custom_service_type: "",
    location: "",
    units_available: "",
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");

  const API_BASE = `${API_ROOT}/api/marketplace`;

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(false);
  }, [token, navigate]);

  const handleAddProduct = async (e, isService = false) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const form = isService ? serviceForm : addForm;

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.price ||
      parseFloat(form.price) <= 0
    ) {
      setError("Please fill title, description, and valid price.");
      return;
    }

    const resolvedServiceType =
      serviceForm.service_type === "__custom__"
        ? serviceForm.custom_service_type.trim()
        : serviceForm.service_type;

    if (isService && !resolvedServiceType) {
      setError("Please select or enter a service type.");
      return;
    }

    const payload = isService
      ? {
          ...serviceForm,
          service_type: resolvedServiceType,
          category: "Services",
        }
      : { ...addForm };

    if (isService) {
      delete payload.custom_service_type;
      delete payload.condition;
    }

    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== "") {
        formData.append(key, value);
      }
    });

    if (!payload.units_available) {
      formData.set("units_available", "1");
    }

    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      const response = await axios.post(
        `${API_BASE}/products/`,
        formData,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      setSuccess(
        isService ? "Service added successfully!" : "Product added successfully!"
      );

      if (isService) {
        setServiceForm({
          title: "",
          description: "",
          price: "",
          category: "Services",
          service_type: "",
          custom_service_type: "",
          location: "",
          units_available: "",
        });
      } else {
        setAddForm({
          title: "",
          description: "",
          price: "",
          category: "Others",
          condition: "New",
          location: "",
          units_available: "",
        });
      }

      setImagePreview(null);
      setImageFile(null);

      const fileInput = document.getElementById("listing-image");
      if (fileInput) fileInput.value = "";

      console.log("Listing created:", response.data);

      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Product/service upload failed:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      const responseData = err.response?.data;

      if (responseData) {
        if (typeof responseData === "string") {
          setError(responseData);
        } else if (responseData.detail) {
          setError(responseData.detail);
        } else if (responseData.error) {
          setError(responseData.error);
        } else {
          const messages = Object.entries(responseData)
            .map(([field, value]) => {
              const text = Array.isArray(value)
                ? value.join(", ")
                : typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value);

              return `${field}: ${text}`;
            })
            .join(" | ");

          setError(
            messages || `Upload failed with status ${err.response.status}.`
          );
        }
      } else if (err.request) {
        setError(
          "The server did not respond. Please wait a moment and try again."
        );
      } else {
        setError(`Unable to submit listing: ${err.message}`);
      }
    }
  };

  const handleAddService = (e) => handleAddProduct(e, true);

  const handleImage = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Please choose an image smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    setError("");
    setImageFile(file);

    const reader = new FileReader();

    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.onerror = () => setError("Could not preview this image.");

    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        Loading Add Listing...
      </div>
    );
  }

  const addListingStyles = {
    page: {
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 12px",
      fontFamily: "'Segoe UI', Tahoma, sans-serif",
    },
    wrapper: {
      display: "flex",
      justifyContent: "center",
      width: "100%",
    },
    card: {
      width: "100%",
      maxWidth: "820px",
      background: "#ffffff",
      borderRadius: "18px",
      boxShadow: "0 12px 34px rgba(15, 23, 42, 0.12)",
      padding: "28px",
    },
    heading: {
      margin: 0,
      color: "#0f172a",
      fontSize: "30px",
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    subheading: {
      margin: "8px 0 0",
      color: "#64748b",
      fontSize: "15px",
    },
    toggleWrap: {
      marginTop: "22px",
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      padding: "6px",
      borderRadius: "999px",
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    },
    toggleBtn: {
      border: "1px solid #cbd5e1",
      borderRadius: "999px",
      padding: "10px 20px",
      fontWeight: 600,
      fontSize: "14px",
      cursor: "pointer",
      background: "#fff",
      color: "#475569",
      transition: "all 0.2s ease",
    },
    toggleBtnActive: {
      background: "#16a34a",
      borderColor: "#16a34a",
      color: "#fff",
      boxShadow: "0 6px 16px rgba(22, 163, 74, 0.25)",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: "16px",
      marginTop: "24px",
    },
    fullWidth: { gridColumn: "1 / -1" },
    input: {
      width: "100%",
      padding: "12px 14px",
      border: "1px solid #dbe1ea",
      borderRadius: "10px",
      fontSize: "14px",
      color: "#0f172a",
      background: "#ffffff",
      outline: "none",
      boxSizing: "border-box",
    },
    textArea: {
      width: "100%",
      padding: "12px 14px",
      border: "1px solid #dbe1ea",
      borderRadius: "10px",
      fontSize: "14px",
      color: "#0f172a",
      background: "#ffffff",
      outline: "none",
      resize: "vertical",
      minHeight: "120px",
      boxSizing: "border-box",
    },
    uploadBox: {
      border: "1.5px dashed #cbd5e1",
      borderRadius: "12px",
      padding: "16px",
      background: "#f8fafc",
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      alignItems: "center",
    },
    fileInput: {
      padding: "8px",
      background: "#fff",
      border: "1px solid #dbe1ea",
      borderRadius: "8px",
      width: "100%",
      maxWidth: "360px",
    },
    previewThumb: {
      width: "96px",
      height: "96px",
      objectFit: "cover",
      borderRadius: "10px",
      border: "1px solid #dbe1ea",
      boxShadow: "0 3px 12px rgba(15, 23, 42, 0.12)",
    },
    submitBtn: {
      gridColumn: "1 / -1",
      width: "100%",
      background: "#16a34a",
      color: "#fff",
      padding: "14px 18px",
      border: "none",
      borderRadius: "12px",
      fontSize: "16px",
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 10px 20px rgba(22, 163, 74, 0.22)",
      marginTop: "4px",
    },
    alertError: {
      background: "#f8d7da",
      color: "#721c24",
      padding: "12px 14px",
      borderRadius: "8px",
      marginBottom: "16px",
      overflowWrap: "anywhere",
    },
    alertSuccess: {
      background: "#d4edda",
      color: "#155724",
      padding: "12px 14px",
      borderRadius: "8px",
      marginBottom: "16px",
    },
    closeBtn: {
      marginLeft: "10px",
      background: "none",
      border: "none",
      fontSize: "18px",
      cursor: "pointer",
      color: "#721c24",
    },
  };

  return (
    <div style={addListingStyles.page}>
      <div style={addListingStyles.wrapper}>
        <div style={addListingStyles.card}>
          <h2 style={addListingStyles.heading}>Add a listing</h2>
          <p style={addListingStyles.subheading}>
            Create a new product or service.
          </p>

          {error && (
            <div style={addListingStyles.alertError}>
              {error}
              <button
                onClick={() => setError("")}
                style={addListingStyles.closeBtn}
                type="button"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div style={addListingStyles.alertSuccess}>{success}</div>
          )}

          <div style={addListingStyles.toggleWrap}>
            <button
              onClick={() => {
                setShowProductForm(true);
                setShowServiceForm(false);
              }}
              style={{
                ...addListingStyles.toggleBtn,
                ...(showProductForm ? addListingStyles.toggleBtnActive : {}),
              }}
              type="button"
            >
              Product
            </button>

            <button
              onClick={() => {
                setShowServiceForm(true);
                setShowProductForm(false);
              }}
              style={{
                ...addListingStyles.toggleBtn,
                ...(showServiceForm ? addListingStyles.toggleBtnActive : {}),
              }}
              type="button"
            >
              Service
            </button>
          </div>

          {showProductForm && !showServiceForm && (
            <form
              onSubmit={handleAddProduct}
              style={addListingStyles.formGrid}
            >
              <input
                placeholder="Product Title"
                value={addForm.title}
                onChange={(e) =>
                  setAddForm({ ...addForm, title: e.target.value })
                }
                required
                style={{
                  ...addListingStyles.input,
                  ...addListingStyles.fullWidth,
                }}
              />

              <textarea
                placeholder="Description"
                value={addForm.description}
                onChange={(e) =>
                  setAddForm({ ...addForm, description: e.target.value })
                }
                required
                rows="4"
                style={{
                  ...addListingStyles.textArea,
                  ...addListingStyles.fullWidth,
                }}
              />

              <input
                type="number"
                placeholder="Price (Ksh)"
                value={addForm.price}
                onChange={(e) =>
                  setAddForm({ ...addForm, price: e.target.value })
                }
                required
                min="0.01"
                step="0.01"
                style={addListingStyles.input}
              />

              <select
                value={addForm.category}
                onChange={(e) =>
                  setAddForm({ ...addForm, category: e.target.value })
                }
                style={addListingStyles.input}
              >
                <option value="Electronics">Electronics</option>
                <option value="Books">Books</option>
                <option value="Furniture">Furniture</option>
                <option value="Others">Others</option>
              </select>

              <input
                type="number"
                placeholder="Units Available"
                value={addForm.units_available}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    units_available: e.target.value || "",
                  })
                }
                min="1"
                style={addListingStyles.input}
              />

              <select
                value={addForm.condition}
                onChange={(e) =>
                  setAddForm({ ...addForm, condition: e.target.value })
                }
                style={addListingStyles.input}
              >
                <option value="New">New</option>
                <option value="Used">Used</option>
              </select>

              <input
                placeholder="Location"
                value={addForm.location}
                onChange={(e) =>
                  setAddForm({ ...addForm, location: e.target.value })
                }
                required
                style={{
                  ...addListingStyles.input,
                  ...addListingStyles.fullWidth,
                }}
              />

              <div
                style={{
                  ...addListingStyles.uploadBox,
                  ...addListingStyles.fullWidth,
                }}
              >
                <input
                  id="listing-image"
                  type="file"
                  onChange={handleImage}
                  accept="image/*"
                  style={addListingStyles.fileInput}
                />

                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={addListingStyles.previewThumb}
                  />
                )}
              </div>

              <button type="submit" style={addListingStyles.submitBtn}>
                Publish listing
              </button>
            </form>
          )}

          {showServiceForm && !showProductForm && (
            <form
              onSubmit={handleAddService}
              style={addListingStyles.formGrid}
            >
              <input
                placeholder="Service Title *"
                value={serviceForm.title}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, title: e.target.value })
                }
                required
                style={{
                  ...addListingStyles.input,
                  ...addListingStyles.fullWidth,
                }}
              />

              <textarea
                placeholder="Service Description *"
                value={serviceForm.description}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    description: e.target.value,
                  })
                }
                required
                rows="6"
                style={{
                  ...addListingStyles.textArea,
                  ...addListingStyles.fullWidth,
                }}
              />

              <input
                type="number"
                placeholder="Price (Ksh) *"
                value={serviceForm.price}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, price: e.target.value })
                }
                required
                min="0.01"
                step="0.01"
                style={addListingStyles.input}
              />

              <select
                name="service_type"
                value={serviceForm.service_type}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    service_type: e.target.value,
                  })
                }
                required
                style={addListingStyles.input}
              >
                <option value="">Select service type *</option>
                <option value="Hairdressing">Hairdressing</option>
                <option value="Tutoring">Tutoring</option>
                <option value="Graphic Design">Graphic Design</option>
                <option value="Web Development">Web Development</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Photography">Photography</option>
                <option value="Delivery">Delivery</option>
                <option value="Repair Services">Repair Services</option>
                <option value="Event Planning">Event Planning</option>
                <option value="Laundry">Laundry</option>
                <option value="__custom__">Other (type custom service)</option>
              </select>

              {serviceForm.service_type === "__custom__" && (
                <input
                  placeholder="Custom service type *"
                  value={serviceForm.custom_service_type}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      custom_service_type: e.target.value,
                    })
                  }
                  required
                  style={{
                    ...addListingStyles.input,
                    ...addListingStyles.fullWidth,
                  }}
                />
              )}

              <input
                type="number"
                placeholder="Units Available (slots per day)"
                value={serviceForm.units_available}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    units_available: e.target.value || "",
                  })
                }
                min="1"
                style={addListingStyles.input}
              />

              <input
                placeholder="Location *"
                value={serviceForm.location}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    location: e.target.value,
                  })
                }
                required
                style={{
                  ...addListingStyles.input,
                  ...addListingStyles.fullWidth,
                }}
              />

              <input type="hidden" value="Services" readOnly />

              <div
                style={{
                  ...addListingStyles.uploadBox,
                  ...addListingStyles.fullWidth,
                }}
              >
                <input
                  id="listing-image"
                  type="file"
                  onChange={handleImage}
                  accept="image/*"
                  style={addListingStyles.fileInput}
                />

                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={addListingStyles.previewThumb}
                  />
                )}
              </div>

              <button type="submit" style={addListingStyles.submitBtn}>
                Publish listing
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default SellerDashboard;
