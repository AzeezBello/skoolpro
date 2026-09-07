import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { tourSteps } from "@/lib/onboarding/tourSteps";
import type { Role } from "@/lib/onboarding/content";

// Several tour targets (teacher/student dashboards) only render once an
// async profile/data fetch resolves, so every step tolerates a missing
// element instead of erroring, and waits briefly in case it's still loading.
export function startProductTour(role: Role) {
  if (typeof window === "undefined") return;

  const driverObj = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.65,
    steps: tourSteps[role].map((step) => ({
      element: step.selector,
      skipMissingElement: true,
      waitForElement: 1500,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side,
      },
    })),
  });

  driverObj.drive();
}
