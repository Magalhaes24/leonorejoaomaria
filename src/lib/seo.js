import { useEffect } from "react";

const ensureMeta = (selector, attribute, value) => {
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }
  return tag;
};

export const useSeo = ({ title, description, ogTitle, ogDescription, ogImage }) => {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    if (description) {
      const metaDescription = ensureMeta('meta[name="description"]', "name", "description");
      metaDescription.setAttribute("content", description);
    }

    if (ogTitle) {
      const metaOgTitle = ensureMeta('meta[property="og:title"]', "property", "og:title");
      metaOgTitle.setAttribute("content", ogTitle);
    }

    if (ogDescription) {
      const metaOgDescription = ensureMeta(
        'meta[property="og:description"]',
        "property",
        "og:description"
      );
      metaOgDescription.setAttribute("content", ogDescription);
    }

    if (ogImage) {
      const metaOgImage = ensureMeta('meta[property="og:image"]', "property", "og:image");
      metaOgImage.setAttribute("content", ogImage);
    }
  }, [title, description, ogTitle, ogDescription, ogImage]);
};
