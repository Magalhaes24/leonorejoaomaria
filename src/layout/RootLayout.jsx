import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";

const RootLayout = () => (
  <div className="min-h-screen bg-hero-glow bg-grain">
    <Navbar />
    <main className="mx-auto w-full max-w-6xl px-8 pb-24 pt-16">
      <Outlet />
    </main>
    <Footer />
  </div>
);

export default RootLayout;
