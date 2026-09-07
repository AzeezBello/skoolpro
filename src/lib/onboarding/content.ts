export type Role = "admin" | "teacher" | "student";

export type OnboardingStep = {
  title: string;
  description: string;
};

const welcome: OnboardingStep = {
  title: "Welcome to SkoolPro",
  description: "Here's a quick look at what you can do before you dive in.",
};

const readyToTour: OnboardingStep = {
  title: "You're set",
  description: "Take the guided tour next to see exactly where everything lives, or explore on your own.",
};

export const onboardingSteps: Record<Role, OnboardingStep[]> = {
  admin: [
    welcome,
    {
      title: "Run the whole school from one dashboard",
      description: "Track students, teachers, classes, attendance, and grades from the Overview tab.",
    },
    {
      title: "Bill and collect with invoices",
      description: "Generate invoices, record payments, download receipts, and send reminders — all from Invoices.",
    },
    readyToTour,
  ],
  teacher: [
    welcome,
    {
      title: "Mark attendance in seconds",
      description: "Pick a date, mark each student Present or Absent, and save — right from your dashboard.",
    },
    {
      title: "Record grades per subject",
      description: "Enter a subject and each student's score, then save to update their term record.",
    },
    readyToTour,
  ],
  student: [
    welcome,
    {
      title: "See your class at a glance",
      description: "Your class, teacher, attendance history, and grades all live on one page.",
    },
    readyToTour,
  ],
};
