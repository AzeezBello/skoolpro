"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { onboardingSteps, type Role } from "@/lib/onboarding/content";

type OnboardingFlowProps = {
  role: Role;
  onFinish: (startTour: boolean) => void;
};

export function OnboardingFlow({ role, onFinish }: OnboardingFlowProps) {
  const steps = onboardingSteps[role];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${i === index ? "bg-primary" : "bg-white/15"}`}
            />
          ))}
        </div>

        <h2 className="text-xl font-semibold">{step.title}</h2>
        <p className="mt-2 text-sm text-slate-300">{step.description}</p>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onFinish(false)}
            className="text-xs font-semibold text-slate-400 transition hover:text-slate-200"
          >
            Skip
          </button>

          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button onClick={() => onFinish(true)}>Take the tour</Button>
            ) : (
              <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
