import { useTranslation } from "react-i18next";
import Button from "./ui/Button.jsx";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const isPt = i18n.language === "pt";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => i18n.changeLanguage(isPt ? "en" : "pt")}
      aria-label={i18n.t("labels.languageSwitch")}
    >
      {isPt ? "EN" : "PT"}
    </Button>
  );
};

export default LanguageSwitcher;
