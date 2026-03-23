import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
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

const BookTable = () => {
  const { t, i18n } = useTranslation();
  const { restaurant, hours } = useContent();
  const lang = i18n.language;
  const brand = pickLocale(restaurant?.name, lang) || "Lumeo";

  const today = new Date();
  const defaultDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    date: defaultDate,
    time: "",
    guests: "2",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [slotStatus, setSlotStatus] = useState("idle");
  const [reservationCounts, setReservationCounts] = useState({ count: {}, guests: {} });

  useSeo({
    title: `${brand} - ${t("actions.book")}`,
    description: t("seo.bookDescription"),
    ogTitle: `${brand} - ${t("actions.book")}`,
    ogDescription: t("seo.bookDescription"),
    ogImage: "/og-placeholder.svg",
  });

  const scheduleEntry = useMemo(() => {
    const entries = hours?.entries || [];
    if (entries.length === 0 || !form.date) return null;

    const date = new Date(`${form.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return entries[0];
    const dayIndex = date.getDay(); // 0 Sun - 6 Sat
    const labelText = (entry) =>
      `${entry?.label?.pt || ""} ${entry?.label?.en || ""}`.toLowerCase();

    const isMonThu = (label) =>
      (label.includes("segunda") || label.includes("monday")) &&
      (label.includes("quinta") || label.includes("thursday"));
    const isFriSat = (label) =>
      (label.includes("sexta") || label.includes("friday")) &&
      (label.includes("sábado") || label.includes("sabado") || label.includes("saturday"));
    const isSunday = (label) => label.includes("domingo") || label.includes("sunday");

    for (const entry of entries) {
      const label = labelText(entry);
      if (dayIndex >= 1 && dayIndex <= 4 && isMonThu(label)) return entry;
      if (dayIndex >= 5 && dayIndex <= 6 && isFriSat(label)) return entry;
      if (dayIndex === 0 && isSunday(label)) return entry;
    }

    const fallback = entries.find((entry) => {
      const label = labelText(entry);
      const dayMatches = [
        { idx: 1, keys: ["segunda", "monday"] },
        { idx: 2, keys: ["terca", "terça", "tuesday"] },
        { idx: 3, keys: ["quarta", "wednesday"] },
        { idx: 4, keys: ["quinta", "thursday"] },
        { idx: 5, keys: ["sexta", "friday"] },
        { idx: 6, keys: ["sabado", "sábado", "saturday"] },
        { idx: 0, keys: ["domingo", "sunday"] },
      ];
      const match = dayMatches.find((item) => item.idx === dayIndex);
      return match ? match.keys.some((key) => label.includes(key)) : false;
    });

    return fallback || entries[0];
  }, [hours, form.date]);

  useEffect(() => {
    if (!db || !form.date) {
      setReservationCounts({ count: {}, guests: {} });
      setSlotStatus("idle");
      return;
    }

    let active = true;
    const loadReservations = async () => {
      setSlotStatus("loading");
      try {
        const snapshot = await getDocs(
          query(collection(db, "reservations"), where("date", "==", form.date))
        );
        if (!active) return;
        const count = {};
        const guests = {};
        snapshot.forEach((docItem) => {
          const data = docItem.data();
          const time = data.time;
          if (!time) return;
          const statusValue = String(data.status || "").toLowerCase();
          if (statusValue === "cancelled" || statusValue === "rejected") return;
          count[time] = (count[time] || 0) + 1;
          guests[time] = (guests[time] || 0) + (Number(data.guests) || 0);
        });
        setReservationCounts({ count, guests });
        setSlotStatus("idle");
      } catch (error) {
        if (!active) return;
        setReservationCounts({ count: {}, guests: {} });
        setSlotStatus("error");
      }
    };

    loadReservations();
    return () => {
      active = false;
    };
  }, [form.date, db]);

  const timeOptions = useMemo(() => {
    if (!scheduleEntry) return [];

    const toMinutes = (value) => {
      const [h, m] = value.split(":").map(Number);
      return h * 60 + m;
    };

    const toLabel = (minutes) => {
      const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
      const h = String(Math.floor(normalized / 60)).padStart(2, "0");
      const m = String(normalized % 60).padStart(2, "0");
      return `${h}:${m}`;
    };

    const minOpen = toMinutes(scheduleEntry.open);
    let maxClose = toMinutes(scheduleEntry.close);
    const slots = [];

    if (maxClose <= minOpen) {
      maxClose += 24 * 60;
    }

    const slotDuration = Number(hours?.slotDurationMinutes) || 30;
    for (let time = minOpen; time < maxClose; time += slotDuration) {
      slots.push(toLabel(time));
    }

    const maxReservations = Number(hours?.maxReservationsPerSlot) || 0;
    const maxGuests = Number(hours?.maxGuestsPerSlot) || 0;

    return slots.filter((slot) => {
      if (maxReservations > 0 && (reservationCounts.count[slot] || 0) >= maxReservations) {
        return false;
      }
      if (maxGuests > 0 && (reservationCounts.guests[slot] || 0) >= maxGuests) {
        return false;
      }
      return true;
    });
  }, [scheduleEntry, hours, reservationCounts]);

  const lunchSlots = timeOptions.filter((slot) => Number(slot.split(":")[0]) < 17);
  const dinnerSlots = timeOptions.filter((slot) => Number(slot.split(":")[0]) >= 17);
  const hasSlots = timeOptions.length > 0;

  useEffect(() => {
    if (form.time && !timeOptions.includes(form.time)) {
      setForm((prev) => ({ ...prev, time: "" }));
    }
  }, [form.time, timeOptions]);

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = t("form.required");
    if (!form.email.trim()) nextErrors.email = t("form.required");
    if (!form.phone.trim()) nextErrors.phone = t("form.required");
    if (!form.date.trim()) nextErrors.date = t("form.required");
    if (!form.time.trim()) nextErrors.time = t("form.required");
    if (!form.guests.trim()) nextErrors.guests = t("form.required");
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
      await addDoc(collection(db, "reservations"), {
        ...form,
        guests: Number(form.guests),
        status: "pending",
        language: lang,
        createdAt: serverTimestamp(),
      });
      setStatus("success");
      setForm({
        name: "",
        email: "",
        phone: "",
        date: "",
        time: "",
        guests: "2",
        notes: "",
      });
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <PageTransition>
      <section className="space-y-12">
        <div>
          <p className="section-kicker">{t("actions.book")}</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {t("book.title")}
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
                <div className="grid gap-4 md:grid-cols-2">
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
                    {errors.email && (
                      <p className="mt-1 text-xs text-pearl-600">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label
                      className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400"
                      htmlFor="phone"
                    >
                      {t("form.phone")}
                    </label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                      aria-invalid={Boolean(errors.phone)}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-xs text-pearl-600">{errors.phone}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
                  <div>
                    <label
                      className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400"
                      htmlFor="date"
                    >
                      {t("form.date")}
                    </label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      onChange={(event) => setForm({ ...form, date: event.target.value })}
                      aria-invalid={Boolean(errors.date)}
                    />
                    {errors.date && (
                      <p className="mt-1 text-xs text-pearl-600">{errors.date}</p>
                    )}
                  </div>
                  <div>
                    <label
                      className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400"
                      htmlFor="guests"
                    >
                      {t("form.guests")}
                    </label>
                    <Input
                      id="guests"
                      type="number"
                      min="1"
                      value={form.guests}
                      onChange={(event) => setForm({ ...form, guests: event.target.value })}
                      aria-invalid={Boolean(errors.guests)}
                    />
                    {errors.guests && (
                      <p className="mt-1 text-xs text-pearl-600">{errors.guests}</p>
                    )}
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                      {t("form.time")}
                    </label>
                    <div className="space-y-4">
                      {lunchSlots.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                            {t("form.lunch")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {lunchSlots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setForm({ ...form, time: slot })}
                                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                  form.time === slot
                                    ? "border-ink-900 bg-ink-900 text-pearl-100 dark:border-pearl-100 dark:bg-pearl-100 dark:text-ink-900"
                                    : "border-pearl-100/80 bg-pearl-50/70 text-pearl-800 hover:border-pearl-300 dark:border-ink-700/60 dark:bg-ink-800/80 dark:text-pearl-100"
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {dinnerSlots.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                            {t("form.dinner")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {dinnerSlots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setForm({ ...form, time: slot })}
                                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                  form.time === slot
                                    ? "border-ink-900 bg-ink-900 text-pearl-100 dark:border-pearl-100 dark:bg-pearl-100 dark:text-ink-900"
                                    : "border-pearl-100/80 bg-pearl-50/70 text-pearl-800 hover:border-pearl-300 dark:border-ink-700/60 dark:bg-ink-800/80 dark:text-pearl-100"
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {slotStatus === "loading" && (
                        <p className="text-sm text-pearl-700 dark:text-ink-300">
                          {t("admin.loading")}
                        </p>
                      )}
                      {slotStatus !== "loading" && !hasSlots && (
                        <p className="text-sm text-pearl-700 dark:text-ink-300">
                          {t("form.noSlots")}
                        </p>
                      )}
                      {errors.time && (
                        <p className="text-xs text-pearl-600">{errors.time}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label
                    className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400"
                    htmlFor="notes"
                  >
                    {t("form.notes")}
                  </label>
                  <Textarea
                    id="notes"
                    rows="3"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </div>
                <Button type="submit" disabled={status === "loading"}>
                  {t("actions.book")}
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
              <p className="section-kicker">{t("book.details")}</p>
              <p className="text-sm text-pearl-700 dark:text-ink-300">
                {pickLocale(restaurant?.address, lang) || t("fallback")}
              </p>
              <div className="text-sm text-pearl-800 dark:text-ink-300">
                <p>{restaurant?.phone}</p>
                <p>{restaurant?.email}</p>
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

export default BookTable;

