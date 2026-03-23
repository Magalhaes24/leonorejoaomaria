import { Link } from "react-router-dom";
import Button from "../components/ui/Button.jsx";
import PageTransition from "../components/PageTransition.jsx";

const NotFound = () => (
  <PageTransition>
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 text-center">
      <p className="section-kicker">404</p>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-sm text-pearl-700">
        The page you are looking for is unavailable.
      </p>
      <Button as={Link} to="/">
        Back to home
      </Button>
    </div>
  </PageTransition>
);

export default NotFound;
