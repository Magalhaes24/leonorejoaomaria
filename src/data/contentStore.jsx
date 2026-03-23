import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseError } from "../lib/firebase";
import { seedContent } from "../lib/seedContent.js";

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
  const [restaurant, setRestaurant] = useState(null);
  const [hours, setHours] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seededRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const received = {
      restaurant: false,
      hours: false,
      highlights: false,
      testimonials: false,
      menus: false,
    };

    const markLoaded = (key) => {
      received[key] = true;
      if (Object.values(received).every(Boolean) && mounted) {
        setLoading(false);
      }
    };

    const handleError = (err) => {
      setError(err);
      if (mounted) {
        setLoading(false);
      }
    };

    if (!db) {
      setError(firebaseError || new Error("Firestore unavailable."));
      setLoading(false);
      return () => {};
    }

    const unsubRestaurant = onSnapshot(
      doc(db, "site", "restaurant"),
      (snap) => {
        setRestaurant(snap.exists() ? snap.data() : null);
        markLoaded("restaurant");
      },
      handleError
    );

    const unsubHours = onSnapshot(
      doc(db, "hours", "default"),
      (snap) => {
        setHours(snap.exists() ? snap.data() : null);
        markLoaded("hours");
      },
      handleError
    );

    const highlightsQuery = query(collection(db, "highlights"));
    const unsubHighlights = onSnapshot(
      highlightsQuery,
      (snap) => {
        setHighlights(
          snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        );
        markLoaded("highlights");
      },
      handleError
    );

    const testimonialsQuery = query(collection(db, "testimonials"));
    const unsubTestimonials = onSnapshot(
      testimonialsQuery,
      (snap) => {
        setTestimonials(
          snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        );
        markLoaded("testimonials");
      },
      handleError
    );

    const menuQuery = query(collection(db, "menuCategories"), orderBy("order", "asc"));
    const unsubMenus = onSnapshot(
      menuQuery,
      (snap) => {
        setMenuCategories(
          snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        );
        markLoaded("menus");
      },
      handleError
    );

    return () => {
      mounted = false;
      unsubRestaurant();
      unsubHours();
      unsubHighlights();
      unsubTestimonials();
      unsubMenus();
    };
  }, []);

  useEffect(() => {
    if (seededRef.current) return;
    if (loading || error) return;
    const isEmpty =
      !restaurant &&
      !hours &&
      highlights.length === 0 &&
      testimonials.length === 0 &&
      menuCategories.length === 0;

    if (isEmpty && db) {
      seededRef.current = true;
      seedContent(db).catch(() => {});
    }
  }, [loading, error, restaurant, hours, highlights, testimonials, menuCategories]);

  const value = useMemo(
    () => ({
      restaurant,
      hours,
      highlights,
      testimonials,
      menuCategories,
      loading,
      error,
    }),
    [restaurant, hours, highlights, testimonials, menuCategories, loading, error]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useContent = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useContent must be used within DataProvider");
  }
  return context;
};
