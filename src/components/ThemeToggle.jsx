import { useTranslation } from "react-i18next";
import { useTheme } from "../layout/ThemeProvider.jsx";
import Button from "./ui/Button.jsx";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(nextTheme)}
      aria-label={t("labels.themeToggle")}
    >
      {nextTheme === "dark" ? t("labels.dark") : t("labels.light")}
    </Button>
  );
};

export default ThemeToggle;
