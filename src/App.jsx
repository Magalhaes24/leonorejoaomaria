import React from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import RootLayout from "./layout/RootLayout.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Menus from "./pages/Menus.jsx";
import Contact from "./pages/Contact.jsx";
import BookTable from "./pages/BookTable.jsx";
import Admin from "./pages/Admin.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import NotFound from "./pages/NotFound.jsx";
import { DataProvider } from "./data/contentStore.jsx";
import { ThemeProvider } from "./layout/ThemeProvider.jsx";
import { AuthProvider } from "./lib/authContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { firebaseError } from "./lib/firebase.js";
import ScrollToTop from "./components/ScrollToTop.jsx";

const AnimatedRoutes = () => {
  const location = useLocation();

  useEffect(() => {
    import("./lib/analytics.js")
      .then((mod) => mod.trackPageView?.(location.pathname))
      .catch(() => {});
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<RootLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="menus" element={<Menus />} />
          <Route path="contact" element={<Contact />} />
          <Route path="book" element={<BookTable />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <ScrollToTop />
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <ErrorBoundary>
            {firebaseError ? (
              <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="section-kicker">Setup</p>
                <h1 className="text-2xl font-semibold">Firebase is not configured.</h1>
                <p className="text-sm text-pearl-700">
                  Add your Firebase keys to `.env` and restart Vite.
                </p>
              </div>
            ) : (
              <AnimatedRoutes />
            )}
          </ErrorBoundary>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
