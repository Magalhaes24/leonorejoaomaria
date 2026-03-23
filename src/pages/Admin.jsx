
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { db } from "../lib/firebase.js";
import { useContent } from "../data/contentStore.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { seedContent } from "../lib/seedContent.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Textarea from "../components/ui/Textarea.jsx";
import PageTransition from "../components/PageTransition.jsx";

const emptyLocale = { pt: "", en: "" };

const Admin = () => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { restaurant, hours, highlights, testimonials, menuCategories, loading, error } =
    useContent();

  const [restaurantForm, setRestaurantForm] = useState({
    name: { ...emptyLocale },
    tagline: { ...emptyLocale },
    heroTitle: { ...emptyLocale },
    heroSubtitle: { ...emptyLocale },
    heroCta: { ...emptyLocale },
    story: { ...emptyLocale },
    chefNote: { ...emptyLocale },
    values: [],
    atmosphere: { ...emptyLocale },
    address: { ...emptyLocale },
    phone: "",
    email: "",
    mapEmbedUrl: "",
    social: { instagram: "", facebook: "" },
  });

  const [hoursForm, setHoursForm] = useState({
    entries: [],
    slotDurationMinutes: 30,
    maxReservationsPerSlot: 12,
    maxGuestsPerSlot: 36,
    note: { ...emptyLocale },
  });

  const [highlightForms, setHighlightForms] = useState([]);
  const [testimonialForms, setTestimonialForms] = useState([]);
  const [menuForms, setMenuForms] = useState([]);

  useEffect(() => {
    if (restaurant) {
      setRestaurantForm((prev) => ({
        ...prev,
        ...restaurant,
        social: {
          instagram: restaurant?.social?.instagram || "",
          facebook: restaurant?.social?.facebook || "",
        },
      }));
    }
  }, [restaurant]);

  useEffect(() => {
    if (hours) {
      setHoursForm({
        entries: hours.entries || [],
        slotDurationMinutes: hours.slotDurationMinutes ?? 30,
        maxReservationsPerSlot: hours.maxReservationsPerSlot ?? 12,
        maxGuestsPerSlot: hours.maxGuestsPerSlot ?? 36,
        note: hours.note || { ...emptyLocale },
      });
    }
  }, [hours]);

  useEffect(() => {
    setHighlightForms(
      highlights.map((item) => ({
        ...item,
      }))
    );
  }, [highlights]);

  useEffect(() => {
    setTestimonialForms(
      testimonials.map((item) => ({
        ...item,
      }))
    );
  }, [testimonials]);

  useEffect(() => {
    setMenuForms(
      menuCategories.map((category) => ({
        ...category,
        items: (category.items || []).map((item) => ({
          ...item,
          tagsPt: (item.tags || []).map((tag) => tag.pt).join(", "),
          tagsEn: (item.tags || []).map((tag) => tag.en).join(", "),
        })),
      }))
    );
  }, [menuCategories]);

  const saveRestaurant = async () => {
    await setDoc(doc(db, "site", "restaurant"), restaurantForm, { merge: true });
  };

  const saveHours = async () => {
    await setDoc(doc(db, "hours", "default"), hoursForm, { merge: true });
  };
  const addHighlight = () => {
    setHighlightForms((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        title: { ...emptyLocale },
        description: { ...emptyLocale },
        price: "",
        image: "",
      },
    ]);
  };

  const saveHighlight = async (item) => {
    const payload = {
      title: item.title,
      description: item.description,
      price: item.price,
      image: item.image,
    };
    if (item.id) {
      await updateDoc(doc(db, "highlights", item.id), payload);
    } else {
      await addDoc(collection(db, "highlights"), payload);
    }
  };

  const deleteHighlight = async (item) => {
    if (item.id) {
      await deleteDoc(doc(db, "highlights", item.id));
    } else {
      setHighlightForms((prev) => prev.filter((entry) => entry.localId !== item.localId));
    }
  };

  const addTestimonial = () => {
    setTestimonialForms((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        name: "",
        role: { ...emptyLocale },
        quote: { ...emptyLocale },
      },
    ]);
  };

  const saveTestimonial = async (item) => {
    const payload = {
      name: item.name,
      role: item.role,
      quote: item.quote,
    };
    if (item.id) {
      await updateDoc(doc(db, "testimonials", item.id), payload);
    } else {
      await addDoc(collection(db, "testimonials"), payload);
    }
  };

  const deleteTestimonial = async (item) => {
    if (item.id) {
      await deleteDoc(doc(db, "testimonials", item.id));
    } else {
      setTestimonialForms((prev) => prev.filter((entry) => entry.localId !== item.localId));
    }
  };

  const addMenuCategory = () => {
    setMenuForms((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        name: { ...emptyLocale },
        order: prev.length + 1,
        items: [],
      },
    ]);
  };

  const addMenuItem = (categoryId) => {
    setMenuForms((prev) =>
      prev.map((category) =>
        category.id === categoryId || category.localId === categoryId
          ? {
              ...category,
              items: [
                ...category.items,
                {
                  name: { ...emptyLocale },
                  description: { ...emptyLocale },
                  price: "",
                  tagsPt: "",
                  tagsEn: "",
                },
              ],
            }
          : category
      )
    );
  };

  const saveMenuCategory = async (category) => {
    const items = (category.items || []).map((item) => {
      const ptTags = item.tagsPt
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const enTags = item.tagsEn
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const maxLength = Math.max(ptTags.length, enTags.length);
      const tags = Array.from({ length: maxLength }, (_, index) => ({
        pt: ptTags[index] || "",
        en: enTags[index] || "",
      })).filter((tag) => tag.pt || tag.en);

      return {
        name: item.name,
        description: item.description,
        price: item.price,
        tags,
      };
    });

    const payload = {
      name: category.name,
      order: Number(category.order) || 0,
      items,
    };

    if (category.id) {
      await updateDoc(doc(db, "menuCategories", category.id), payload);
    } else {
      await addDoc(collection(db, "menuCategories"), payload);
    }
  };

  const deleteMenuCategory = async (category) => {
    if (category.id) {
      await deleteDoc(doc(db, "menuCategories", category.id));
    } else {
      setMenuForms((prev) => prev.filter((entry) => entry.localId !== category.localId));
    }
  };

  const seedDemoContent = async () => {
    await seedContent(db);
  };

  const contentState = useMemo(() => {
    if (loading) return t("admin.loading");
    if (error) return t("admin.error");
    return null;
  }, [loading, error, t]);

  return (
    <PageTransition>
      <div className="space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="section-kicker">{t("admin.title")}</p>
            <h1 className="text-3xl font-semibold">Content management</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button as="a" href="/" variant="outline">
              {t("actions.viewSite")}
            </Button>
            <Button variant="outline" onClick={seedDemoContent}>
              Seed demo
            </Button>
            <Button variant="ghost" onClick={logout}>
              {t("actions.signOut")}
            </Button>
          </div>
        </div>

        {contentState && <p className="text-sm text-pearl-700">{contentState}</p>}

        <Card className="space-y-6">
          <div>
            <p className="section-kicker">Restaurant</p>
            <h2 className="text-xl font-semibold">Brand identity</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">Name (PT)</label>
              <Input
                value={restaurantForm.name.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    name: { ...restaurantForm.name, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">Name (EN)</label>
              <Input
                value={restaurantForm.name.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    name: { ...restaurantForm.name, en: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Tagline (PT)
              </label>
              <Input
                value={restaurantForm.tagline.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    tagline: { ...restaurantForm.tagline, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Tagline (EN)
              </label>
              <Input
                value={restaurantForm.tagline.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    tagline: { ...restaurantForm.tagline, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Hero title (PT)
              </label>
              <Textarea
                rows="2"
                value={restaurantForm.heroTitle.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    heroTitle: { ...restaurantForm.heroTitle, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Hero title (EN)
              </label>
              <Textarea
                rows="2"
                value={restaurantForm.heroTitle.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    heroTitle: { ...restaurantForm.heroTitle, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Hero subtitle (PT)
              </label>
              <Textarea
                rows="2"
                value={restaurantForm.heroSubtitle.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    heroSubtitle: { ...restaurantForm.heroSubtitle, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Hero subtitle (EN)
              </label>
              <Textarea
                rows="2"
                value={restaurantForm.heroSubtitle.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    heroSubtitle: { ...restaurantForm.heroSubtitle, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                CTA label (PT)
              </label>
              <Input
                value={restaurantForm.heroCta.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    heroCta: { ...restaurantForm.heroCta, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                CTA label (EN)
              </label>
              <Input
                value={restaurantForm.heroCta.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    heroCta: { ...restaurantForm.heroCta, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <Button onClick={saveRestaurant}>{t("actions.save")}</Button>
        </Card>
        <Card className="space-y-6">
          <div>
            <p className="section-kicker">Contact</p>
            <h2 className="text-xl font-semibold">Contact info</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Address (PT)
              </label>
              <Textarea
                rows="2"
                value={restaurantForm.address.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    address: { ...restaurantForm.address, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Address (EN)
              </label>
              <Textarea
                rows="2"
                value={restaurantForm.address.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    address: { ...restaurantForm.address, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">Phone</label>
              <Input
                value={restaurantForm.phone}
                onChange={(event) =>
                  setRestaurantForm({ ...restaurantForm, phone: event.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">Email</label>
              <Input
                value={restaurantForm.email}
                onChange={(event) =>
                  setRestaurantForm({ ...restaurantForm, email: event.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Map embed URL
              </label>
              <Input
                value={restaurantForm.mapEmbedUrl}
                onChange={(event) =>
                  setRestaurantForm({ ...restaurantForm, mapEmbedUrl: event.target.value })
                }
              />
            </div>
          </div>
          <Button onClick={saveRestaurant}>{t("actions.save")}</Button>
        </Card>

        <Card className="space-y-6">
          <div>
            <p className="section-kicker">Story</p>
            <h2 className="text-xl font-semibold">Narrative and values</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">Story (PT)</label>
              <Textarea
                rows="4"
                value={restaurantForm.story.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    story: { ...restaurantForm.story, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">Story (EN)</label>
              <Textarea
                rows="4"
                value={restaurantForm.story.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    story: { ...restaurantForm.story, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Chef note (PT)
              </label>
              <Textarea
                rows="3"
                value={restaurantForm.chefNote.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    chefNote: { ...restaurantForm.chefNote, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Chef note (EN)
              </label>
              <Textarea
                rows="3"
                value={restaurantForm.chefNote.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    chefNote: { ...restaurantForm.chefNote, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Atmosphere (PT)
              </label>
              <Textarea
                rows="3"
                value={restaurantForm.atmosphere.pt}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    atmosphere: { ...restaurantForm.atmosphere, pt: event.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                Atmosphere (EN)
              </label>
              <Textarea
                rows="3"
                value={restaurantForm.atmosphere.en}
                onChange={(event) =>
                  setRestaurantForm({
                    ...restaurantForm,
                    atmosphere: { ...restaurantForm.atmosphere, en: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">Values</label>
            {(restaurantForm.values || []).map((value, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  placeholder="Value (PT)"
                  value={value.pt || ""}
                  onChange={(event) =>
                    setRestaurantForm((prev) => {
                      const nextValues = [...(prev.values || [])];
                      nextValues[index] = { ...nextValues[index], pt: event.target.value };
                      return { ...prev, values: nextValues };
                    })
                  }
                />
                <Input
                  placeholder="Value (EN)"
                  value={value.en || ""}
                  onChange={(event) =>
                    setRestaurantForm((prev) => {
                      const nextValues = [...(prev.values || [])];
                      nextValues[index] = { ...nextValues[index], en: event.target.value };
                      return { ...prev, values: nextValues };
                    })
                  }
                />
                <Button
                  variant="ghost"
                  onClick={() =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      values: (prev.values || []).filter((_, valueIndex) => valueIndex !== index),
                    }))
                  }
                >
                  {t("actions.delete")}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setRestaurantForm((prev) => ({
                  ...prev,
                  values: [...(prev.values || []), { ...emptyLocale }],
                }))
              }
            >
              {t("actions.add")}
            </Button>
          </div>
          <Button onClick={saveRestaurant}>{t("actions.save")}</Button>
        </Card>

        <Card className="space-y-6">
          <div>
            <p className="section-kicker">Hours</p>
            <h2 className="text-xl font-semibold">Opening hours</h2>
          </div>
          <div className="space-y-4">
            {(hoursForm.entries || []).map((entry, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr_auto]">
                <Input
                  placeholder="Label (PT)"
                  value={entry.label?.pt || ""}
                  onChange={(event) =>
                    setHoursForm((prev) => {
                      const nextEntries = [...prev.entries];
                      nextEntries[index] = {
                        ...nextEntries[index],
                        label: { ...nextEntries[index].label, pt: event.target.value },
                      };
                      return { ...prev, entries: nextEntries };
                    })
                  }
                />
                <Input
                  placeholder="Label (EN)"
                  value={entry.label?.en || ""}
                  onChange={(event) =>
                    setHoursForm((prev) => {
                      const nextEntries = [...prev.entries];
                      nextEntries[index] = {
                        ...nextEntries[index],
                        label: { ...nextEntries[index].label, en: event.target.value },
                      };
                      return { ...prev, entries: nextEntries };
                    })
                  }
                />
                <Input
                  placeholder="Open"
                  value={entry.open || ""}
                  onChange={(event) =>
                    setHoursForm((prev) => {
                      const nextEntries = [...prev.entries];
                      nextEntries[index] = { ...nextEntries[index], open: event.target.value };
                      return { ...prev, entries: nextEntries };
                    })
                  }
                />
                <Input
                  placeholder="Close"
                  value={entry.close || ""}
                  onChange={(event) =>
                    setHoursForm((prev) => {
                      const nextEntries = [...prev.entries];
                      nextEntries[index] = { ...nextEntries[index], close: event.target.value };
                      return { ...prev, entries: nextEntries };
                    })
                  }
                />
                <Button
                  variant="ghost"
                  onClick={() =>
                    setHoursForm((prev) => ({
                      ...prev,
                      entries: prev.entries.filter((_, entryIndex) => entryIndex !== index),
                    }))
                  }
                >
                  {t("actions.delete")}
                </Button>
              </div>
            ))}
              <Button
                variant="outline"
                onClick={() =>
                  setHoursForm((prev) => ({
                    ...prev,
                    entries: [
                      ...prev.entries,
                      { label: { ...emptyLocale }, open: "", close: "" },
                    ],
                  }))
                }
              >
                {t("actions.add")}
              </Button>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                    Slot duration (min)
                  </label>
                  <Input
                    type="number"
                    min="15"
                    step="5"
                    value={hoursForm.slotDurationMinutes ?? 30}
                    onChange={(event) =>
                      setHoursForm((prev) => ({
                        ...prev,
                        slotDurationMinutes: Number(event.target.value) || 30,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                    Max reservations/slot
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={hoursForm.maxReservationsPerSlot ?? 12}
                    onChange={(event) =>
                      setHoursForm((prev) => ({
                        ...prev,
                        maxReservationsPerSlot: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                    Max guests/slot
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={hoursForm.maxGuestsPerSlot ?? 36}
                    onChange={(event) =>
                      setHoursForm((prev) => ({
                        ...prev,
                        maxGuestsPerSlot: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                    Note (PT)
                  </label>
                <Textarea
                  rows="2"
                  value={hoursForm.note?.pt || ""}
                  onChange={(event) =>
                    setHoursForm((prev) => ({
                      ...prev,
                      note: { ...prev.note, pt: event.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-pearl-600 dark:text-ink-400">
                  Note (EN)
                </label>
                <Textarea
                  rows="2"
                  value={hoursForm.note?.en || ""}
                  onChange={(event) =>
                    setHoursForm((prev) => ({
                      ...prev,
                      note: { ...prev.note, en: event.target.value },
                    }))
                  }
                />
              </div>
            </div>
            <Button onClick={saveHours}>{t("actions.save")}</Button>
          </div>
        </Card>

        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Highlights</p>
              <h2 className="text-xl font-semibold">Home highlights</h2>
            </div>
            <Button variant="outline" onClick={addHighlight}>
              {t("actions.add")}
            </Button>
          </div>
          <div className="space-y-6">
            {highlightForms.map((item) => (
              <div key={item.id || item.localId} className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Title (PT)"
                  value={item.title?.pt || ""}
                  onChange={(event) =>
                    setHighlightForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? { ...entry, title: { ...entry.title, pt: event.target.value } }
                          : entry
                      )
                    )
                  }
                />
                <Input
                  placeholder="Title (EN)"
                  value={item.title?.en || ""}
                  onChange={(event) =>
                    setHighlightForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? { ...entry, title: { ...entry.title, en: event.target.value } }
                          : entry
                      )
                    )
                  }
                />
                <Textarea
                  rows="2"
                  placeholder="Description (PT)"
                  value={item.description?.pt || ""}
                  onChange={(event) =>
                    setHighlightForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? {
                              ...entry,
                              description: { ...entry.description, pt: event.target.value },
                            }
                          : entry
                      )
                    )
                  }
                />
                <Textarea
                  rows="2"
                  placeholder="Description (EN)"
                  value={item.description?.en || ""}
                  onChange={(event) =>
                    setHighlightForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? {
                              ...entry,
                              description: { ...entry.description, en: event.target.value },
                            }
                          : entry
                      )
                    )
                  }
                />
                <Input
                  placeholder="Price"
                  value={item.price || ""}
                  onChange={(event) =>
                    setHighlightForms((prev) =>
                      prev.map((entry) =>
                        entry === item ? { ...entry, price: event.target.value } : entry
                      )
                    )
                  }
                />
                <Input
                  placeholder="Image URL"
                  value={item.image || ""}
                  onChange={(event) =>
                    setHighlightForms((prev) =>
                      prev.map((entry) =>
                        entry === item ? { ...entry, image: event.target.value } : entry
                      )
                    )
                  }
                />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => saveHighlight(item)}>
                    {t("actions.save")}
                  </Button>
                  <Button variant="ghost" onClick={() => deleteHighlight(item)}>
                    {t("actions.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Testimonials</p>
              <h2 className="text-xl font-semibold">Guest quotes</h2>
            </div>
            <Button variant="outline" onClick={addTestimonial}>
              {t("actions.add")}
            </Button>
          </div>
          <div className="space-y-6">
            {testimonialForms.map((item) => (
              <div key={item.id || item.localId} className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Name"
                  value={item.name || ""}
                  onChange={(event) =>
                    setTestimonialForms((prev) =>
                      prev.map((entry) =>
                        entry === item ? { ...entry, name: event.target.value } : entry
                      )
                    )
                  }
                />
                <Input
                  placeholder="Role (PT)"
                  value={item.role?.pt || ""}
                  onChange={(event) =>
                    setTestimonialForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? { ...entry, role: { ...entry.role, pt: event.target.value } }
                          : entry
                      )
                    )
                  }
                />
                <Input
                  placeholder="Role (EN)"
                  value={item.role?.en || ""}
                  onChange={(event) =>
                    setTestimonialForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? { ...entry, role: { ...entry.role, en: event.target.value } }
                          : entry
                      )
                    )
                  }
                />
                <Textarea
                  rows="2"
                  placeholder="Quote (PT)"
                  value={item.quote?.pt || ""}
                  onChange={(event) =>
                    setTestimonialForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? { ...entry, quote: { ...entry.quote, pt: event.target.value } }
                          : entry
                      )
                    )
                  }
                />
                <Textarea
                  rows="2"
                  placeholder="Quote (EN)"
                  value={item.quote?.en || ""}
                  onChange={(event) =>
                    setTestimonialForms((prev) =>
                      prev.map((entry) =>
                        entry === item
                          ? { ...entry, quote: { ...entry.quote, en: event.target.value } }
                          : entry
                      )
                    )
                  }
                />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => saveTestimonial(item)}>
                    {t("actions.save")}
                  </Button>
                  <Button variant="ghost" onClick={() => deleteTestimonial(item)}>
                    {t("actions.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Menus</p>
              <h2 className="text-xl font-semibold">Menu categories</h2>
            </div>
            <Button variant="outline" onClick={addMenuCategory}>
              {t("actions.add")}
            </Button>
          </div>
          <div className="space-y-8">
            {menuForms.map((category) => (
              <div key={category.id || category.localId} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Input
                    placeholder="Category name (PT)"
                    value={category.name?.pt || ""}
                    onChange={(event) =>
                      setMenuForms((prev) =>
                        prev.map((entry) =>
                          entry === category
                            ? { ...entry, name: { ...entry.name, pt: event.target.value } }
                            : entry
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Category name (EN)"
                    value={category.name?.en || ""}
                    onChange={(event) =>
                      setMenuForms((prev) =>
                        prev.map((entry) =>
                          entry === category
                            ? { ...entry, name: { ...entry.name, en: event.target.value } }
                            : entry
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Order"
                    value={category.order}
                    onChange={(event) =>
                      setMenuForms((prev) =>
                        prev.map((entry) =>
                          entry === category
                            ? { ...entry, order: event.target.value }
                            : entry
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-4">
                  {category.items.map((item, index) => (
                    <div key={index} className="rounded-2xl border border-ink-200 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          placeholder="Item name (PT)"
                          value={item.name?.pt || ""}
                          onChange={(event) =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, childIndex) =>
                                        childIndex === index
                                          ? {
                                              ...child,
                                              name: { ...child.name, pt: event.target.value },
                                            }
                                          : child
                                      ),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="Item name (EN)"
                          value={item.name?.en || ""}
                          onChange={(event) =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, childIndex) =>
                                        childIndex === index
                                          ? {
                                              ...child,
                                              name: { ...child.name, en: event.target.value },
                                            }
                                          : child
                                      ),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                        <Textarea
                          rows="2"
                          placeholder="Description (PT)"
                          value={item.description?.pt || ""}
                          onChange={(event) =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, childIndex) =>
                                        childIndex === index
                                          ? {
                                              ...child,
                                              description: {
                                                ...child.description,
                                                pt: event.target.value,
                                              },
                                            }
                                          : child
                                      ),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                        <Textarea
                          rows="2"
                          placeholder="Description (EN)"
                          value={item.description?.en || ""}
                          onChange={(event) =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, childIndex) =>
                                        childIndex === index
                                          ? {
                                              ...child,
                                              description: {
                                                ...child.description,
                                                en: event.target.value,
                                              },
                                            }
                                          : child
                                      ),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="Price"
                          value={item.price || ""}
                          onChange={(event) =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, childIndex) =>
                                        childIndex === index
                                          ? { ...child, price: event.target.value }
                                          : child
                                      ),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="Tags (PT) comma separated"
                          value={item.tagsPt || ""}
                          onChange={(event) =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, childIndex) =>
                                        childIndex === index
                                          ? { ...child, tagsPt: event.target.value }
                                          : child
                                      ),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="Tags (EN) comma separated"
                          value={item.tagsEn || ""}
                          onChange={(event) =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, childIndex) =>
                                        childIndex === index
                                          ? { ...child, tagsEn: event.target.value }
                                          : child
                                      ),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setMenuForms((prev) =>
                              prev.map((entry) =>
                                entry === category
                                  ? {
                                      ...entry,
                                      items: entry.items.filter((_, childIndex) => childIndex !== index),
                                    }
                                  : entry
                              )
                            )
                          }
                        >
                          {t("actions.delete")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => addMenuItem(category.id || category.localId)}
                  >
                    {t("actions.add")}
                  </Button>
                  <Button variant="outline" onClick={() => saveMenuCategory(category)}>
                    {t("actions.save")}
                  </Button>
                  <Button variant="ghost" onClick={() => deleteMenuCategory(category)}>
                    {t("actions.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
};

export default Admin;

