import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { useSeo } from "../lib/seo.js";
import { useContent } from "../data/contentStore.jsx";
import { pickLocale } from "../lib/locale.js";
import { db } from "../lib/firebase.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Textarea from "../components/ui/Textarea.jsx";
import PageTransition from "../components/PageTransition.jsx";
import SectionReveal from "../components/SectionReveal.jsx";

const Contact = () => {
  const { t, i18n } = useTranslation();
  const { restaurant, hours } = useContent();
  const lang = i18n.language;
  const brand = pickLocale(restaurant?.name, lang) || "Lumeo";

  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  useSeo({
    title: `${brand} - ${t("nav.contact")}`,
    description: t("seo.contactDescription"),
    ogTitle: `${brand} - ${t("nav.contact")}`,
    ogDescription: t("seo.contactDescription"),
    ogImage: "/og-placeholder.svg",
  });

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = t("form.required");
    if (!form.email.trim()) nextErrors.email = t("form.required");
    if (!form.message.trim()) nextErrors.message = t("form.required");
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setStatus("loading");
    try {
      if (!db) {
        throw new Error("Firestore unavailable.");
      }
      await addDoc(collection(db, "contactRequests"), {
        ...form,
        createdAt: serverTimestamp(),
        language: lang,
      });
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <PageTransition>
      <section className="space-y-12">
        <div>
          <p className="section-kicker">{t("contact.kicker")}</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {t("contact.title")}
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionReveal>
            <Card>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400" htmlFor="name">
                    {t("form.name")}
                  </label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className="mt-1 text-xs text-pearl-600">{errors.name}</p>}
                </div>
                <div>
                  <label
                    className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400"
                    htmlFor="email"
                  >
                    {t("form.email")}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && <p className="mt-1 text-xs text-pearl-600">{errors.email}</p>}
                </div>
                <div>
                  <label
                    className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400"
                    htmlFor="message"
                  >
                    {t("form.message")}
                  </label>
                  <Textarea
                    id="message"
                    rows="4"
                    value={form.message}
                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                    aria-invalid={Boolean(errors.message)}
                  />
                  {errors.message && (
                    <p className="mt-1 text-xs text-pearl-600">{errors.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={status === "loading"}>
                  {t("form.send")}
                </Button>
                {status === "success" && (
                  <p className="text-sm text-pearl-700">{t("form.success")}</p>
                )}
                {status === "error" && (
                  <p className="text-sm text-pearl-600">{t("form.error")}</p>
                )}
              </form>
            </Card>
          </SectionReveal>

          <SectionReveal>
            <Card className="space-y-4">
              <p className="section-kicker">{t("contact.details")}</p>
              <p className="text-sm text-pearl-700 dark:text-ink-300">
                {pickLocale(restaurant?.address, lang) || t("fallback")}
              </p>
              <div className="text-sm text-pearl-800 dark:text-ink-300">
                <p>{restaurant?.phone}</p>
                <p>{restaurant?.email}</p>
              </div>
              <div className="space-y-2 text-sm text-pearl-800 dark:text-ink-300">
                {(hours?.entries || []).map((entry, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{pickLocale(entry.label, lang)}</span>
                    <span>
                      {entry.open} - {entry.close}
                    </span>
                  </div>
                ))}
                {!hours?.entries?.length && <p>{t("admin.empty")}</p>}
              </div>
              <iframe
                title={t("labels.map")}
                className="h-40 w-full rounded-2xl border border-pearl-100/80"
                src="https://www.google.com/maps?q=Rua%20do%20Arsenal%2018%2C%20Lisbon&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </Card>
          </SectionReveal>
        </div>
      </section>
    </PageTransition>
  );
};

export default Contact;

