import type { Role } from "./content";

export type TourStep = {
  selector: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
};

// Present on every dashboard page once Topbar renders, so it's a safe last
// step for every role's tour.
const replayTourStep: TourStep = {
  selector: '[data-tour="topbar-replay-tour"]',
  title: "Come back anytime",
  description: "Click here whenever you want to replay this tour.",
  side: "bottom",
};

export const tourSteps: Record<Role, TourStep[]> = {
  admin: [
    {
      selector: '[data-tour="sidebar-overview"]',
      title: "Overview",
      description: "Live counts and charts for students, teachers, classes, and attendance.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-school"]',
      title: "School Profile",
      description: "Set your school's name, logo, and contact info — this appears on report cards and receipts.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-students"]',
      title: "Students",
      description: "View and manage student records here.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-teachers"]',
      title: "Teachers",
      description: "View and manage teacher records here.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-classes"]',
      title: "Classes",
      description: "Create classes and assign a teacher to each one.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-subjects"]',
      title: "Subjects",
      description: "Define subjects and assign them to classes — every student in a class takes its assigned subjects.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-sessions"]',
      title: "Sessions",
      description: "Set up academic sessions and terms with real dates, and promote students to their next class each session.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-attendance"]',
      title: "Attendance",
      description: "Record daily attendance for any class.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-results"]',
      title: "Results",
      description: "Enter CA and exam scores per subject and term — students can then download their report card.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-fee-items"]',
      title: "Fee Items",
      description: "Define the fees your school charges — these show up when you create an invoice.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-invoices"]',
      title: "Invoices",
      description: "Generate invoices, record payments, download receipts, and send reminders.",
      side: "right",
    },
    {
      selector: '[data-tour="sidebar-reports"]',
      title: "Reports",
      description: "Export attendance and grade reports to PDF or Excel.",
      side: "right",
    },
    replayTourStep,
  ],
  teacher: [
    {
      selector: '[data-tour="teacher-attendance-table"]',
      title: "Mark attendance",
      description: "Mark each student Present or Absent for the selected date.",
      side: "top",
    },
    {
      selector: '[data-tour="teacher-save-attendance"]',
      title: "Save attendance",
      description: "Save once you've marked everyone for the day.",
      side: "top",
    },
    {
      selector: '[data-tour="teacher-results-link"]',
      title: "Enter results",
      description: "Head to the Results page to enter CA and exam scores per subject and term.",
      side: "top",
    },
    replayTourStep,
  ],
  student: [
    {
      selector: '[data-tour="student-class-info"]',
      title: "Your class",
      description: "Your class and teacher are shown here.",
      side: "bottom",
    },
    {
      selector: '[data-tour="student-attendance"]',
      title: "Attendance",
      description: "Your attendance history for the term.",
      side: "top",
    },
    {
      selector: '[data-tour="student-grades"]',
      title: "Results",
      description: "Your CA, exam, and total scores by subject — download your report card from here too.",
      side: "top",
    },
    replayTourStep,
  ],
};
