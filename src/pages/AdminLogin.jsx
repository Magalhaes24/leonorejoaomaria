import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/authContext.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import PageTransition from "../components/PageTransition.jsx";

const AdminLogin = () => {
  const { t } = useTranslation();
  const { login, setError } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      await login(form.email, form.password);
      setError(null);
      navigate(from, { replace: true });
    } catch (error) {
      setStatus("error");
      setMessage(t("admin.invalid"));
      setError(error);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-hero-glow bg-grain">
        <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
          <Card className="space-y-6">
            <div>
              <p className="section-kicker">{t("admin.title")}</p>
              <h1 className="text-2xl font-semibold">{t("admin.loginTitle")}</h1>
              <p className="text-sm text-pearl-700 dark:text-ink-300">
                {t("admin.loginSubtitle")}
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400" htmlFor="email">
                  {t("form.email")}
                </label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </div>
              <div>
                <label
                  className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400"
                  htmlFor="password"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </div>
              <Button type="submit" disabled={status === "loading"}>
                {t("actions.signIn")}
              </Button>
              {message && <p className="text-sm text-pearl-600">{message}</p>}
            </form>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminLogin;

