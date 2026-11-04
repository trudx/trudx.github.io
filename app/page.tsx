//* Components Imports
import { LandingPage } from "./_components/landing-page";
import { LastRouteRedirect } from "./_components/last-route-redirect";

export default function Home() {
  return (
    <>
      <LastRouteRedirect />
      <LandingPage />
    </>
  );
}
