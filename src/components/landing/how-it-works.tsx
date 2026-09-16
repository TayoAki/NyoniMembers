import { Camera, LayoutGrid, UserRoundCheck, type LucideIcon } from "lucide-react";

type Step = { icon: LucideIcon; title: string; description: string };

const STEPS: readonly Step[] = [
  {
    icon: Camera,
    title: "Photograph your clothes",
    description:
      "Drop in up to fifty photos. Every garment is detected, cut out on a transparent background, and tagged with colour, fabric, season and formality.",
  },
  {
    icon: LayoutGrid,
    title: "Build outfits or ask the stylist",
    description:
      "Fill the slots yourself, or brief the stylist — “dinner, cold, smart but not stiff” — and it proposes outfits from the clothes you actually own.",
  },
  {
    icon: UserRoundCheck,
    title: "See yourself wearing it",
    description:
      "Pick an avatar photo and render the outfit on you. Renders stream in as they finish, and every one lands in your lookbook.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Three steps, then it is just your wardrobe
        </h2>
        <p className="text-muted-foreground mt-3 text-sm text-pretty sm:text-base">
          The slow parts run in the background and show you exactly which step they are on.
        </p>
      </div>
      <ol className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
        {STEPS.map((step, index) => (
          <li key={step.title} className="bg-card/40 relative flex flex-col gap-3 rounded-xl border p-5">
            <div className="flex items-center gap-3">
              <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                <step.icon className="size-4.5" aria-hidden />
              </span>
              <span className="text-muted-foreground text-xs font-medium tabular-nums">Step {index + 1}</span>
            </div>
            <h3 className="font-medium tracking-tight">{step.title}</h3>
            <p className="text-muted-foreground text-sm text-pretty">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
