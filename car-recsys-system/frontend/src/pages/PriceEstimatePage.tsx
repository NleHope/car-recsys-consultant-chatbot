import { useState } from "react";
import {
  DollarSign, Activity, Settings2, Upload, TrendingUp, ChevronDown
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// ─── Brand → Engine mapping (from dataset) ────────────────────────────────────
const BRAND_ENGINE_MAP = {
  "Acura": ["1.5L I4","1.5L I4 Turbo","2.0L","2.0L I4","2.0L I4 Turbo","3.0L V6","3.5L V6","3.7L V6"],
  "Alfa Romeo": ["2.0L I4","2.0L I4 Turbo","2.9L V6","I4"],
  "Audi": ["2.0L","2.0L I4","2.0L I4 Turbo","2.0L I4 Turbo Hybrid","3.0L V6","3.0L V6 Supercharged","3.0L V6 Turbo","I4"],
  "Bentley": ["4.0L V8","4.0L V8 Twin Turbo"],
  "BMW": ["2.0L I4","2.0L I4 Turbo","3.0L I6","3.0L I6 Turbo","3.0L I6 Turbo Hybrid","3.0L I6 Twin Turbo Hybrid","4.4L V8","4.4L V8 Twin Turbo","4.4L V8 Twin Turbo Hybrid","I4","I6"],
  "Cadillac": ["2.0L I4","2.0L I4 Turbo","3.0L I6 Duramax","3.6L V6","6.2L V8","6.2L V8 EcoTec3","6.2L V8 Supercharged"],
  "Chevrolet": ["1.2L I3","1.2L I3 Turbo","1.3L I3","1.3L I3 Turbo","1.4L I4 Turbo","1.5L I4","1.5L I4 Turbo","2.0L I4","2.0L I4 Turbo","2.5L I4","2.5L I4 Turbo","2.7L I4","2.7L I4 Turbo","3.0L I6","3.0L I6 Duramax","3.0L I6 Turbo Diesel","3.6L V6","4.3L V6","4.3L V6 EcoTec3","5.3L V8","5.3L V8 EcoTec3","5.5L V8","5.7L V8","6.0L V8","6.2L V8","6.2L V8 EcoTec3","6.2L V8 Supercharged","6.6L Duramax","6.6L V8","6.6L V8 Duramax Turbo","6.6L V8 Turbo Diesel","I3","I4","V6","V8"],
  "Chrysler": ["3.6L V6"],
  "Dodge": ["3.6L V6","5.7L V8","5.7L V8 HEMI","6.2L V8 HEMI Supercharged","6.2L V8 Supercharged","6.4L V8","6.4L V8 HEMI"],
  "Ferrari": ["3.9L V8","3.9L V8 Twin Turbo"],
  "Fiat": ["1.4L I4 Turbo","2.4L I4"],
  "Ford": ["1.0L I3 EcoBoost","1.5L EcoBoost","1.5L I3 EcoBoost","1.5L I3 Turbo","1.5L I4 EcoBoost","2.0L I4","2.0L I4 EcoBoost","2.0L I4 Turbo","2.3L I4 EcoBoost","2.3L I4 EcoBoost Turbo","2.3L I4 Turbo","2.7L EcoBoost","2.7L V6 EcoBoost","2.7L V6 Twin Turbo","3.0L V6 EcoBoost","3.0L V6 Twin Turbo","3.3L V6","3.5L","3.5L V6","3.5L V6 EcoBoost","3.5L V6 Hybrid","3.5L V6 Twin Turbo","3.5L V6 Twin Turbo Hybrid","3.7L V6","4.0L V6","4.6L V8","5.0L V8","5.2L V8","5.2L V8 Supercharged","6.2L V8","6.7L V8","6.7L V8 PowerStroke","6.7L V8 PowerStroke Turbo","6.7L V8 Turbo Diesel","7.3L V8","V6"],
  "GMC": ["1.5L I4","1.5L I4 Turbo","2.0L I4","2.0L I4 Turbo","2.5L I4","2.5L I4 Turbo","2.7L","2.7L I4","2.7L I4 Turbo","3.0L I6","3.0L I6 Duramax","3.0L I6 Turbo Diesel","3.6L V6","4.3L V6","5.3L V8","5.3L V8 EcoTec3","6.2L V8","6.2L V8 EcoTec3","6.6L V8","6.6L V8 Duramax Turbo","6.6L V8 Turbo Diesel","Electric"],
  "Genesis": ["2.0L I4","2.0L I4 Turbo","2.5L","2.5L I4","2.5L I4 Turbo","3.3L V6","3.5L V6","3.5L V6 Twin Turbo"],
  "Honda": ["1.5L I4","1.5L I4 Turbo","1.8L I4","2.0L I4","2.0L I4 Hybrid","2.0L I4 Turbo","2.4L I4","3.5L V6"],
  "Hyundai": ["1.6L I4","1.6L I4 Turbo","1.6L I4 Turbo Hybrid","1.8L I4","2.0L I4","2.4L I4","2.5L I4","2.5L I4 Turbo","3.5L V6","3.8L V6","Electric","I4","V6"],
  "Infiniti": ["2.0L I4 Turbo","3.5L V6","3.5L V6 Twin Turbo","5.6L V8","I4","V8"],
  "Jaguar": ["2.0L I4","2.0L I4 Turbo","5.0L V8","I4"],
  "Jeep": ["2.0L I4","2.0L I4 Turbo","2.0L I4 Turbo Hybrid","2.4L I4","3.0L I6 Twin Turbo","3.0L V6 EcoDiesel","3.2L V6","3.6L V6","5.7L V8","5.7L V8 HEMI","6.4L V8","6.4L V8 HEMI","I4"],
  "Kia": ["1.6L I4","1.6L I4 Turbo","2.0L I4","2.4L I4","2.5L I4","2.5L I4 Turbo","3.3L V6","3.8L V6"],
  "Lamborghini": ["5.2L V10","6.5L V12"],
  "Land Rover": ["2.0L I4","2.0L I4 Turbo","3.0L I6","3.0L I6 Turbo","3.0L V6","3.0L V6 Supercharged","4.4L V8","4.4L V8 Twin Turbo","5.0L","5.0L V8","I4","V6","V8"],
  "Lexus": ["2.4L I4","2.4L I4 Turbo","2.5L I4","3.5L V6","4.6L V8","I4"],
  "Lincoln": ["2.0L I4","2.3L I4 EcoBoost","2.3L I4 Turbo","2.7L V6 EcoBoost","3.0L V6 EcoBoost","3.0L V6 Twin Turbo","3.5L V6","3.5L V6 EcoBoost","3.5L V6 Twin Turbo","V6"],
  "MINI": ["1.5L I3","1.5L I3 Turbo","2.0L I4","2.0L I4 Turbo","Electric"],
  "Maserati": ["3.0L V6","3.0L V6 Twin Turbo"],
  "Mazda": ["2.0L I4","2.0L I4 SKYACTIV","2.5L I4","2.5L I4 Hybrid","2.5L I4 SKYACTIV","2.5L I4 Turbo","3.3L","3.3L I6 SKYACTIV","3.3L I6 Turbo"],
  "Mercedes-Benz": ["2.0L I4","2.0L I4 Turbo","3.0L I6","3.0L I6 Turbo","3.0L V6","3.0L V6 Twin Turbo","3.5L V6","4.0L V8","4.0L V8 Twin Turbo","4.7L V8","4.7L V8 Twin Turbo","5.5L V12 Twin Turbo"],
  "Mitsubishi": ["1.5L I4","1.5L I4 Turbo","2.0L I4","2.4L I4","2.5L","2.5L I4"],
  "Nissan": ["1.5L I3 Turbo","1.6L I4","2.0L I4","2.0L I4 Turbo","2.5L I4","3.5L V6","3.8L V6","5.6L V8","I4","V6"],
  "Porsche": ["2.9L V6 Twin Turbo","3.0L Boxer-6","3.0L V6","3.0L V6 Turbo","3.6L V6","3.8L Boxer-6","4.0L V8"],
  "Ram": ["3.0L I6","3.0L I6 Twin Turbo","3.0L V6 EcoDiesel","3.0L V6 Turbo Diesel","3.6L V6","3.6L V6 Hybrid","5.7L","5.7L V8","5.7L V8 HEMI","5.7L V8 Hybrid","6.2L V8 HEMI Supercharged","6.2L V8 Supercharged","6.4L V8","6.4L V8 HEMI","6.7L I6 Cummins","6.7L I6 Cummins Turbo","6.7L I6 Turbo Diesel","V8"],
  "Subaru": ["2.0L Boxer-4","2.4L","2.4L Boxer-4","2.4L Boxer-4 Turbo","2.5L Boxer-4","2.5L I4","3.6L Boxer-6","Electric"],
  "Toyota": ["1.8L I4","2.0L I4","2.4L I4","2.4L I4 Turbo","2.5L I4","2.5L I4 Hybrid","2.7L I4","3.4L V6","3.4L V6 Twin Turbo","3.5L V6","4.0L V6","4.6L V8"],
  "Volkswagen": ["1.5L I4","1.5L I4 Turbo","2.0L","2.0L I4","2.0L I4 Turbo","3.6L V6"],
  "Volvo": ["2.0L I4","2.0L I4 Turbo","2.0L I4 Turbo Hybrid","2.5L I5 Turbo"],
  "Other": [],
};

const BRAND_OPTIONS = Object.keys(BRAND_ENGINE_MAP).sort();
const STYLE_OPTIONS = ["Sedan","SUV","Truck","Hatchback","Coupe","Minivan","Van","Wagon","Convertible","Other"];
const FUEL_OPTIONS = ["Gasoline","Hybrid","Electric","Diesel","Plug-In Hybrid","Other"];
const TRANSMISSION_OPTIONS = ["Automatic","Manual","Automatic CVT","1-Speed Automatic","6-Speed Automatic","8-Speed Automatic","9-Speed Automatic","Other"];
const CONDITION_OPTIONS = ["Used","New","CPO","Other"];
const RATINGS = ["reliability","performance","exterior","interior","comfort"];

const RATING_LABELS = {
  reliability: "Reliability",
  performance: "Performance",
  exterior: "Exterior",
  interior: "Interior",
  comfort: "Comfort",
};

// ─── Design tokens — warm charcoal + gold (matches the refined LoginPage) ─────
const T = {
  bg:          "#0f0f11",
  card:        "rgba(255,255,255,0.03)",
  cardHover:   "rgba(255,255,255,0.05)",
  border:      "rgba(255,255,255,0.08)",
  borderHover: "rgba(168,118,1,0.45)",
  fg:          "#f4f4f5",
  fgMuted:     "#a1a1aa",
  gold:        "#E0A82E",              // brighter gold for text/accents on dark
  goldDark:    "#A87601",             // button fill
  goldLight:   "#F0B429",
  goldBg:      "rgba(168,118,1,0.12)",
  goldBorder:  "rgba(168,118,1,0.30)",
  input:       "rgba(255,255,255,0.04)",
  inputBorder: "rgba(255,255,255,0.12)",
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    backgroundColor: T.bg,
    backgroundImage: `
      radial-gradient(120% 60% at 20% 0%, rgba(168,118,1,0.14), transparent 55%),
      radial-gradient(90% 50% at 90% 8%, rgba(168,118,1,0.06), transparent 60%),
      linear-gradient(180deg, #0f0f11, #0b0b0d)
    `,
    backgroundAttachment: "fixed",
    fontFamily: "'Poppins', 'Inter', sans-serif",
  },
  circle: () => ({ display: "none" }),
  main: {
    flex: 1,
    paddingTop: "96px",
    paddingBottom: "64px",
    position: "relative",
    zIndex: 10,
  },
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "0 24px",
  },
  heading: {
    textAlign: "center",
    marginBottom: "40px",
  },
  h1: {
    fontSize: "clamp(2rem, 4vw, 2.8rem)",
    fontWeight: 700,
    color: T.fg,
    marginBottom: "8px",
    letterSpacing: "-0.02em",
    fontFamily: "'Poppins', 'Inter', sans-serif",
  },
  h1Accent: {
    color: T.gold,
  },
  subtitle: {
    color: T.gold,
    fontSize: "0.78rem",
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  card: {
    background: T.card,
    borderRadius: "18px",
    padding: "28px",
    marginBottom: "18px",
    border: `1px solid ${T.border}`,
    boxShadow: "0 20px 60px -30px rgba(0,0,0,0.7)",
    backdropFilter: "blur(6px)",
    transition: "border-color 0.3s",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  iconBox: {
    padding: "10px",
    borderRadius: "12px",
    background: T.goldBg,
    border: `1px solid ${T.goldBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: T.fg,
    marginBottom: "2px",
    letterSpacing: "0.01em",
  },
  cardSub: {
    fontSize: "0.78rem",
    color: T.fgMuted,
    fontWeight: 300,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: "16px",
  },
  gridFull: {
    gridColumn: "1 / -1",
  },
  grid2Wide: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: T.fgMuted,
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  input: {
    width: "100%",
    height: "46px",
    borderRadius: "10px",
    border: `1px solid ${T.inputBorder}`,
    padding: "0 14px",
    fontSize: "0.9rem",
    color: T.fg,
    background: T.input,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  select: {
    width: "100%",
    height: "46px",
    borderRadius: "10px",
    border: `1px solid ${T.inputBorder}`,
    padding: "0 36px 0 14px",
    fontSize: "0.9rem",
    color: T.fg,
    background: T.input,
    outline: "none",
    appearance: "none",
    cursor: "pointer",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  selectWrapper: {
    position: "relative",
  },
  selectArrow: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: T.fgMuted,
  },
  fieldGroup: {
    marginBottom: "0",
  },
  toggleGroup: {
    display: "flex",
    gap: "8px",
  },
  toggleBtn: (active) => ({
    flex: 1,
    height: "44px",
    borderRadius: "6px",
    border: active ? `1.5px solid ${T.gold}` : `1px solid ${T.border}`,
    background: active ? T.goldBg : T.input,
    color: active ? T.gold : T.fgMuted,
    fontWeight: active ? 600 : 400,
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.15s",
    letterSpacing: "0.02em",
  }),
  uploadArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    minHeight: "100px",
    borderRadius: "6px",
    border: `1.5px dashed ${T.border}`,
    cursor: "pointer",
    background: T.input,
    transition: "border-color 0.2s",
    padding: "20px",
    boxSizing: "border-box",
  },
  // ── Gold buttons: nền đậm mặc định, hover nhạt hơn ──────────────────────────
  submitBtn: (loading) => ({
    width: "100%",
    height: "52px",
    borderRadius: "6px",
    border: "none",
    background: loading ? T.fgMuted : T.goldDark,   // đậm (#6B4801) mặc định
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: loading ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background 0.2s, box-shadow 0.2s, transform 0.15s",
    marginTop: "8px",
    letterSpacing: "0.04em",
    opacity: loading ? 0.7 : 1,
  }),
  errorBox: {
    background: "rgba(220,38,38,0.1)",
    border: "1px solid rgba(220,38,38,0.3)",
    color: "#f87171",
    borderRadius: "6px",
    padding: "16px",
    fontSize: "0.875rem",
    fontWeight: 500,
    marginBottom: "12px",
  },
  resultCard: {
    background: T.card,
    borderRadius: "6px",
    padding: "24px",
    marginBottom: "12px",
    border: `1px solid ${T.goldBorder}`,
  },
  priceBox: {
    borderRadius: "6px",
    background: "hsl(210,20%,96%)",
    border: "1px solid hsl(210,15%,88%)",
    padding: "32px 16px",
    textAlign: "center",
    marginBottom: "14px",
  },
  priceLabel: {
    fontSize: "0.68rem",
    fontWeight: 600,
    color: T.gold,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    marginBottom: "8px",
  },
  priceValue: {
    fontSize: "clamp(2rem, 6vw, 3rem)",
    fontWeight: 700,
    color: "hsl(222,32%,14%)",
    letterSpacing: "-0.02em",
    fontFamily: "'Cormorant Garamond', serif",
  },
  rangeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  rangeBox: {
    borderRadius: "6px",
    border: `1px solid ${T.border}`,
    background: T.input,
    padding: "14px",
    textAlign: "center",
  },
  rangeLbl: {
    fontSize: "0.68rem",
    fontWeight: 600,
    color: T.fgMuted,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "4px",
  },
  rangeVal: {
    fontSize: "1.35rem",
    fontWeight: 700,
    color: T.fg,
    fontFamily: "'Cormorant Garamond', serif",
  },
  dinoNote: {
    marginTop: "12px",
    fontSize: "0.75rem",
    color: T.fgMuted,
    textAlign: "center",
  },
  actionBtnRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "8px",
  },
  clearBtn: (loading) => ({
    width: "100%",
    height: "52px",
    borderRadius: "6px",
    border: `1px solid ${T.border}`,
    background: T.input,
    color: T.fgMuted,
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    letterSpacing: "0.04em",
    transition: "background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s",
  }),
  estimateAgainBtn: (loading) => ({
    width: "100%",
    height: "52px",
    borderRadius: "6px",
    border: "none",
    background: loading ? T.fgMuted : T.goldDark,   // đậm (#6B4801) mặc định
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: loading ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    letterSpacing: "0.04em",
    transition: "background 0.2s, box-shadow 0.2s, transform 0.15s",
    opacity: loading ? 0.7 : 1,
  }),
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    background: "rgba(10,14,26,0.95)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    height: "72px",
    display: "flex",
    alignItems: "center",
    padding: "0 32px",
    borderBottom: `1px solid ${T.border}`,
  },
  headerTitle: {
    color: T.fg,
    fontWeight: 600,
    fontSize: "1.5rem",
    letterSpacing: "-0.01em",
    fontFamily: "'Jost', sans-serif",
  },
  headerAccent: {
    color: T.gold,
  },
  headerSub: {
    color: T.fgMuted,
    fontSize: "0.75rem",
    marginLeft: "12px",
    fontWeight: 300,
    letterSpacing: "0.04em",
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
  <label style={styles.label}>{children}</label>
);

const TextInput = ({ value, onChange, placeholder, type = "text", min, max, step }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    min={min}
    max={max}
    step={step}
    style={styles.input}
    onFocus={e => (e.target.style.borderColor = T.gold)}
    onBlur={e => (e.target.style.borderColor = T.inputBorder)}
  />
);

const SelectField = ({ value, onChange, options, placeholder }) => (
  <div style={styles.selectWrapper}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={styles.select}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
    <div style={styles.selectArrow}><ChevronDown size={16} /></div>
  </div>
);

const CardSection = ({ icon: Icon, title, sub, children }) => (
  <div style={styles.card}>
    <div style={styles.cardHeader}>
      <div style={styles.iconBox}>
        <Icon size={20} color={T.gold} />
      </div>
      <div>
        <div style={styles.cardTitle}>{title}</div>
        {sub && <div style={styles.cardSub}>{sub}</div>}
      </div>
    </div>
    {children}
  </div>
);

// ─── Default form values ───────────────────────────────────────────────────────
const INITIAL_FORM = {
  title: "",
  exterior_color: "",
  brand: "Toyota",
  brand_other: "",
  model_style: "Sedan",
  model_style_other: "",
  fuel_type: "Gasoline",
  fuel_type_other: "",
  transmission: "Automatic",
  transmission_other: "",
  condition: "Used",
  condition_other: "",
  engine: "2.5L I4",
  year: 2022,
  mileage: 15000,
  has_accidents: "NO",
  warranty: "NO",
  rating_reliability: 4.5,
  rating_performance: 4.5,
  rating_exterior: 4.5,
  rating_interior: 4.5,
  rating_comfort: 4.5,
};

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function PriceEstimatePage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState(null);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleBrandChange = (brand) => {
    const engines = BRAND_ENGINE_MAP[brand] || [];
    set("brand", brand);
    set("engine", engines[0] || "");
  };

  const engineOptions = BRAND_ENGINE_MAP[form.brand] || [];

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setApiError(null);
    setResult(null);

    const submitData = new FormData();

    submitData.append("title", form.title || "Unknown");
    submitData.append("engine", form.engine || "Unknown");
    submitData.append("exterior_color", form.exterior_color || "Unknown");
    submitData.append("year", form.year);
    submitData.append("mileage", form.mileage);

    submitData.append("brand", form.brand === "Other" ? (form.brand_other || "Unknown") : form.brand);
    submitData.append("model_style", form.model_style === "Other" ? (form.model_style_other || "Unknown") : form.model_style);
    submitData.append("fuel_type", form.fuel_type === "Other" ? (form.fuel_type_other || "Unknown") : form.fuel_type);
    submitData.append("transmission", form.transmission === "Other" ? (form.transmission_other || "Unknown") : form.transmission);
    submitData.append("condition", form.condition === "Other" ? (form.condition_other || "Used") : form.condition);

    const isAccidents = form.has_accidents === true || form.has_accidents === "YES";
    submitData.append("has_accidents", isAccidents ? "YES" : "NO");

    const isWarranty = form.warranty === true || form.warranty === "YES";
    submitData.append("warranty", isWarranty ? "YES" : "NO");

    submitData.append("rating_reliability", form.rating_reliability || 4.5);
    submitData.append("rating_performance", form.rating_performance || 4.5);
    submitData.append("rating_exterior", form.rating_exterior || 4.5);
    submitData.append("rating_interior", form.rating_interior || 4.5);
    submitData.append("rating_comfort", form.rating_comfort || 4.5);

    if (images && images.length > 0) {
      Array.from(images).forEach(img => {
        submitData.append("images", img);
      });
    }

    try {
      const API_BASE = import.meta.env.VITE_PRICE_API_URL || 'https://car-price-backend-893613114700.us-central1.run.app';
      const response = await fetch(`${API_BASE}/predict_price`, {
        method: 'POST',
        body: submitData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Lỗi máy chủ: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    setForm(INITIAL_FORM);
    setImages([]);
    setResult(null);
    setApiError(null);
  };

  return (
    <div style={styles.page}>
      {/* Shared CarMarket site header (replaces the estimator's standalone header) */}
      <Header />

      <main style={styles.main}>
        <div style={styles.container}>
          {/* Heading */}
          <div style={styles.heading}>
            <h1 style={styles.h1}>
              Estimate Your <span style={styles.h1Accent}>Car Price</span>
            </h1>
            <p style={styles.subtitle}>AI-Powered Valuation</p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* ── 1. General Information ── */}
            <CardSection icon={Settings2} title="General Information">

              <div style={{ marginBottom: "16px" }}>
                <FieldLabel>Car Full Title *</FieldLabel>
                <TextInput
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="e.g. 2022 Toyota Camry SE AWD"
                />
              </div>

              <div style={{ ...styles.grid3, marginBottom: "16px" }}>
                <div>
                  <FieldLabel>Year *</FieldLabel>
                  <TextInput
                    type="number"
                    value={form.year}
                    onChange={e => set("year", Number(e.target.value))}
                    min={1990}
                    max={2026}
                  />
                </div>
                <div>
                  <FieldLabel>Mileage *</FieldLabel>
                  <TextInput
                    type="number"
                    value={form.mileage}
                    onChange={e => set("mileage", Number(e.target.value))}
                    min={0}
                    placeholder="e.g. 25000"
                  />
                </div>
                <div>
                  <FieldLabel>Exterior Color *</FieldLabel>
                  <TextInput
                    value={form.exterior_color}
                    onChange={e => set("exterior_color", e.target.value)}
                    placeholder="e.g. White, Black..."
                  />
                </div>
              </div>

              <div style={{ ...styles.grid2, marginBottom: "16px" }}>
                <div>
                  <FieldLabel>Brand *</FieldLabel>
                  <SelectField
                    value={form.brand}
                    onChange={handleBrandChange}
                    options={BRAND_OPTIONS}
                  />
                  {form.brand === "Other" && (
                    <div style={{ marginTop: "8px" }}>
                      <TextInput
                        value={form.brand_other}
                        onChange={e => set("brand_other", e.target.value)}
                        placeholder="Enter brand..."
                      />
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel>Engine *</FieldLabel>
                  {engineOptions.length > 0 ? (
                    <SelectField
                      value={form.engine}
                      onChange={v => set("engine", v)}
                      options={engineOptions}
                    />
                  ) : (
                    <TextInput
                      value={form.engine}
                      onChange={e => set("engine", e.target.value)}
                      placeholder="e.g. 2.0L I4 Turbo, Electric..."
                    />
                  )}
                  <p style={{ fontSize: "0.72rem", color: T.fgMuted, marginTop: "4px" }}>
                    {engineOptions.length > 0
                      ? `${engineOptions.length} engines available for ${form.brand}`
                      : "Enter manually"}
                  </p>
                </div>
              </div>

              <div style={styles.grid4}>
                <div>
                  <FieldLabel>Body Style *</FieldLabel>
                  <SelectField
                    value={form.model_style}
                    onChange={v => set("model_style", v)}
                    options={STYLE_OPTIONS}
                  />
                  {form.model_style === "Other" && (
                    <div style={{ marginTop: "8px" }}>
                      <TextInput
                        value={form.model_style_other}
                        onChange={e => set("model_style_other", e.target.value)}
                        placeholder="Enter style..."
                      />
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel>Fuel Type *</FieldLabel>
                  <SelectField
                    value={form.fuel_type}
                    onChange={v => set("fuel_type", v)}
                    options={FUEL_OPTIONS}
                  />
                  {form.fuel_type === "Other" && (
                    <div style={{ marginTop: "8px" }}>
                      <TextInput
                        value={form.fuel_type_other}
                        onChange={e => set("fuel_type_other", e.target.value)}
                        placeholder="Enter fuel type..."
                      />
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel>Transmission *</FieldLabel>
                  <SelectField
                    value={form.transmission}
                    onChange={v => set("transmission", v)}
                    options={TRANSMISSION_OPTIONS}
                  />
                  {form.transmission === "Other" && (
                    <div style={{ marginTop: "8px" }}>
                      <TextInput
                        value={form.transmission_other}
                        onChange={e => set("transmission_other", e.target.value)}
                        placeholder="Enter transmission..."
                      />
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel>Condition *</FieldLabel>
                  <SelectField
                    value={form.condition}
                    onChange={v => set("condition", v)}
                    options={CONDITION_OPTIONS}
                  />
                  {form.condition === "Other" && (
                    <div style={{ marginTop: "8px" }}>
                      <TextInput
                        value={form.condition_other}
                        onChange={e => set("condition_other", e.target.value)}
                        placeholder="Enter condition..."
                      />
                    </div>
                  )}
                </div>
              </div>

            </CardSection>

            {/* ── 2. Car History & Ratings ── */}
            <CardSection icon={Activity} title="Car History & Ratings">

              <div style={{ ...styles.grid2, marginBottom: "20px" }}>
                <div>
                  <FieldLabel>Has Accident?</FieldLabel>
                  <div style={styles.toggleGroup}>
                    {["NO", "YES"].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set("has_accidents", v)}
                        style={styles.toggleBtn(form.has_accidents === v)}
                        onMouseEnter={e => {
                          if (form.has_accidents !== v) {
                            e.currentTarget.style.borderColor = T.gold;
                            e.currentTarget.style.color = T.gold;
                          }
                        }}
                        onMouseLeave={e => {
                          if (form.has_accidents !== v) {
                            e.currentTarget.style.borderColor = T.border;
                            e.currentTarget.style.color = T.fgMuted;
                          }
                        }}
                      >
                        {v === "NO" ? "No" : "Yes"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel>Warranty?</FieldLabel>
                  <div style={styles.toggleGroup}>
                    {["NO", "YES"].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set("warranty", v)}
                        style={styles.toggleBtn(form.warranty === v)}
                        onMouseEnter={e => {
                          if (form.warranty !== v) {
                            e.currentTarget.style.borderColor = T.gold;
                            e.currentTarget.style.color = T.gold;
                          }
                        }}
                        onMouseLeave={e => {
                          if (form.warranty !== v) {
                            e.currentTarget.style.borderColor = T.border;
                            e.currentTarget.style.color = T.fgMuted;
                          }
                        }}
                      >
                        {v === "NO" ? "No" : "Yes"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ ...styles.grid3, marginBottom: "12px" }}>
                {RATINGS.slice(0, 3).map(r => (
                  <div key={r}>
                    <FieldLabel>{RATING_LABELS[r]}</FieldLabel>
                    <TextInput
                      type="number"
                      step={0.1}
                      min={0}
                      max={5}
                      value={form[`rating_${r}`]}
                      onChange={e => set(`rating_${r}`, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
              <div style={styles.grid2}>
                {RATINGS.slice(3).map(r => (
                  <div key={r}>
                    <FieldLabel>{RATING_LABELS[r]}</FieldLabel>
                    <TextInput
                      type="number"
                      step={0.1}
                      min={0}
                      max={5}
                      value={form[`rating_${r}`]}
                      onChange={e => set(`rating_${r}`, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>

            </CardSection>

            {/* ── 3. Upload Car Images ── */}
            <CardSection icon={Upload} title="Upload Car Images">
              <label
                htmlFor="image-upload"
                style={styles.uploadArea}
                onMouseOver={e => (e.currentTarget.style.borderColor = T.gold)}
                onMouseOut={e => (e.currentTarget.style.borderColor = T.border)}
              >
                <Upload size={28} color={T.fgMuted} />
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: T.fgMuted }}>
                  {images.length > 0
                    ? `✓ ${images.length} image selected`
                    : "Select Images"}
                </span>
                <span style={{ fontSize: "0.72rem", color: T.fgMuted, opacity: 0.7 }}>
                  You can skip — model can still make prediction
                </span>
              </label>
              <input
                id="image-upload"
                type="file"
                multiple
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => setImages(Array.from(e.target.files ?? []))}
              />
            </CardSection>

            {/* ── Error ── */}
            {apiError && (
              <div style={styles.errorBox}>
                ❌ {apiError}
              </div>
            )}

            {/* ── Result ── */}
            {result && (
              <div style={styles.resultCard}>
                <div style={styles.cardHeader}>
                  <div style={styles.iconBox}>
                    <TrendingUp size={20} color={T.gold} />
                  </div>
                  <div>
                    <div style={styles.cardTitle}>Price Estimate</div>
                    <div style={styles.cardSub}>{result.car_info}</div>
                  </div>
                </div>

                <div style={styles.priceBox}>
                  <div style={styles.priceLabel}>Suggested Price</div>
                  <div style={styles.priceValue}>
                    ${result.estimated_price_usd?.toLocaleString()}
                  </div>
                </div>

                <div style={styles.rangeGrid}>
                  <div style={styles.rangeBox}>
                    <div style={styles.rangeLbl}>Quick Sale</div>
                    <div style={styles.rangeVal}>
                      ${result.price_range_usd?.low?.toLocaleString()}
                    </div>
                  </div>
                  <div style={styles.rangeBox}>
                    <div style={styles.rangeLbl}>Pending Price</div>
                    <div style={styles.rangeVal}>
                      ${result.price_range_usd?.high?.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Submit / Action buttons ── */}
            {result ? (
              <div style={styles.actionBtnRow}>
                {/* Clear All */}
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={styles.clearBtn(loading)}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(220,38,38,0.08)";
                    e.currentTarget.style.borderColor = "rgba(220,38,38,0.4)";
                    e.currentTarget.style.color = "#f87171";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = T.input;
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.color = T.fgMuted;
                  }}
                >
                  Clear All
                </button>

                {/* Estimate Again — nền đậm, hover nhạt */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                  style={styles.estimateAgainBtn(loading)}
                  onMouseEnter={e => {
                    if (!loading) {
                      e.currentTarget.style.background = T.gold;          // nhạt hơn khi hover
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(168,118,1,0.35)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!loading) {
                      e.currentTarget.style.background = T.goldDark;      // về đậm khi rời
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  <DollarSign size={20} />
                  {loading ? "Model is working..." : "Estimate Again"}
                </button>
              </div>
            ) : (
              /* Estimate price — nền đậm, hover nhạt */
              <button
                type="submit"
                disabled={loading}
                style={styles.submitBtn(loading)}
                onMouseEnter={e => {
                  if (!loading) {
                    e.currentTarget.style.background = T.gold;            // nhạt hơn khi hover
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(168,118,1,0.35)";
                  }
                }}
                onMouseLeave={e => {
                  if (!loading) {
                    e.currentTarget.style.background = T.goldDark;        // về đậm khi rời
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                <DollarSign size={20} />
                {loading ? "Model is working..." : "Estimate price for your car"}
              </button>
            )}

          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}