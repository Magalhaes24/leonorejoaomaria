import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSeo } from "../lib/seo.js";
import { useContent } from "../data/contentStore.jsx";
import { pickLocale } from "../lib/locale.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import { Tabs, Tab } from "../components/ui/Tabs.jsx";
import SectionReveal from "../components/SectionReveal.jsx";
import PageTransition from "../components/PageTransition.jsx";

const platingImage = new URL("../assets/img/plating.jpg", import.meta.url).href;

const Menus = () => {
  const { t, i18n } = useTranslation();
  const { menuCategories, restaurant } = useContent();
  const lang = i18n.language;
  const brand = pickLocale(restaurant?.name, lang) || "Lumeo";

  const categories = useMemo(() => menuCategories || [], [menuCategories]);
  const [activeId, setActiveId] = useState(categories[0]?.id || "");

  useEffect(() => {
    if (!activeId && categories.length > 0) {
      setActiveId(categories[0].id);
    }
  }, [activeId, categories]);

  const activeCategory = categories.find((category) => category.id === activeId) || categories[0];

  useSeo({
    title: `${brand} - ${t("nav.menus")}`,
    description: t("seo.menusDescription"),
    ogTitle: `${brand} - ${t("nav.menus")}`,
    ogDescription: t("seo.menusDescription"),
    ogImage: "/og-placeholder.svg",
  });

  return (
    <PageTransition>
      <section className="space-y-12">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="section-kicker">{t("menus.kicker")}</p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              {t("menus.title")}
            </h1>
          </div>
          <div className="relative overflow-hidden rounded-[32px] shadow-soft">
            <div
              className="h-full min-h-[240px] w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${platingImage})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 via-transparent to-transparent" />
            <div className="absolute left-6 top-6 rounded-full bg-pearl-50/85 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-pearl-700 backdrop-blur dark:bg-ink-800/80 dark:text-pearl-100">
              {t("menus.plating")}
            </div>
          </div>
        </div>

        <SectionReveal>
          <Tabs>
            {categories.map((category) => (
              <Tab
                key={category.id}
                active={activeCategory?.id === category.id}
                onClick={() => setActiveId(category.id)}
              >
                {pickLocale(category.name, lang)}
              </Tab>
            ))}
          </Tabs>
        </SectionReveal>

        <SectionReveal className="grid gap-6 md:grid-cols-2">
          {(activeCategory?.items || []).map((item, index) => (
            <Card key={index} className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-medium">{pickLocale(item.name, lang)}</p>
                  <p className="text-sm text-pearl-700 dark:text-ink-300">
                    {pickLocale(item.description, lang)}
                  </p>
                </div>
                <span className="text-sm font-semibold">{item.price}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(item.tags || []).map((tag, tagIndex) => (
                  <Badge key={tagIndex}>{pickLocale(tag, lang)}</Badge>
                ))}
              </div>
            </Card>
          ))}
          {!activeCategory?.items?.length && (
            <p className="text-sm text-pearl-700">{t("admin.empty")}</p>
          )}
        </SectionReveal>
      </section>
    </PageTransition>
  );
};

export default Menus;
